import { z } from 'zod';

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  rememberMe: z.boolean().optional().default(true),
});

export const InviteUserSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  role: z.string(),
  desk: z.string().default('US IT Contract'),
  rateMasked: z.boolean().default(true),
});

export type LoginInput = z.infer<typeof LoginSchema>;
export type InviteUserInput = z.infer<typeof InviteUserSchema>;

