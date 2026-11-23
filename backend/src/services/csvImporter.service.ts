import { prisma } from '../config/prisma.config';
import { CandidateLawfulBasis, CandidatePipelineStage, ConsentStatus } from '@prisma/client';
import { candidateIndexingService } from './vector/candidateIndexing.service';
import { extractNormalizedSkills } from '../utils/skillMatcher';
import { getTenantSettings } from '../config/smtp.config';
import { computeRetentionExpiresAt } from './compliance.service';

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
    const now = new Date();
    const { general: tenantGeneral } = await getTenantSettings(tenantId).catch(() => ({
      general: { candidateRetentionDays: 365 } as any,
    }));
    const retentionExpiresAt = computeRetentionExpiresAt(
      now,
      tenantGeneral?.candidateRetentionDays
    );

    for (const row of rows) {
      if (!row.fullName || !row.email) continue;
      const normalizedEmail = row.email.trim().toLowerCase();
      const { hourlyRateDisplay, hourlyRateW2, hourlyRateC2c } = parseCsvHourlyRates(
        row.hourlyRateDisplay
      );

      const titleForUpsert = row.currentTitle || '';
      const skillsForUpsert = row.skillset || '';
      const createTitle = row.currentTitle || 'Software Engineer';
      const createSkills = row.skillset || 'Technical Skills';

      const created = await prisma.candidate.upsert({
        where: {
          tenantId_email: {
            tenantId,
            email: normalizedEmail
          }
        },
        update: {
          currentTitle: titleForUpsert,
          skillset: skillsForUpsert,
          normalizedSkills: extractNormalizedSkills({
            skillset: skillsForUpsert,
            currentTitle: titleForUpsert,
          }),
          workAuth: row.workAuth || 'US Citizen',
          hourlyRateDisplay,
          hourlyRateW2,
          hourlyRateC2c,
          retentionExpiresAt,
        },
        create: {
          tenantId,
          fullName: row.fullName.trim(),
          email: normalizedEmail,
          phone: row.phone || '',
          workAuth: row.workAuth || 'US Citizen',
          education: row.education || "Master's Degree",
          currentTitle: createTitle,
          skillset: createSkills,
          normalizedSkills: extractNormalizedSkills({
            skillset: createSkills,
            currentTitle: createTitle,
          }),
          hourlyRateDisplay,
          hourlyRateW2,
          hourlyRateC2c,
          relocation: row.relocation || 'Yes',
          pipelineStage: CandidatePipelineStage.AVAILABLE_BENCH,
          lawfulBasis: CandidateLawfulBasis.LEGITIMATE_INTEREST,
          consentStatus: ConsentStatus.PENDING,
          intakeSource: 'CSV_IMPORT',
          retentionExpiresAt,
          assignedRecruiterId: recruiterId || row.assignedRecruiterId || null,
        },
      });

      results.push(created);
      candidateIndexingService.scheduleCandidateSync(created.id, tenantId);
    }

    return results;
  }
}

export const csvImporterService = new CsvImporterService();

