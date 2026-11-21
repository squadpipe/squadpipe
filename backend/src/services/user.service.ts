import { prisma } from '../config/prisma.config';
import { UserStatus, UserRole, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { smtpService } from './smtp.service';
import { getTenantSettings } from '../config/smtp.config';
import { renderInviteEmail } from './emailTemplate.service';
import { analyticsService, formatLiveWorkloadText } from './analytics.service';
import {
  SortDirection,
  buildPrismaOrderBy,
  sortRecordsByColumn,
} from '../utils/tableSort';

export const USER_SORTABLE_FIELDS = [
  'fullName',
  'role',
  'desk',
  'workload',
  'rateMasked',
  'status',
  'createdAt',
] as const;

export interface UserFilterParams {
  search?: string;
  role?: string;
  status?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortDir?: SortDirection;
}

export class UserService {
  async resolveSuperAdminId(tenantId: string): Promise<string | null> {
    if (!tenantId) return null;
    const founderAdmin = await prisma.user.findFirst({
      where: {
        tenantId,
        role: UserRole.ADMINISTRATOR,
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true },
    });
    return founderAdmin?.id || null;
  }

  async isSuperAdmin(tenantId: string, userId: string): Promise<boolean> {
    if (!userId || !tenantId) return false;
    const superAdminId = await this.resolveSuperAdminId(tenantId);
    return superAdminId === userId;
  }

  private async issueAndSendInvite(
    user: {
      id: string;
      email: string;
      fullName: string;
      role: UserRole;
    },
    tenantId: string,
    resolvedAgencyName: string
  ): Promise<{
    inviteUrl: string;
    emailDelivered: boolean;
    emailError?: string;
  }> {
    const inviteToken = crypto.randomBytes(32).toString('base64url');
    const expiresHours = 24;

    await prisma.refreshToken.create({
      data: {
        token: `invite_${inviteToken}`,
        userId: user.id,
        expiresAt: new Date(Date.now() + expiresHours * 60 * 60 * 1000),
      },
    });

    const frontendBaseUrl = (
      process.env.FRONTEND_URL ||
      process.env.CORS_ORIGIN?.split(',')[0] ||
      'http://localhost:3000'
    )
      .trim()
      .replace(/\/+$/, '');
    const inviteUrl = `${frontendBaseUrl}/?inviteToken=${encodeURIComponent(inviteToken)}`;
    const roleLabel = user.role
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());

    const { subject, html } = renderInviteEmail({
      brandName: resolvedAgencyName,
      recipientName: user.fullName,
      roleLabel,
      inviteUrl,
      expiresHours,
    });

    const mailResult = await smtpService
      .sendMail({
        to: user.email,
        recipientName: user.fullName,
        subject,
        html,
        tenantId,
        noReply: true,
      })
      .catch((err) => {
        console.warn('Invite email dispatch warning:', err);
        return { success: false, error: err?.message || 'Failed to send invite email' };
      });

    if (!mailResult.success) {
      console.warn(`Invite email not dispatched for ${user.email}: ${mailResult.error}`);
    }

    return {
      inviteUrl,
      emailDelivered: Boolean(mailResult.success),
      emailError: mailResult.success ? undefined : mailResult.error,
    };
  }

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

    const enrichUsers = async (rows: Array<{ id: string; tenantId: string; workload: string | null;[k: string]: any }>) => {
      if (rows.length === 0) return rows;
      const scopeTenant = tenantId || rows[0].tenantId;
      const [workloads, superAdminId] = await Promise.all([
        analyticsService.getLiveWorkloadsMap(
          scopeTenant,
          rows.map((r) => r.id)
        ),
        this.resolveSuperAdminId(scopeTenant),
      ]);
      return rows.map((r) => {
        const live = workloads.get(r.id);
        return {
          ...r,
          isSuperAdmin: r.id === superAdminId,
          workload: live?.workloadText || formatLiveWorkloadText(0, 0, 0),
          metrics: live
            ? { openReqs: live.openReqs, submissions: live.submissions, placements: live.placements }
            : { openReqs: 0, submissions: 0, placements: 0 },
        };
      });
    };

    const hasPagination = params.page !== undefined || params.limit !== undefined;
    const page = params.page ? Math.max(1, params.page) : 1;
    const limit = params.limit ? Math.max(1, Math.min(100, params.limit)) : 10;

    if (params.sortBy === 'workload') {
      const rawUsers = await prisma.user.findMany({
        where,
        select,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      });
      const enrichedAll = await enrichUsers(rawUsers);
      const sorted = sortRecordsByColumn(enrichedAll, 'workload', params.sortDir || 'desc', {
        workload: (u) =>
          (u.metrics?.openReqs || 0) + (u.metrics?.submissions || 0) + (u.metrics?.placements || 0),
      });
      const total = sorted.length;
      const sliced = hasPagination ? sorted.slice((page - 1) * limit, page * limit) : sorted;
      return {
        data: sliced,
        pagination: {
          page: hasPagination ? page : 1,
          limit: hasPagination ? limit : sliced.length || 10,
          total,
          totalPages: hasPagination ? Math.max(1, Math.ceil(total / limit)) : 1,
        },
      };
    }

    const orderBy = buildPrismaOrderBy<Prisma.UserOrderByWithRelationInput>(
      params.sortBy,
      params.sortDir || 'desc',
      {
        fullName: (d) => [{ fullName: d }, { id: d }],
        role: (d) => [{ role: d }, { id: d }],
        desk: (d) => [{ desk: d }, { id: d }],
        rateMasked: (d) => [{ rateMasked: d }, { id: d }],
        status: (d) => [{ status: d }, { id: d }],
        createdAt: (d) => [{ createdAt: d }, { id: d }],
      },
      [{ createdAt: 'desc' }, { id: 'desc' }]
    ) as Prisma.UserOrderByWithRelationInput[];

    if (!hasPagination) {
      const data = await prisma.user.findMany({
        where,
        select,
        orderBy,
      });
      const enriched = await enrichUsers(data);
      return {
        data: enriched,
        pagination: { page: 1, limit: enriched.length || 10, total: enriched.length, totalPages: 1 }
      };
    }

    const [total, data] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        select,
        orderBy,
        skip: (page - 1) * limit,
        take: limit
      })
    ]);

    return {
      data: await enrichUsers(data),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit))
      }
    };
  }

  async getUserById(id: string, tenantId?: string) {
    const where: Prisma.UserWhereInput = { id };
    if (tenantId) where.tenantId = tenantId;

    const user = await prisma.user.findFirst({
      where,
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
        lastActiveAt: true,
        createdAt: true,
      },
    });
    if (!user) return null;

    const scopeTenant = tenantId || user.tenantId;
    const [workloads, superAdminId] = await Promise.all([
      analyticsService.getLiveWorkloadsMap(scopeTenant, [user.id]),
      this.resolveSuperAdminId(scopeTenant),
    ]);
    const live = workloads.get(user.id);

    return {
      ...user,
      isSuperAdmin: user.id === superAdminId,
      workload: live?.workloadText || formatLiveWorkloadText(0, 0, 0),
      metrics: live
        ? { openReqs: live.openReqs, submissions: live.submissions, placements: live.placements }
        : { openReqs: 0, submissions: 0, placements: 0 },
    };
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
    tenantId: string = 'squadpipe-agency',
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
    const resolvedName = (data.fullName || data.name || 'Team Member').trim();
    const settings = await getTenantSettings(tenantId);
    const resolvedAgencyName =
      settings.general.agencyName?.trim() || agencyName || 'SquadPipe Staffing';
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
        workload: '0 Reqs • 0 Subs • 0 Placements'
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

    const dispatch = await this.issueAndSendInvite(
      {
        id: invitedUser.id,
        email: normalizedEmail,
        fullName: resolvedName,
        role: validRole,
      },
      tenantId,
      resolvedAgencyName
    );

    return {
      ...invitedUser,
      isSuperAdmin: false,
      emailDelivered: dispatch.emailDelivered,
      emailError: dispatch.emailError,
      inviteUrl: dispatch.inviteUrl,
    };
  }

  async inviteUsersBatch(
    members: Array<{
      fullName?: string;
      name?: string;
      email: string;
      role: any;
      desk?: string;
      rateMasked?: boolean;
    }>,
    tenantId: string = 'squadpipe-agency',
    agencyName?: string
  ) {
    const cleanMembers = Array.isArray(members) ? members.slice(0, 25) : [];
    const results: Array<{
      index: number;
      email: string;
      ok: boolean;
      user?: Awaited<ReturnType<UserService['inviteUser']>>;
      inviteUrl?: string;
      emailDelivered?: boolean;
      error?: string;
    }> = [];

    for (let index = 0; index < cleanMembers.length; index++) {
      const entry = cleanMembers[index];
      const normalizedEmail = String(entry?.email || '').trim().toLowerCase();
      try {
        const invited = await this.inviteUser(entry, tenantId, agencyName);
        results.push({
          index,
          email: invited.email,
          ok: true,
          user: invited,
          inviteUrl: invited.inviteUrl,
          emailDelivered: invited.emailDelivered,
        });
      } catch (err: any) {
        results.push({
          index,
          email: normalizedEmail,
          ok: false,
          error: err?.message || 'Failed to invite user',
        });
      }
    }

    const created = results.filter((r) => r.ok && r.user).map((r) => r.user!);
    const failed = results
      .filter((r) => !r.ok)
      .map((r) => ({ index: r.index, email: r.email, error: r.error || 'Failed to invite user' }));

    return { results, created, failed };
  }

  async resendInvite(
    userId: string,
    tenantId: string = 'squadpipe-agency',
    agencyName?: string
  ) {
    const user = await prisma.user.findFirst({
      where: { id: userId, tenantId },
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
        createdAt: true,
      },
    });
    if (!user) {
      const err = new Error('User not found') as Error & { statusCode?: number };
      err.statusCode = 404;
      throw err;
    }
    if (user.status !== UserStatus.INVITED) {
      const err = new Error(
        user.status === UserStatus.ACTIVE
          ? 'This team member has already activated their account.'
          : 'Suspended users must be reactivated before sending an invitation.'
      ) as Error & { statusCode?: number };
      err.statusCode = 400;
      throw err;
    }

    // Revoke any previous unexpired invite links for this user before issuing a fresh link
    await prisma.refreshToken.updateMany({
      where: {
        userId: user.id,
        token: { startsWith: 'invite_' },
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    const settings = await getTenantSettings(tenantId);
    const resolvedAgencyName =
      settings.general.agencyName?.trim() || user.agencyName || agencyName || 'SquadPipe Staffing';

    const dispatch = await this.issueAndSendInvite(
      {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
      tenantId,
      resolvedAgencyName
    );

    return {
      user: {
        ...user,
        isSuperAdmin: false,
      },
      emailDelivered: dispatch.emailDelivered,
      emailError: dispatch.emailError,
      inviteUrl: dispatch.inviteUrl,
    };
  }
}

export const userService = new UserService();

