import { z } from 'zod';

export const RequirementCreateSchema = z.object({
  companyName: z.string().min(2),
  opportunityTitle: z.string().min(2),
  location: z.string().default('Remote'),
  skillsRequired: z.string().min(2),
  clientContact: z.string().optional(),
  targetBillRate: z.number().optional(),
  targetPayRate: z.number().optional(),
  assignedRecruiterId: z.string().optional(),
});

export type RequirementCreateInput = z.infer<typeof RequirementCreateSchema>;

