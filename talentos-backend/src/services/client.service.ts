import { prisma } from '../config/prisma.config';
import { Prisma } from '@prisma/client';

export class ClientService {
  async getClients() {
    return prisma.client.findMany({
      include: {
        contacts: true,
        requirements: {
          select: { id: true, code: true, opportunityTitle: true, status: true }
        },
        placements: {
          select: { id: true, resourceName: true, skillRole: true, status: true, billRate: true }
        }
      },
      orderBy: { name: 'asc' }
    });
  }

  async getClientById(id: string) {
    return prisma.client.findUnique({
      where: { id },
      include: {
        contacts: true,
        requirements: true,
        placements: true
      }
    });
  }

  async createClient(data: Prisma.ClientCreateInput) {
    return prisma.client.create({ data });
  }

  async getVendors() {
    return prisma.vendor.findMany({
      include: {
        placements: {
          select: { id: true, resourceName: true, customer: true, status: true }
        }
      },
      orderBy: { name: 'asc' }
    });
  }

  async createVendor(data: Prisma.VendorCreateInput) {
    return prisma.vendor.create({ data });
  }
}

export const clientService = new ClientService();

