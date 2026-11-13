import { prisma } from '../config/prisma.config';
import { UserStatus, Prisma } from '@prisma/client';
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
    data: { fullName: string; email: string; role: any; desk: string; rateMasked: boolean },
    tenantId: string = 'talentos-agency',
    agencyName?: string
  ) {
    const defaultPasswordHash = await bcrypt.hash('TalentOS@2026', 10);
    return prisma.user.create({
      data: {
        fullName: data.fullName,
        email: data.email.toLowerCase(),
        passwordHash: defaultPasswordHash,
        tenantId,
        agencyName: agencyName || 'TalentOS Staffing',
        role: data.role,
        desk: data.desk,
        rateMasked: data.rateMasked,
        status: UserStatus.INVITED,
        workload: 'Intake Queue Pending'
      }
    });
  }
}

export const userService = new UserService();

