import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '../config/prisma.config';
import { LoginSchema } from '../dtos/auth.dto';
import { AuthenticatedUser } from '../middlewares/auth.middleware';
import { UserRole, UserStatus } from '@prisma/client';
import { getJwtAccessExpiry, getJwtAccessSecret } from '../config/jwt.config';
import { getTenantSettings, saveGeneralSettings } from '../config/smtp.config';
import { smtpService } from '../services/smtp.service';
import {
  renderOtpEmail,
  renderSignupVerificationEmail,
} from '../services/emailTemplate.service';
import { analyticsService } from '../services/analytics.service';
import { userService } from '../services/user.service';
import {
  clearSessionRefreshCookie,
  getRefreshCookieFromRequest,
  issueSessionRefreshToken,
  revokeAllUserSessions,
  revokeSessionRefreshToken,
  rotateSessionRefreshToken,
  setSessionRefreshCookie,
} from '../services/sessionToken.service';

async function resolveUserLiveWorkload(userId: string, tenantId: string, fallback: string | null) {
  try {
    const map = await analyticsService.getLiveWorkloadsMap(tenantId, [userId]);
    return map.get(userId)?.workloadText || fallback || '0 Reqs • 0 Subs • 0 Placements';
  } catch {
    return fallback || '0 Reqs • 0 Subs • 0 Placements';
  }
}

async function buildSignedSessionPayload(
  user: {
    id: string;
    email: string;
    fullName: string;
    agencyName: string | null;
    tenantId: string | null;
    role: UserRole;
    desk: string | null;
    rateMasked: boolean;
    workload: string | null;
    status: UserStatus;
    tokenVersion: number;
  },
  options?: { isSuperAdminOverride?: boolean }
) {
  const tenantId = user.tenantId || `tenant_${user.id}`;
  const settings = await getTenantSettings(tenantId);
  const resolvedAgencyName =
    settings.general.agencyName?.trim() || user.agencyName || 'SquadPipe Staffing';

  const authPayload: AuthenticatedUser = {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    agencyName: resolvedAgencyName,
    tenantId,
    role: user.role,
    rateMasked: user.rateMasked,
    tokenVersion: user.tokenVersion,
  };

  const token = jwt.sign(authPayload, getJwtAccessSecret(), {
    expiresIn: getJwtAccessExpiry() as jwt.SignOptions['expiresIn'],
  });

  const [liveWorkload, isSuperAdmin] = await Promise.all([
    resolveUserLiveWorkload(user.id, tenantId, user.workload),
    typeof options?.isSuperAdminOverride === 'boolean'
      ? Promise.resolve(options.isSuperAdminOverride)
      : userService.isSuperAdmin(tenantId, user.id).catch(() => false),
  ]);

  return {
    token,
    tenantId,
    resolvedAgencyName,
    user: {
      id: user.id,
      name: user.fullName,
      fullName: user.fullName,
      email: user.email,
      agencyName: resolvedAgencyName,
      tenantId,
      role: user.role,
      desk: user.desk,
      rateMasked: user.rateMasked,
      workload: liveWorkload,
      status: user.status,
      isSuperAdmin,
      isCurrentUser: true,
      onboardingCompleted: settings.general.onboardingCompleted !== false,
      lastActive: 'Active Now',
    },
  };
}

const OTP_RESEND_COOLDOWN_SECONDS = 120;
const SIGNUP_OTP_RESEND_COOLDOWN_SECONDS = 60;
const SIGNUP_OTP_PREFIX = 'signup_otp_';
const SIGNUP_UNVERIFIED_PREFIX = 'signup_unverified_';

export function isOtpDevFallbackEnabled(): boolean {
  const flag = String(process.env.OTP_DEV_FALLBACK || '').trim().toLowerCase();
  if (flag === 'true' || flag === '1' || flag === 'yes') return true;
  if (flag === 'false' || flag === '0' || flag === 'no') return false;
  return process.env.NODE_ENV !== 'production';
}

async function isEmailPendingVerification(userId: string, email: string): Promise<boolean> {
  const marker = await prisma.refreshToken.findFirst({
    where: {
      userId,
      token: `${SIGNUP_UNVERIFIED_PREFIX}${email}`,
      revokedAt: null,
    },
    select: { id: true },
  });
  return Boolean(marker);
}

