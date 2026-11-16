import { z } from 'zod';

export const CandidateCreateSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  currentTitle: z.string().min(2),
  workAuth: z.string().default('US Citizen'),
  education: z.string().optional(),
  skillset: z.string().min(2),
  hourlyRateW2: z.number().optional(),
  hourlyRateC2c: z.number().optional(),
  hourlyRateDisplay: z.string().optional(),
  relocation: z.string().default('Yes'),
  assignedRecruiterId: z.string().optional(),
  vendorId: z.string().optional().nullable(),
  vendorName: z.string().optional().nullable(),
});

export type CandidateCreateInput = z.infer<typeof CandidateCreateSchema>;

