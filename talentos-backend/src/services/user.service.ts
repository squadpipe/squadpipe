import { prisma } from '../config/prisma.config';
import { UserStatus, UserRole, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';

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

  async toggleRateMask(id: string) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new Error('User not found');

    return prisma.user.update({
      where: { id },
      data: { rateMasked: !user.rateMasked },
      select: { id: true, fullName: true, rateMasked: true }
    });
  }

  async inviteUser(
    data: { fullName?: string; name?: string; email: string; role: any; desk?: string; rateMasked?: boolean },
    tenantId: string = 'talentos-agency',
    agencyName?: string
  ) {
    const defaultPasswordHash = await bcrypt.hash('TalentOS@2026', 10);
    const resolvedName = (data.fullName || data.name || 'Team Member').trim();
    const roleUpper = String(data.role || 'TECHNICAL_RECRUITER').toUpperCase().replace(/[\s-]/g, '_');
    const validRole = Object.values(UserRole).includes(roleUpper as UserRole)
      ? (roleUpper as UserRole)
      : UserRole.TECHNICAL_RECRUITER;

    return prisma.user.create({
      data: {
        fullName: resolvedName,
        email: data.email.trim().toLowerCase(),
        passwordHash: defaultPasswordHash,
        tenantId,
        agencyName: agencyName || 'TalentOS Staffing',
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
  }
}

export const userService = new UserService();