type DispatchSignupOtpResult =
  | {
      ok: true;
      emailDelivered: boolean;
      devOtp?: string;
      cooldownSeconds: number;
    }
  | {
      ok: false;
      status: number;
      code?: string;
      retryAfterSeconds?: number;
      message: string;
    };

async function dispatchSignupOtp(params: {
  userId: string;
  email: string;
  fullName: string;
  tenantId: string;
  brandName: string;
  bypassCooldown?: boolean;
}): Promise<DispatchSignupOtpResult> {
  const prefix = `${SIGNUP_OTP_PREFIX}${params.email}_`;

  if (!params.bypassCooldown) {
    const latestOtp = await prisma.refreshToken.findFirst({
      where: {
        userId: params.userId,
        token: { startsWith: prefix },
        revokedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });
    if (latestOtp) {
      const elapsedMs = Date.now() - latestOtp.createdAt.getTime();
      const cooldownMs = SIGNUP_OTP_RESEND_COOLDOWN_SECONDS * 1000;
      if (elapsedMs < cooldownMs) {
        const retryAfterSeconds = Math.ceil((cooldownMs - elapsedMs) / 1000);
        return {
          ok: false,
          status: 429,
          code: 'OTP_COOLDOWN',
          retryAfterSeconds,
          message: `Please wait ${retryAfterSeconds}s before requesting a new verification code.`,
        };
      }
    }
  }

  const otpCode = crypto.randomInt(100000, 1000000).toString();
  const tokenKey = `${prefix}${otpCode}`;

  await prisma.refreshToken.updateMany({
    where: {
      userId: params.userId,
      token: { startsWith: prefix },
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  });

  const otpRecord = await prisma.refreshToken.create({
    data: {
      token: tokenKey,
      userId: params.userId,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    },
  });

  const { subject, html } = renderSignupVerificationEmail({
    brandName: params.brandName,
    recipientName: params.fullName,
    otpCode,
    expiresMinutes: 15,
  });

  const mailResult = await smtpService.sendMail({
    to: params.email,
    recipientName: params.fullName,
    subject,
    html,
    tenantId: params.tenantId,
    noReply: true,
  });

  if (mailResult.success) {
    return {
      ok: true,
      emailDelivered: true,
      cooldownSeconds: SIGNUP_OTP_RESEND_COOLDOWN_SECONDS,
    };
  }

  if (isOtpDevFallbackEnabled()) {
    console.warn(`[OTP Dev Fallback] Signup verification code for ${params.email}: ${otpCode}`);
    return {
      ok: true,
      emailDelivered: false,
      devOtp: otpCode,
      cooldownSeconds: SIGNUP_OTP_RESEND_COOLDOWN_SECONDS,
    };
  }

  // Strict production mode: revoke un-dispatched code and fail cleanly without exposing OTP
  await prisma.refreshToken
    .update({
      where: { id: otpRecord.id },
      data: { revokedAt: new Date() },
    })
    .catch(() => {});

  return {
    ok: false,
    status: 503,
    message:
      mailResult.code === 'SMTP_NOT_CONFIGURED'
        ? 'Email verification is unavailable because email delivery is not configured.'
        : 'Unable to send your verification code right now. Please try again in a moment.',
  };
}

export const login = async (req: Request, res: Response) => {
  const parseResult = LoginSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      success: false,
      message: 'Please enter a valid email address and password (at least 6 characters).',
    });
  }

  const { email, password, rememberMe } = parseResult.data;

  const normalizedEmail = email.toLowerCase();

  // Find user in database
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail }
  });

  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'No account found matching this email address.'
    });
  }

  if (user.status === UserStatus.SUSPENDED) {
    return res.status(403).json({
      success: false,
      message: 'Your account has been suspended. Please contact your administrator.'
    });
  }

  // Password verification (bcrypt always in production; legacy plaintext check only in non-prod)
  const isMatch = user.passwordHash?.startsWith('$2')
    ? await bcrypt.compare(password, user.passwordHash)
    : process.env.NODE_ENV !== 'production' && user.passwordHash === password;
  if (!isMatch) {
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials. Please verify your password.'
    });
  }

  // Block login until signup email OTP verification is completed (checked after valid password)
  const pendingVerification = await isEmailPendingVerification(user.id, normalizedEmail);
  if (pendingVerification) {
    const tenantId = user.tenantId || `tenant_${user.id}`;
    const otpDispatch = await dispatchSignupOtp({
      userId: user.id,
      email: normalizedEmail,
      fullName: user.fullName,
      tenantId,
      brandName: user.agencyName || 'SquadPipe Staffing',
    });

    if (!otpDispatch.ok && otpDispatch.status !== 429) {
      return res.status(otpDispatch.status).json({
        success: false,
        message: otpDispatch.message,
      });
    }

    return res.status(403).json({
      success: false,
      code: 'EMAIL_VERIFICATION_REQUIRED',
      email: normalizedEmail,
      agencyName: user.agencyName,
      cooldownSeconds: otpDispatch.ok
        ? otpDispatch.cooldownSeconds
        : otpDispatch.retryAfterSeconds || SIGNUP_OTP_RESEND_COOLDOWN_SECONDS,
      ...(otpDispatch.ok && otpDispatch.devOtp ? { devOtp: otpDispatch.devOtp } : {}),
      message: 'Please verify your work email with the 6-digit code before signing in.',
    });
  }

  const persistent = rememberMe !== false;

  // Update last active timestamp and activate invited user on valid sign-in
  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      lastActiveAt: new Date(),
      ...(user.status === UserStatus.INVITED ? { status: UserStatus.ACTIVE } : {})
    }
  });

  const [session, refreshSessionData] = await Promise.all([
    buildSignedSessionPayload(updatedUser),
    issueSessionRefreshToken(updatedUser.id, persistent),
  ]);

  setSessionRefreshCookie(req, res, refreshSessionData.rawToken, persistent);

  res.json({
    success: true,
    message: `Welcome back, ${updatedUser.fullName}`,
    token: session.token,
    user: session.user,
  });
};

