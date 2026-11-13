import { prisma } from '../config/prisma.config';
import { Prisma } from '@prisma/client';

export class ClientService {
  async getClients(tenantId?: string) {
    const where: Prisma.ClientWhereInput = {};
    if (tenantId) where.tenantId = tenantId;

    return prisma.client.findMany({
      where,
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

  async getClientById(id: string, tenantId?: string) {
    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        contacts: true,
        requirements: true,
        placements: true
      }
    });
    if (client && tenantId && client.tenantId !== tenantId) return null;
    return client;
  }

  async createClient(raw: any, tenantId: string = 'talentos-agency') {
    const name = raw.name?.trim() || 'New Client Enterprise';
    const website = raw.website?.trim() || 'https://company.com';
    const boardNumber = raw.boardNumber || raw.phone || '+1 (800) 000-0000';
    const location = raw.location?.trim() || 'US Nationwide';

    let contactsCreate: any[] = [];
    if (Array.isArray(raw.contacts) && raw.contacts.length > 0) {
      contactsCreate = raw.contacts.map((c: any) => ({
        fullName: c.fullName || c.name || 'Primary Hiring Lead',
        designation: c.designation || 'Hiring Lead',
        email: c.email || 'lead@client.com',
        phone: c.phone || '+1 (800) 000-0000',
        isPrimary: c.isPrimary ?? true
      }));
    } else if (raw.contactName || raw.email) {
      contactsCreate = [{
        fullName: raw.contactName?.trim() || 'Primary Hiring Lead',
        designation: raw.designation?.trim() || 'Hiring Lead',
        email: raw.email?.trim() || 'lead@client.com',
        phone: raw.directPhone?.trim() || raw.phone?.trim() || '+1 (800) 000-0000',
        isPrimary: true
      }];
    } else {
      contactsCreate = [{
        fullName: 'Primary Hiring Lead',
        designation: 'Engineering Director',
        email: 'lead@client.com',
        phone: '+1 (800) 000-0000',
        isPrimary: true
      }];
    }

    return prisma.client.create({
      data: {
        tenantId,
        name,
        website,
        boardNumber,
        location,
        msaStatus: true,
        clientType: raw.clientType || 'End Client',
        contacts: {
          create: contactsCreate
        }
      },
      include: {
        contacts: true,
        requirements: true,
        placements: true
      }
    });
  }

  async updateClient(id: string, raw: any, tenantId?: string) {
    if (tenantId) {
      const existing = await prisma.client.findUnique({ where: { id } });
      if (!existing || existing.tenantId !== tenantId) {
        throw new Error('Client not found or unauthorized');
      }
    }

    const data: Prisma.ClientUpdateInput = {};
    if (raw.name !== undefined) data.name = String(raw.name).trim();
    if (raw.website !== undefined) data.website = String(raw.website).trim();
    if (raw.boardNumber !== undefined) data.boardNumber = String(raw.boardNumber).trim();
    if (raw.location !== undefined) data.location = String(raw.location).trim();

    return prisma.client.update({
      where: { id },
      data,
      include: {
        contacts: true,
        requirements: {
          select: { id: true, code: true, opportunityTitle: true, status: true }
        },
        placements: {
          select: { id: true, resourceName: true, skillRole: true, status: true, billRate: true }
        }
      }
    });
  }

  async deleteClient(id: string, tenantId?: string) {
    if (tenantId) {
      const existing = await prisma.client.findUnique({ where: { id } });
      if (!existing || existing.tenantId !== tenantId) {
        throw new Error('Client not found or unauthorized');
      }
    }
    return prisma.client.delete({ where: { id } });
  }

  async getVendors(tenantId?: string) {
    const where: Prisma.VendorWhereInput = {};
    if (tenantId) where.tenantId = tenantId;

    return prisma.vendor.findMany({
      where,
      include: {
        placements: {
          select: { id: true, resourceName: true, customer: true, status: true }
        }
      },
      orderBy: { name: 'asc' }
    });
  }

  async createVendor(raw: any, tenantId: string = 'talentos-agency') {
    const name = raw.name?.trim() || 'New Vendor Agency';
    const contactName = raw.contactName?.trim() || 'Account Executive';
    const phone = raw.phone?.trim() || '+1 (555) 000-0000';
    const email = raw.email?.trim() || 'partner@vendor.com';
    const location = raw.location?.trim() || 'US Nationwide';
    const skillSpecialization = raw.skillSpecialization?.trim() || 'IT Staffing';
    const paymentTerms = raw.paymentTerms?.trim() || 'Net 45';
    const invoicingTerms = raw.invoicingTerms?.trim() || 'Bi-weekly';
    const msaSigned = raw.msa === 'Yes' || raw.msa === 'Active' || raw.msaSigned === true;

    return prisma.vendor.create({
      data: {
        tenantId,
        name,
        contactName,
        phone,
        email,
        location,
        skillSpecialization,
        paymentTerms,
        invoicingTerms,
        msaSigned
      },
      include: {
        placements: true
      }
    });
  }

  async updateVendor(id: string, raw: any, tenantId?: string) {
    if (tenantId) {
      const existing = await prisma.vendor.findUnique({ where: { id } });
      if (!existing || existing.tenantId !== tenantId) {
        throw new Error('Vendor not found or unauthorized');
      }
    }

    const data: Prisma.VendorUpdateInput = {};
    if (raw.name !== undefined) data.name = String(raw.name).trim();
    if (raw.contactName !== undefined) data.contactName = String(raw.contactName).trim();
    if (raw.phone !== undefined) data.phone = String(raw.phone).trim();
    if (raw.email !== undefined) data.email = String(raw.email).trim();
    if (raw.location !== undefined) data.location = String(raw.location).trim();
    if (raw.skillSpecialization !== undefined) data.skillSpecialization = String(raw.skillSpecialization).trim();
    if (raw.paymentTerms !== undefined) data.paymentTerms = String(raw.paymentTerms).trim();
    if (raw.invoicingTerms !== undefined) data.invoicingTerms = String(raw.invoicingTerms).trim();
    if (raw.msa !== undefined || raw.msaSigned !== undefined) {
      data.msaSigned = raw.msa === 'Yes' || raw.msa === 'Active' || raw.msaSigned === true;
    }

    return prisma.vendor.update({
      where: { id },
      data,
      include: {
        placements: true
      }
    });
  }

  async deleteVendor(id: string, tenantId?: string) {
    if (tenantId) {
      const existing = await prisma.vendor.findUnique({ where: { id } });
      if (!existing || existing.tenantId !== tenantId) {
        throw new Error('Vendor not found or unauthorized');
      }
    }
    return prisma.vendor.delete({ where: { id } });
  }
}

export const clientService = new ClientService();

