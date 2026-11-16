import { z } from 'zod';

export const AutomationRuleCreateSchema = z.object({
  name: z.string().min(3),
  category: z.enum(['FEEDBACK', 'INTERVIEW', 'STALE_REQ', 'CONTRACT', 'COMPLIANCE', 'CUSTOM']),
  triggerEvent: z.string(),
  threshold: z.string(),
  thresholdUnit: z.string().optional(),
  whenText: z.string(),
  thenSummary: z.string(),
  actions: z.array(z.any()),
});

export type AutomationRuleCreateInput = z.infer<typeof AutomationRuleCreateSchema>;