export const me = async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Unauthenticated' });
  }

  // Lightweight permission sync skips workload & settings queries using fresh req.user from authenticateJwt
  const isLite = req.query.lite === '1' || req.query.lite === 'true';
  if (isLite) {
    const liteTenantId = req.user.tenantId || 'squadpipe-agency';
    const [isSuperAdmin, settings] = await Promise.all([
      userService.isSuperAdmin(liteTenantId, req.user.id).catch(() => false),
      getTenantSettings(liteTenantId),
    ]);
    return res.json({
      success: true,
      user: {
        id: req.user.id,
        name: req.user.fullName,
        email: req.user.email,
        agencyName: settings.general.agencyName?.trim() || req.user.agencyName || 'SquadPipe Staffing',
        tenantId: req.user.tenantId,
        role: req.user.role,
        rateMasked: req.user.rateMasked,
        isSuperAdmin,
        isCurrentUser: true,
        onboardingCompleted: settings.general.onboardingCompleted !== false,
        lastActive: 'Active Now',
      },
    });
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.id }
  });

  if (!user) {
    return res.status(404).json({ success: false, message: 'User record not found' });
  }

  const tenantId = user.tenantId || req.user.tenantId;
  const [settings, liveWorkload, isSuperAdmin] = await Promise.all([
    getTenantSettings(tenantId),
    resolveUserLiveWorkload(user.id, tenantId, user.workload),
    userService.isSuperAdmin(tenantId, user.id).catch(() => false),
  ]);
  const resolvedAgencyName = settings.general.agencyName?.trim() || user.agencyName || 'SquadPipe Staffing';

  res.json({
    success: true,
    user: {
      id: user.id,
      name: user.fullName,
      email: user.email,
      agencyName: resolvedAgencyName,
      tenantId,
      role: user.role,
      desk: user.desk,
      rateMasked: user.rateMasked,
      workload: liveWorkload,
      status: user.status,
      isSuperAdmin,
      isCurrentUser: true,
      onboardingCompleted: settings.general.onboardingCompleted !== false,
      lastActive: 'Active Now'
    }
  });
};

