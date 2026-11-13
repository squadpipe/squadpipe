import { prisma } from '../config/prisma.config';
import { CandidatePipelineStage } from '@prisma/client';

export interface CsvCandidateRow {
  fullName: string;
  email: string;
  phone?: string;
  workAuth?: string;
  education?: string;
  currentTitle?: string;
  skillset?: string;
  hourlyRateDisplay?: string;
  relocation?: string;
  assignedRecruiterId?: string;
}

export class CsvImporterService {
  async importCandidates(rows: CsvCandidateRow[], tenantId: string = 'talentos-agency', recruiterId?: string) {
    const results = [];

    for (const row of rows) {
      if (!row.fullName || !row.email) continue;
      const normalizedEmail = row.email.trim().toLowerCase();

      const created = await prisma.candidate.upsert({
        where: {
          tenantId_email: {
            tenantId,
            email: normalizedEmail
          }
        },
        update: {
          currentTitle: row.currentTitle || '',
          skillset: row.skillset || '',
          workAuth: row.workAuth || 'US Citizen',
          hourlyRateDisplay: row.hourlyRateDisplay || '$90/hr (W2)',
        },
        create: {
          tenantId,
          fullName: row.fullName.trim(),
          email: normalizedEmail,
          phone: row.phone || '',
          workAuth: row.workAuth || 'US Citizen',
          education: row.education || "Master's Degree",
          currentTitle: row.currentTitle || 'Software Engineer',
          skillset: row.skillset || 'Technical Skills',
          hourlyRateDisplay: row.hourlyRateDisplay || '$90/hr (W2)',
          relocation: row.relocation || 'Yes',
          pipelineStage: CandidatePipelineStage.AVAILABLE_BENCH,
          assignedRecruiterId: recruiterId || row.assignedRecruiterId || null,
        },
      });

      results.push(created);
    }

    return results;
  }
}

export const csvImporterService = new CsvImporterService();

