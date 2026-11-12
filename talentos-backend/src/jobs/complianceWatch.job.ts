import { prisma } from '../config/prisma.config';
import { SlaCategory, SlaActionType } from '@prisma/client';

export const runComplianceWatchJob = async () => {
  try {
    const sixtyDaysThreshold = new Date();
    sixtyDaysThreshold.setDate(sixtyDaysThreshold.getDate() + 60);

    // Scan for expiring MSAs or COIs on staffing vendors
    const expiringVendors = await prisma.vendor.findMany({
      where: {
        coiExpiryDate: { lte: sixtyDaysThreshold },
      },
    });

    for (const vendor of expiringVendors) {
      const existing = await prisma.slaTask.findFirst({
        where: { relatedEntityId: vendor.id, isDone: false },
      });
      if (!existing) {
        await prisma.slaTask.create({
          data: {
            category: SlaCategory.COMPLIANCE_ALERT,
            slaRuleTag: 'COI Expiry (<60d)',
            badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
            title: `${vendor.name}: Certificate of Insurance Renewal Required`,
            description: `Vendor partner COI expires within compliance window. Request updated certificate.`,
            meta: `Contact: ${vendor.contactName} • ${vendor.phone}`,
            actionType: SlaActionType.CHECKLIST,
            actionLabel: 'Compliance Audit',
            relatedEntityType: 'vendor',
            relatedEntityId: vendor.id,
          },
        });
      }
    }
  } catch (error) {
    console.error('[Compliance Watch Job Error]:', error);
  }
};

