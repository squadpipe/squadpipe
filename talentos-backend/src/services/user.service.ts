import { prisma } from '../config/prisma.config';
import { UserStatus, UserRole, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { smtpService } from './smtp.service';
import { escapeHtml } from '../utils/cryptoSecret';

export interface UserFilterParams {
  search?: string;
  role?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export class UserService {
  async getUsers(tenantId?: string, params: UserFilterParams = {}) {
    const where: Prisma.UserWhereInput = {};
    if (tenantId) where.tenantId = tenantId;

    const q = params.search ? String(params.search).trim() : '';
    if (q) {
      where.OR = [
        { fullName: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { desk: { contains: q, mode: 'insensitive' } },
      ];
    }

    if (params.role && params.role !== 'All' && params.role !== 'ALL') {
      const roleUpper = String(params.role).toUpperCase().replace(/[\s-]/g, '_');
      if (Object.values(UserRole).includes(roleUpper as UserRole)) {
        where.role = roleUpper as UserRole;
      }
    }

    if (params.status && params.status !== 'All' && params.status !== 'ALL') {
      const statusUpper = String(params.status).toUpperCase().replace(/[\s-]/g, '_');
      if (Object.values(UserStatus).includes(statusUpper as UserStatus)) {
        where.status = statusUpper as UserStatus;
      }
    }

    const select = {
      id: true,
      email: true,
      fullName: true,
      agencyName: true,
      tenantId: true,
      role: true,
      desk: true,
      rateMasked: true,
      status: true,
      workload: true,
      lastActiveAt: true,
      createdAt: true
    };

    const hasPagination = params.page !== undefined || params.limit !== undefined;
    if (!hasPagination) {
      const data = await prisma.user.findMany({
        where,
        select,
        orderBy: { createdAt: 'asc' }
      });
      return {
        data,
        pagination: { page: 1, limit: data.length || 10, total: data.length, totalPages: 1 }
      };
    }

    const page = params.page ? Math.max(1, params.page) : 1;
    const limit = params.limit ? Math.max(1, Math.min(100, params.limit)) : 10;
    const [total, data] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        select,
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit
      })
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit))
      }
    };
  }

  async getUserById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        fullName: true,
        agencyName: true,
        tenantId: true,
        role: true,
        desk: true,
        rateMasked: true,
        status: true,
        workload: true
      }
    });
  }

  async toggleRateMask(id: string, tenantId: string) {
    const user = await prisma.user.findFirst({ where: { id, tenantId } });
    if (!user) throw new Error('User not found');

    return prisma.user.update({
      where: { id: user.id },
      data: { rateMasked: !user.rateMasked },
      select: { id: true, fullName: true, rateMasked: true }
    });
  }

  async inviteUser(
    data: { fullName?: string; name?: string; email: string; role: any; desk?: string; rateMasked?: boolean },
    tenantId: string = 'talentos-agency',
    agencyName?: string
  ) {
    const normalizedEmail = String(data.email || '').trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      throw new Error('A valid corporate email address is required.');
    }

    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      throw new Error('A user with this email address already exists.');
    }

    // Cryptographically random temporary credential (never static default password)
    const temporaryRandomSecret = crypto.randomBytes(24).toString('base64url');
    const tempPasswordHash = await bcrypt.hash(temporaryRandomSecret, 12);
    const setupCode = crypto.randomInt(100000, 1000000).toString();
    const resolvedName = (data.fullName || data.name || 'Team Member').trim();
    const resolvedAgencyName = agencyName || 'TalentOS Staffing';
    const roleUpper = String(data.role || 'TECHNICAL_RECRUITER').toUpperCase().replace(/[\s-]/g, '_');
    const validRole = Object.values(UserRole).includes(roleUpper as UserRole)
      ? (roleUpper as UserRole)
      : UserRole.TECHNICAL_RECRUITER;

    const invitedUser = await prisma.user.create({
      data: {
        fullName: resolvedName,
        email: normalizedEmail,
        passwordHash: tempPasswordHash,
        tenantId,
        agencyName: resolvedAgencyName,
        role: validRole,
        desk: data.desk?.trim() || 'US IT Contract (C2C & W2)',
        rateMasked: data.rateMasked !== undefined ? Boolean(data.rateMasked) : true,
        status: UserStatus.INVITED,
        workload: 'Intake Queue Pending'
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        agencyName: true,
        tenantId: true,
        role: true,
        desk: true,
        rateMasked: true,
        status: true,
        workload: true,
        createdAt: true
      }
    });

    // Issue one-time 24h activation / password setup code and dispatch via workspace SMTP
    await prisma.refreshToken.create({
      data: {
        token: `reset_${normalizedEmail}_${setupCode}`,
        userId: invitedUser.id,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    await smtpService
      .sendMail({
        to: normalizedEmail,
        recipientName: resolvedName,
        subject: `You're invited to ${resolvedAgencyName} on TalentOS`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; line-height: 1.6; color: #1e293b;">
            <p>Hello ${escapeHtml(resolvedName)},</p>
            <p>You have been invited to join <strong>${escapeHtml(resolvedAgencyName)}</strong> as <strong>${escapeHtml(validRole.replace(/_/g, ' '))}</strong>.</p>
            <p>Use the one-time setup code below via <em>Forgot / Reset Password</em> on the sign-in screen to set your password (valid for 24 hours):</p>
            <p style="font-size: 20px; font-weight: 700; letter-spacing: 2px; color: #2563eb;">${setupCode}</p>
          </div>
        `,
        tenantId,
      })
      .catch((err) => {
        console.warn('Invite email dispatch warning:', err);
      });

    return invitedUser;
  }
}

export const userService = new UserService();