export const refreshSession = async (req: Request, res: Response) => {
  try {
    const rawToken = getRefreshCookieFromRequest(req);
    const rotated = await rotateSessionRefreshToken(rawToken);

    if (!rotated.ok) {
      clearSessionRefreshCookie(req, res);
      if (rotated.reason === 'suspended') {
        return res.status(403).json({
          success: false,
          message: 'Account suspended. Contact your workspace administrator.',
        });
      }
      return res.status(401).json({
        success: false,
        message: 'Your session has expired. Please sign in again.',
      });
    }

    const session = await buildSignedSessionPayload(rotated.user);
    setSessionRefreshCookie(req, res, rotated.newRawToken, rotated.persistent);

    return res.json({
      success: true,
      token: session.token,
      user: session.user,
    });
  } catch (error) {
    console.error('Refresh session error:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to refresh your session right now. Please try again.',
    });
  }
};

export const logout = async (req: Request, res: Response) => {
  try {
    const rawRefreshToken = getRefreshCookieFromRequest(req);
    if (rawRefreshToken) {
      // Revoke only this browser/device refresh token so other active sessions remain signed in
      await revokeSessionRefreshToken(rawRefreshToken);
    } else if (req.user?.id) {
      await prisma.user.updateMany({
        where: { id: req.user.id },
        data: { tokenVersion: { increment: 1 } },
      });
    }
    clearSessionRefreshCookie(req, res);
    res.json({
      success: true,
      message: 'Signed out successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to revoke session' });
  }
};

export const updateProfile = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthenticated' });
    }
    const { name, fullName, email, desk, agencyName } = req.body;
    const nextName = fullName !== undefined || name !== undefined ? String(fullName || name || '').trim() : undefined;
    const nextEmail = email !== undefined ? String(email || '').trim().toLowerCase() : undefined;

    if (nextName !== undefined && !nextName) {
      return res.status(400).json({ success: false, message: 'Full name cannot be empty.' });
    }
    if (nextEmail !== undefined && (!nextEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail))) {
      return res.status(400).json({ success: false, message: 'Please provide a valid corporate email address.' });
    }

    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(nextName !== undefined ? { fullName: nextName } : {}),
        ...(nextEmail !== undefined ? { email: nextEmail } : {}),
        ...(desk !== undefined ? { desk: String(desk).trim() } : {}),
        ...(agencyName !== undefined ? { agencyName: String(agencyName).trim() } : {})
      }
    });
    const [liveWorkload, isSuperAdmin] = await Promise.all([
      resolveUserLiveWorkload(updated.id, updated.tenantId, updated.workload),
      userService.isSuperAdmin(updated.tenantId, updated.id).catch(() => false),
    ]);

    res.json({
      success: true,
      data: {
        id: updated.id,
        name: updated.fullName,
        email: updated.email,
        agencyName: updated.agencyName,
        tenantId: updated.tenantId,
        role: updated.role,
        desk: updated.desk,
        rateMasked: updated.rateMasked,
        workload: liveWorkload,
        status: updated.status,
        isSuperAdmin,
        isCurrentUser: true,
        lastActive: 'Active Now'
      }
    });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return res.status(409).json({
        success: false,
        message: 'An account with this email address already exists.',
      });
    }
    res.status(500).json({ success: false, message: error.message || 'Failed to update profile' });
  }
};

