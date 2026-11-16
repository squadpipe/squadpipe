import { z } from 'zod';

export const PlacementCreateSchema = z.object({
  resourceName: z.string().min(2),
  customer: z.string().min(2),
  customerContact: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  skillRole: z.string().min(2),
  deployment: z.enum(['ONSHORE', 'NEARSHORE', 'OFFSHORE']).default('ONSHORE'),
  startDate: z.string(),
  endDate: z.string(),
  billRate: z.number().positive(),
  payRate: z.number().positive(),
  placementType: z.enum(['C2C_SUBCONTRACTOR', 'W2_HOURLY', 'TEN_NINETY_NINE', 'FULL_TIME']).default('C2C_SUBCONTRACTOR'),
  purchaseOrderNumber: z.string().optional(),
});

export type PlacementCreateInput = z.infer<typeof PlacementCreateSchema>;

