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
  async importCandidates(rows: CsvCandidateRow[]) {
    const results = [];

    for (const row of rows) {
      if (!row.fullName || !row.email) continue;

      const created = await prisma.candidate.upsert({
        where: { email: row.email },
        update: {
          currentTitle: row.currentTitle || '',
          skillset: row.skillset || '',
          workAuth: row.workAuth || '',
          hourlyRateDisplay: row.hourlyRateDisplay || '',
        },
        create: {
          fullName: row.fullName,
          email: row.email,
          phone: row.phone || '',
          workAuth: row.workAuth || '',
          education: row.education || '',
          currentTitle: row.currentTitle || '',
          skillset: row.skillset || '',
          hourlyRateDisplay: row.hourlyRateDisplay || '',
          relocation: row.relocation || '',
          pipelineStage: CandidatePipelineStage.AVAILABLE_BENCH,
          assignedRecruiterId: row.assignedRecruiterId,
        },
      });

      results.push(created);
    }

    return results;
  }
}

export const csvImporterService = new CsvImporterService();