export const signup = async (req: Request, res: Response) => {
  try {
    const { fullName, email, password, desk, agencyName, companyName } = req.body;
    const resolvedCompanyInput = String(agencyName || companyName || '').trim();

    if (!fullName?.trim() || !resolvedCompanyInput || !email?.trim() || !password) {
      return res.status(400).json({
        success: false,
        message: 'Full name, company name, email, and password are required.'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(password, 10);
    const assignedDesk = desk?.trim() || 'US IT Contract (C2C & W2)';

    // Check if user already exists
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (existing) {
      const pendingExisting = await isEmailPendingVerification(existing.id, normalizedEmail);
      if (!pendingExisting) {
        return res.status(400).json({
          success: false,
          message: 'An account with this email address already exists. Please sign in.'
        });
      }

      // Allow restarting/resuming an unverified signup for the same email
      const updatedPendingUser = await prisma.user.update({
        where: { id: existing.id },
        data: {
          fullName: fullName.trim(),
          agencyName: resolvedCompanyInput,
          passwordHash,
          desk: assignedDesk,
        },
      });
      const existingTenantId = updatedPendingUser.tenantId || `tenant_${updatedPendingUser.id}`;
      await saveGeneralSettings(existingTenantId, {
        agencyName: resolvedCompanyInput,
        onboardingCompleted: false,
      }).catch(() => {});

      const otpResult = await dispatchSignupOtp({
        userId: updatedPendingUser.id,
        email: normalizedEmail,
        fullName: updatedPendingUser.fullName,
        tenantId: existingTenantId,
        brandName: resolvedCompanyInput,
        bypassCooldown: true,
      });

      if (!otpResult.ok) {
        return res.status(otpResult.status).json({
          success: false,
          message: otpResult.message,
        });
      }

      return res.status(200).json({
        success: true,
        requiresEmailVerification: true,
        email: normalizedEmail,
        agencyName: resolvedCompanyInput,
        emailDelivered: otpResult.emailDelivered,
        cooldownSeconds: otpResult.cooldownSeconds,
        ...(otpResult.devOtp ? { devOtp: otpResult.devOtp } : {}),
        message: otpResult.emailDelivered
          ? `Verification code sent to ${normalizedEmail}. Enter it below to activate your workspace.`
          : 'Email delivery unavailable in local mode — enter the preview verification code below to continue.',
      });
    }

    // Public self-signup creates an isolated tenant workspace owned by the registrant
    const assignedRole: UserRole = UserRole.ADMINISTRATOR;
    const rateMasked = false; // Owner/Admin of new tenant has unmasked rate view

    // Determine Tenant ID & Agency Name (domain auto-join disabled unless ALLOW_DEMO_DOMAIN_JOIN=true)
    const allowDemoDomainJoin = process.env.ALLOW_DEMO_DOMAIN_JOIN === 'true';
    const isDemoDomain =
      allowDemoDomainJoin && normalizedEmail.endsWith('@squadpipe-agency.com');
    const tenantId = isDemoDomain
      ? 'squadpipe-agency'
      : `tenant_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
    const resolvedAgencyName = resolvedCompanyInput;

    // Create pending user in database alongside unverified email sentinel
    const user = await prisma.user.create({
      data: {
        fullName: fullName.trim(),
        email: normalizedEmail,
        passwordHash,
        agencyName: resolvedAgencyName,
        tenantId,
        role: assignedRole,
        desk: assignedDesk,
        rateMasked,
        status: UserStatus.ACTIVE,
        workload: '0 Reqs • 0 Subs • 0 Placements',
        lastActiveAt: new Date()
      }
    });

    await prisma.refreshToken.create({
      data: {
        token: `${SIGNUP_UNVERIFIED_PREFIX}${normalizedEmail}`,
        userId: user.id,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    await saveGeneralSettings(tenantId, {
      agencyName: resolvedAgencyName,
      onboardingCompleted: false,
    }).catch(() => { });

    const otpResult = await dispatchSignupOtp({
      userId: user.id,
      email: normalizedEmail,
      fullName: user.fullName,
      tenantId,
      brandName: resolvedAgencyName,
      bypassCooldown: true,
    });

    if (!otpResult.ok) {
      // Clean up uncommitted signup in strict production mode when SMTP fails
      await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
      await prisma
        .$executeRawUnsafe(`DELETE FROM tenant_settings WHERE tenant_id = $1`, tenantId)
        .catch(() => {});
      return res.status(otpResult.status).json({
        success: false,
        message: otpResult.message,
      });
    }

    res.status(201).json({
      success: true,
      requiresEmailVerification: true,
      email: normalizedEmail,
      agencyName: resolvedAgencyName,
      emailDelivered: otpResult.emailDelivered,
      cooldownSeconds: otpResult.cooldownSeconds,
      ...(otpResult.devOtp ? { devOtp: otpResult.devOtp } : {}),
      message: otpResult.emailDelivered
        ? `Verification code sent to ${normalizedEmail}. Enter it below to activate your workspace.`
        : 'Email delivery unavailable in local mode — enter the preview verification code below to continue.',
    });
  } catch (error: any) {
    console.error('Signup error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create account. Please try again.'
    });
  }
};

export const resendSignupOtp = async (req: Request, res: Response) => {
  try {
    const normalizedEmail = String(req.body?.email || '').trim().toLowerCase();
    if (!normalizedEmail) {
      return res.status(400).json({
        success: false,
        message: 'Email address is required.',
      });
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user || user.status === UserStatus.SUSPENDED) {
      return res.json({
        success: true,
        cooldownSeconds: SIGNUP_OTP_RESEND_COOLDOWN_SECONDS,
        message: 'If your signup is pending verification, a fresh code has been sent.',
      });
    }

    const pending = await isEmailPendingVerification(user.id, normalizedEmail);
    if (!pending) {
      return res.status(400).json({
        success: false,
        message: 'This email is already verified. Please sign in.',
      });
    }

    const tenantId = user.tenantId || `tenant_${user.id}`;
    const otpResult = await dispatchSignupOtp({
      userId: user.id,
      email: normalizedEmail,
      fullName: user.fullName,
      tenantId,
      brandName: user.agencyName || 'SquadPipe Staffing',
    });

    if (!otpResult.ok) {
      return res.status(otpResult.status).json({
        success: false,
        code: otpResult.code,
        retryAfterSeconds: otpResult.retryAfterSeconds,
        message: otpResult.message,
      });
    }

    return res.json({
      success: true,
      emailDelivered: otpResult.emailDelivered,
      cooldownSeconds: otpResult.cooldownSeconds,
      ...(otpResult.devOtp ? { devOtp: otpResult.devOtp } : {}),
      message: otpResult.emailDelivered
        ? `A new 6-digit verification code has been sent to ${normalizedEmail}.`
        : 'Email delivery unavailable in local mode — use the updated verification code below.',
    });
  } catch (error: any) {
    console.error('Resend signup OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resend verification code.',
    });
  }
};

export const verifySignupOtp = async (req: Request, res: Response) => {
  try {
    const normalizedEmail = String(req.body?.email || '').trim().toLowerCase();
    const suppliedCode = String(req.body?.code || req.body?.otpCode || req.body?.resetCode || '').trim();

    if (!normalizedEmail || !suppliedCode) {
      return res.status(400).json({
        success: false,
        message: 'Email and 6-digit verification code are required.',
      });
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user || user.status === UserStatus.SUSPENDED) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification code.',
      });
    }

    const tokenRecord = await prisma.refreshToken.findFirst({
      where: {
        userId: user.id,
        token: `${SIGNUP_OTP_PREFIX}${normalizedEmail}_${suppliedCode}`,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (!tokenRecord) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification code.',
      });
    }

    const [verifiedUser] = await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          status: UserStatus.ACTIVE,
          lastActiveAt: new Date(),
        },
      }),
      prisma.refreshToken.updateMany({
        where: {
          userId: user.id,
          OR: [
            { token: { startsWith: `${SIGNUP_OTP_PREFIX}${normalizedEmail}_` } },
            { token: `${SIGNUP_UNVERIFIED_PREFIX}${normalizedEmail}` },
          ],
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      }),
    ]);

    const allowDemoDomainJoin = process.env.ALLOW_DEMO_DOMAIN_JOIN === 'true';
    const isDemoDomain =
      allowDemoDomainJoin && normalizedEmail.endsWith('@squadpipe-agency.com');

    const [session, refreshSessionData] = await Promise.all([
      buildSignedSessionPayload(verifiedUser, { isSuperAdminOverride: !isDemoDomain }),
      issueSessionRefreshToken(verifiedUser.id, true),
    ]);

    setSessionRefreshCookie(req, res, refreshSessionData.rawToken, true);

    res.json({
      success: true,
      message: `Email verified! Let’s finish setting up ${session.resolvedAgencyName}.`,
      token: session.token,
      user: session.user,
    });
  } catch (error: any) {
    console.error('Verify signup OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify code. Please try again.',
    });
  }
};

export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Please provide your registered corporate email.'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    // Generic response prevents account email enumeration while blocking reset bypass before email verification
    if (!user || user.status === UserStatus.SUSPENDED || (await isEmailPendingVerification(user.id, normalizedEmail))) {
      return res.json({
        success: true,
        message: 'If an account is registered for that email address, a verification code has been dispatched.'
      });
    }

    // Enforce 2-minute resend cooldown on backend
    const latestOtp = await prisma.refreshToken.findFirst({
      where: {
        userId: user.id,
        token: { startsWith: `reset_${normalizedEmail}_` },
        revokedAt: null
      },
      orderBy: { createdAt: 'desc' }
    });

    if (latestOtp) {
      const elapsedMs = Date.now() - latestOtp.createdAt.getTime();
      const cooldownMs = OTP_RESEND_COOLDOWN_SECONDS * 1000;
      if (elapsedMs < cooldownMs) {
        const retryAfterSeconds = Math.ceil((cooldownMs - elapsedMs) / 1000);
        return res.status(429).json({
          success: false,
          code: 'OTP_COOLDOWN',
          retryAfterSeconds,
          message: `Please wait ${retryAfterSeconds}s before requesting a new verification code.`
        });
      }
    }

    // Cryptographically random 6-digit verification security code
    const resetCode = crypto.randomInt(100000, 1000000).toString();
    const tokenKey = `reset_${normalizedEmail}_${resetCode}`;

    // Revoke earlier unused reset codes for this user
    await prisma.refreshToken.updateMany({
      where: {
        userId: user.id,
        token: { startsWith: `reset_${normalizedEmail}_` },
        revokedAt: null
      },
      data: { revokedAt: new Date() }
    });

    await prisma.refreshToken.create({
      data: {
        token: tokenKey,
        userId: user.id,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000)
      }
    });

    const tenantId = user.tenantId || 'squadpipe-agency';
    const settings = await getTenantSettings(tenantId);
    const brandName = (
      settings.general.agencyName ||
      settings.general.legalEntityName ||
      user.agencyName ||
      'Workspace'
    ).trim();

    const { subject, html } = renderOtpEmail({
      brandName,
      recipientName: user.fullName,
      otpCode: resetCode,
      expiresMinutes: 15
    });

    const mailResult = await smtpService.sendMail({
      to: normalizedEmail,
      recipientName: user.fullName,
      subject,
      html,
      tenantId,
      noReply: true,
    });

    if (!mailResult.success) {
      res.status(503).json({
        success: false,
        message:
          mailResult.code === 'SMTP_NOT_CONFIGURED'
            ? 'Password reset email is not set up for this workspace yet. Please ask your administrator for help.'
            : 'Unable to send the verification email right now. Please try again later.'
      });
      return;
    }

    res.json({
      success: true,
      cooldownSeconds: OTP_RESEND_COOLDOWN_SECONDS,
      message: 'If an account is registered for that email address, a verification code has been dispatched.'
    });
  } catch (error: any) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initiate password reset.'
    });
  }
};

export const verifyResetOtp = async (req: Request, res: Response) => {
  try {
    const { email, resetCode, code } = req.body;
    const suppliedCode = String(resetCode || code || '').trim();

    if (!email || !suppliedCode) {
      return res.status(400).json({
        success: false,
        message: 'Email and 6-digit verification code are required.'
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (!user || user.status === UserStatus.SUSPENDED) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification code.'
      });
    }

    const tokenRecord = await prisma.refreshToken.findFirst({
      where: {
        userId: user.id,
        token: `reset_${normalizedEmail}_${suppliedCode}`,
        revokedAt: null,
        expiresAt: { gt: new Date() }
      }
    });

    if (!tokenRecord) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification code.'
      });
    }

    const resetSessionToken = crypto.randomBytes(32).toString('base64url');
    const sessionKey = `resetsess_${normalizedEmail}_${resetSessionToken}`;

    await prisma.$transaction([
      prisma.refreshToken.update({
        where: { id: tokenRecord.id },
        data: { revokedAt: new Date() }
      }),
      prisma.refreshToken.updateMany({
        where: {
          userId: user.id,
          token: { startsWith: `resetsess_${normalizedEmail}_` },
          revokedAt: null
        },
        data: { revokedAt: new Date() }
      }),
      prisma.refreshToken.create({
        data: {
          token: sessionKey,
          userId: user.id,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000)
        }
      })
    ]);

    res.json({
      success: true,
      resetToken: resetSessionToken,
      message: 'Verification code confirmed. You may now set your new password.'
    });
  } catch (error: any) {
    console.error('Verify reset OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify code.'
    });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { email, resetToken, resetCode, code, newPassword } = req.body;
    const suppliedResetToken = String(resetToken || '').trim();
    const suppliedCode = String(resetCode || code || '').trim();

    if (!email || !newPassword || (!suppliedResetToken && !suppliedCode)) {
      return res.status(400).json({
        success: false,
        message: 'Email, verified session or code, and new password are required.'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long.'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No account found matching this email.'
      });
    }

    const expectedToken = suppliedResetToken
      ? `resetsess_${normalizedEmail}_${suppliedResetToken}`
      : `reset_${normalizedEmail}_${suppliedCode}`;

    const tokenRecord = await prisma.refreshToken.findFirst({
      where: {
        userId: user.id,
        token: expectedToken,
        revokedAt: null,
        expiresAt: { gt: new Date() }
      }
    });

    if (!tokenRecord) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset verification session. Please request a new code.'
      });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          tokenVersion: { increment: 1 },
          ...(user.status === UserStatus.INVITED ? { status: UserStatus.ACTIVE } : {})
        }
      }),
      prisma.refreshToken.update({
        where: { id: tokenRecord.id },
        data: { revokedAt: new Date() }
      })
    ]);

    await revokeAllUserSessions(user.id);

    res.json({
      success: true,
      message: 'Your password has been reset successfully. Please sign in with your new credentials.'
    });
  } catch (error: any) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update password.'
    });
  }
};

export const getInviteDetails = async (req: Request, res: Response) => {
  try {
    const rawToken = String(req.params.token || '').trim();
    if (!rawToken) {
      return res.status(400).json({
        success: false,
        message: 'Invitation token is required.'
      });
    }

    const tokenRecord = await prisma.refreshToken.findFirst({
      where: {
        token: `invite_${rawToken}`,
        revokedAt: null,
        expiresAt: { gt: new Date() }
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            agencyName: true,
            role: true,
            desk: true,
            status: true
          }
        }
      }
    });

    if (!tokenRecord || !tokenRecord.user || tokenRecord.user.status === UserStatus.SUSPENDED) {
      return res.status(400).json({
        success: false,
        message: 'This invitation link is invalid or has expired.'
      });
    }

    res.json({
      success: true,
      data: {
        email: tokenRecord.user.email,
        fullName: tokenRecord.user.fullName,
        agencyName: tokenRecord.user.agencyName,
        role: tokenRecord.user.role,
        desk: tokenRecord.user.desk
      }
    });
  } catch (error: any) {
    console.error('Get invite details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify invitation link.'
    });
  }
};

export const acceptInvite = async (req: Request, res: Response) => {
  try {
    const { token: rawToken, fullName, password } = req.body;
    const inviteToken = String(rawToken || '').trim();

    if (!inviteToken || !password) {
      return res.status(400).json({
        success: false,
        message: 'Invitation token and password are required.'
      });
    }

    if (String(password).length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.'
      });
    }

    const tokenRecord = await prisma.refreshToken.findFirst({
      where: {
        token: `invite_${inviteToken}`,
        revokedAt: null,
        expiresAt: { gt: new Date() }
      },
      include: { user: true }
    });

    if (!tokenRecord || !tokenRecord.user || tokenRecord.user.status === UserStatus.SUSPENDED) {
      return res.status(400).json({
        success: false,
        message: 'This invitation link is invalid or has expired.'
      });
    }

    const user = tokenRecord.user;
    const resolvedName = String(fullName || user.fullName || 'Team Member').trim();
    const passwordHash = await bcrypt.hash(String(password), 12);

    const [updatedUser] = await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          fullName: resolvedName,
          passwordHash,
          status: UserStatus.ACTIVE,
          lastActiveAt: new Date(),
          tokenVersion: { increment: 1 }
        }
      }),
      prisma.refreshToken.update({
        where: { id: tokenRecord.id },
        data: { revokedAt: new Date() }
      })
    ]);

    await revokeAllUserSessions(user.id);

    const [session, refreshSessionData] = await Promise.all([
      buildSignedSessionPayload(updatedUser),
      issueSessionRefreshToken(updatedUser.id, true),
    ]);

    setSessionRefreshCookie(req, res, refreshSessionData.rawToken, true);

    res.json({
      success: true,
      message: `Welcome to ${session.resolvedAgencyName}, ${updatedUser.fullName}!`,
      token: session.token,
      user: session.user,
    });
  } catch (error: any) {
    console.error('Accept invite error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete onboarding. Please try again.'
    });
  }
};

