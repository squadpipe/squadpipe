import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/prisma.config';
import { LoginSchema } from '../dtos/auth.dto';
import { AuthenticatedUser } from '../middlewares/auth.middleware';
import { UserRole, UserStatus } from '@prisma/client';

const JWT_SECRET = process.env.JWT_ACCESS_SECRET || 'dev_secret_key';

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

  // Password verification (supports bcrypt hashed passwords or legacy direct match)
  const isMatch = user.passwordHash?.startsWith('$2')
    ? await bcrypt.compare(password, user.passwordHash)
    : user.passwordHash === password;
  if (!isMatch) {
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials. Please verify your password.'
    });
  }

  // Build authenticated payload
  const authPayload: AuthenticatedUser = {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    agencyName: user.agencyName || 'TalentOS Staffing',
    tenantId: user.tenantId || (user.email.endsWith('@talentos-agency.com') ? 'talentos-agency' : `tenant_${user.id}`),
    role: user.role,
    rateMasked: user.rateMasked
  };

  const token = jwt.sign(authPayload, JWT_SECRET, { expiresIn: '7d' });

  // Update last active timestamp
  await prisma.user.update({
    where: { id: user.id },
    data: { lastActiveAt: new Date() }
  });

  res.json({
    success: true,
    message: `Welcome back, ${user.fullName}`,
    token,
    user: {
      id: user.id,
      name: user.fullName,
      email: user.email,
      agencyName: user.agencyName || 'TalentOS Staffing',
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

  res.json({
    success: true,
    user: {
      id: user.id,
      name: user.fullName,
      email: user.email,
      agencyName: user.agencyName || 'TalentOS Staffing',
      tenantId: user.tenantId || req.user.tenantId,
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
  res.json({
    success: true,
    message: 'Signed out successfully'
  });
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
    const { fullName, email, password, role, desk, agencyName } = req.body;

    if (!fullName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Full name, email, and password are required.'
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

    // Map role string to UserRole enum
    let assignedRole: UserRole = UserRole.ADMINISTRATOR; // Default new registrant as Admin of their tenant
    if (role) {
      const upper = String(role).toUpperCase().replace(/[\s-]/g, '_');
      if (Object.values(UserRole).includes(upper as UserRole)) {
        assignedRole = upper as UserRole;
      }
    }

    const assignedDesk = desk?.trim() || 'US IT Contract (C2C & W2)';
    const rateMasked = false; // Owner/Admin of new tenant has unmasked rate view

    // Determine Tenant ID & Agency Name
    const isDemoDomain = normalizedEmail.endsWith('@talentos-agency.com');
    const tenantId = isDemoDomain
      ? 'talentos-agency'
      : `tenant_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    const resolvedAgencyName = agencyName?.trim() || (isDemoDomain ? 'TalentOS Staffing' : `${fullName.trim()} Agency`);

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
      rateMasked: user.rateMasked
    };

    const token = jwt.sign(authPayload, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      success: true,
      message: `Account created successfully! Welcome to TalentOS, ${user.fullName}.`,
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

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No account registered with this email address.'
      });
    }

    // Generate a 6-digit verification security code and persist it
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const tokenKey = `reset_${normalizedEmail}_${resetCode}`;

    await prisma.refreshToken.create({
      data: {
        token: tokenKey,
        userId: user.id,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000)
      }
    });

    await prisma.emailLog.create({
      data: {
        tenantId: user.tenantId || 'talentos-agency',
        recipientEmail: normalizedEmail,
        recipientName: user.fullName,
        subject: 'TalentOS Password Reset Verification Code',
        bodyHtml: `<p>Your TalentOS password reset verification code is: <strong>${resetCode}</strong> (valid for 15 minutes).</p>`,
        status: 'SENT',
        sentAt: new Date()
      }
    });

    res.json({
      success: true,
      message: `Password reset verification code dispatched to ${normalizedEmail}.`,
      resetCode // returned for convenience when SMTP is unconfigured
    });
  } catch (error: any) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initiate password reset.'
    });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { email, resetCode, code, newPassword } = req.body;
    const suppliedCode = String(resetCode || code || '').trim();

    if (!email || !newPassword || !suppliedCode) {
      return res.status(400).json({
        success: false,
        message: 'Email, verification code, and new password are required.'
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
        message: 'Invalid or expired reset verification code.'
      });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash }
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

