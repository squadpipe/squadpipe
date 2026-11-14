import { MasterTaxonomyCategory } from '@prisma/client';

export interface DefaultTaxonomyItem {
  category: MasterTaxonomyCategory;
  optionValue: string;
  sortOrder: number;
}

export const DEFAULT_TAXONOMIES: DefaultTaxonomyItem[] = [
  ...['US Citizen', 'Green Card (Permanent Resident)', 'H-1B Specialty Occupation', 'TN Visa (NAFTA)', 'OPT / CPT EAD'].map((v, i) => ({
    category: MasterTaxonomyCategory.WORK_AUTH,
    optionValue: v,
    sortOrder: i,
  })),
  ...['Net 30 Days', 'Net 45 Days', 'Net 60 Days', 'Net 15 Days', 'Due on Receipt'].map((v, i) => ({
    category: MasterTaxonomyCategory.PAYMENT_TERMS,
    optionValue: v,
    sortOrder: i,
  })),
  ...["Master's Degree (MS/MBA)", "Bachelor's Degree (BS/B.Tech)", 'Doctorate / Ph.D.', 'Associate Degree'].map((v, i) => ({
    category: MasterTaxonomyCategory.EDUCATION,
    optionValue: v,
    sortOrder: i,
  })),
  ...['Requirement', 'Submitted', 'Interview', 'Selected', 'Onboarding', 'Billable', 'Archived'].map((v, i) => ({
    category: MasterTaxonomyCategory.STAGES,
    optionValue: v,
    sortOrder: i,
  })),
];
