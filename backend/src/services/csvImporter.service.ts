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

export function parseCsvHourlyRates(rateDisplayInput?: string) {
  const rateDisplay = String(rateDisplayInput || '').trim() || '$90/hr (W2)';
  const rateMatch = rateDisplay.match(/(\d+(?:\.\d+)?)/);
  const rateDigits = rateMatch ? Math.round(parseFloat(rateMatch[1])) || 90 : 90;
  const isC2C = rateDisplay.toUpperCase().includes('C2C');
  return {
    hourlyRateDisplay: rateDisplay,
    hourlyRateW2: isC2C ? null : rateDigits,
    hourlyRateC2c: isC2C ? rateDigits : null,
  };
}

export class CsvImporterService {
  async importCandidates(rows: CsvCandidateRow[], tenantId: string = 'squadpipe-agency', recruiterId?: string) {
    const results = [];

    for (const row of rows) {
      if (!row.fullName || !row.email) continue;
      const normalizedEmail = row.email.trim().toLowerCase();
      const { hourlyRateDisplay, hourlyRateW2, hourlyRateC2c } = parseCsvHourlyRates(
        row.hourlyRateDisplay
      );

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
          hourlyRateDisplay,
          hourlyRateW2,
          hourlyRateC2c,
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
          hourlyRateDisplay,
          hourlyRateW2,
          hourlyRateC2c,
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

