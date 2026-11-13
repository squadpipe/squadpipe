import { prisma } from '../config/prisma.config';
import { UserStatus, UserRole, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';

export class UserService {
  async getUsers(tenantId?: string) {
    const where: Prisma.UserWhereInput = {};
    if (tenantId) where.tenantId = tenantId;

    return prisma.user.findMany({
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
        createdAt: true
      },
      orderBy: { createdAt: 'asc' }
    });
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

