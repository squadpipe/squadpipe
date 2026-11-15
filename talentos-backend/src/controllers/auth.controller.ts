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
import { renderOtpEmail } from '../services/emailTemplate.service';

const OTP_RESEND_COOLDOWN_SECONDS = 120;

export const login = async (req: Request, res: Response) => {
  const parseResult = LoginSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      success: false,
      message: 'Invalid login payload',
      errors: parseResult.error.flatten()
    });
  }

  const { email, password } = parseResult.data;

  // Find user in database
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() }
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

  const tenantId = user.tenantId || `tenant_${user.id}`;
  const settings = await getTenantSettings(tenantId);
  const resolvedAgencyName = settings.general.agencyName?.trim() || user.agencyName || 'TalentOS Staffing';

  // Build authenticated payload
  const authPayload: AuthenticatedUser = {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    agencyName: resolvedAgencyName,
    tenantId,
    role: user.role,
    rateMasked: user.rateMasked,
    tokenVersion: user.tokenVersion
  };

  const token = jwt.sign(authPayload, getJwtAccessSecret(), {
    expiresIn: getJwtAccessExpiry() as jwt.SignOptions['expiresIn']
  });

  // Update last active timestamp and activate invited user on valid sign-in
  await prisma.user.update({
    where: { id: user.id },
    data: {
      lastActiveAt: new Date(),
      ...(user.status === UserStatus.INVITED ? { status: UserStatus.ACTIVE } : {})
    }
  });

  res.json({
    success: true,
    message: `Welcome back, ${user.fullName}`,
    token,
    user: {
      id: user.id,
      name: user.fullName,
      email: user.email,
      agencyName: resolvedAgencyName,
      tenantId: authPayload.tenantId,
      role: user.role,
      desk: user.desk,
      rateMasked: user.rateMasked,
      workload: user.workload,
      status: user.status,
      isCurrentUser: true,
      lastActive: 'Active Now'
    }
  });
};

export const me = async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Unauthenticated' });
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.id }
  });

  if (!user) {
    return res.status(404).json({ success: false, message: 'User record not found' });
  }

  const tenantId = user.tenantId || req.user.tenantId;
  const settings = await getTenantSettings(tenantId);
  const resolvedAgencyName = settings.general.agencyName?.trim() || user.agencyName || 'TalentOS Staffing';

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
      workload: user.workload,
      status: user.status,
      isCurrentUser: true,
      lastActive: 'Active Now'
    }
  });
};

export const logout = async (req: Request, res: Response) => {
  try {
    if (req.user?.id) {
      await prisma.user.updateMany({
        where: { id: req.user.id },
        data: { tokenVersion: { increment: 1 } }
      });
    }
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
    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(fullName || name ? { fullName: String(fullName || name).trim() } : {}),
        ...(email ? { email: String(email).trim().toLowerCase() } : {}),
        ...(desk ? { desk: String(desk).trim() } : {}),
        ...(agencyName ? { agencyName: String(agencyName).trim() } : {})
      }
    });
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
        workload: updated.workload,
        status: updated.status,
        isCurrentUser: true,
        lastActive: 'Active Now'
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to update profile' });
  }
};

export const signup = async (req: Request, res: Response) => {
  try {
    const { fullName, email, password, role, desk, agencyName, companyName } = req.body;
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

    // Check if user already exists
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email address already exists. Please sign in.'
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Public self-signup creates an isolated tenant workspace owned by the registrant
    const assignedRole: UserRole = UserRole.ADMINISTRATOR;
    const assignedDesk = desk?.trim() || 'US IT Contract (C2C & W2)';
    const rateMasked = false; // Owner/Admin of new tenant has unmasked rate view

    // Determine Tenant ID & Agency Name (domain auto-join disabled unless ALLOW_DEMO_DOMAIN_JOIN=true)
    const allowDemoDomainJoin = process.env.ALLOW_DEMO_DOMAIN_JOIN === 'true';
    const isDemoDomain = allowDemoDomainJoin && normalizedEmail.endsWith('@talentos-agency.com');
    const tenantId = isDemoDomain
      ? 'talentos-agency'
      : `tenant_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
    const resolvedAgencyName = resolvedCompanyInput;

    // Create user in database
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
        workload: '0 Requisitions • 0 Submissions',
        lastActiveAt: new Date()
      }
    });

    const authPayload: AuthenticatedUser = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      agencyName: user.agencyName,
      tenantId: user.tenantId,
      role: user.role,
      rateMasked: user.rateMasked,
      tokenVersion: user.tokenVersion
    };

    const token = jwt.sign(authPayload, getJwtAccessSecret(), {
      expiresIn: getJwtAccessExpiry() as jwt.SignOptions['expiresIn']
    });

    await saveGeneralSettings(tenantId, { agencyName: resolvedAgencyName }).catch(() => {});

    res.status(201).json({
      success: true,
      message: `Account created successfully! Welcome to ${user.agencyName}, ${user.fullName}.`,
      token,
      user: {
        id: user.id,
        name: user.fullName,
        email: user.email,
        agencyName: user.agencyName,
        tenantId: user.tenantId,
        role: user.role,
        desk: user.desk,
        rateMasked: user.rateMasked,
        workload: user.workload,
        status: user.status,
        isCurrentUser: true,
        lastActive: 'Active Now'
      }
    });
  } catch (error: any) {
    console.error('Signup error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create account. Please try again.'
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

    // Generic response prevents account email enumeration while still dispatching valid requests
    if (!user || user.status === UserStatus.SUSPENDED) {
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

    const tenantId = user.tenantId || 'talentos-agency';
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
      tenantId
    });

    if (!mailResult.success) {
      res.status(503).json({
        success: false,
        message:
          mailResult.code === 'SMTP_NOT_CONFIGURED'
            ? 'Password reset email service is not configured on the server. Please configure SMTP_* environment variables.'
            : 'Unable to send password reset email right now. Please try again later.'
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

    const tenantId = updatedUser.tenantId || `tenant_${updatedUser.id}`;
    const settings = await getTenantSettings(tenantId);
    const resolvedAgencyName =
      settings.general.agencyName?.trim() || updatedUser.agencyName || 'TalentOS Staffing';

    const authPayload: AuthenticatedUser = {
      id: updatedUser.id,
      email: updatedUser.email,
      fullName: updatedUser.fullName,
      agencyName: resolvedAgencyName,
      tenantId,
      role: updatedUser.role,
      rateMasked: updatedUser.rateMasked,
      tokenVersion: updatedUser.tokenVersion
    };

    const accessToken = jwt.sign(authPayload, getJwtAccessSecret(), {
      expiresIn: getJwtAccessExpiry() as jwt.SignOptions['expiresIn']
    });

    res.json({
      success: true,
      message: `Welcome to ${resolvedAgencyName}, ${updatedUser.fullName}!`,
      token: accessToken,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        fullName: updatedUser.fullName,
        agencyName: resolvedAgencyName,
        tenantId,
        role: updatedUser.role,
        desk: updatedUser.desk,
        rateMasked: updatedUser.rateMasked,
        status: updatedUser.status
      }
    });
  } catch (error: any) {
    console.error('Accept invite error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete onboarding. Please try again.'
    });
  }
};

