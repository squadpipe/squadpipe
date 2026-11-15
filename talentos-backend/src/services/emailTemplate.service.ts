import fs from 'fs';
import path from 'path';
import Handlebars from 'handlebars';

export const APP_NAME = (process.env.APP_NAME || 'SquadPipe').trim() || 'SquadPipe';

const TEMPLATES_DIR = path.resolve(__dirname, '../templates/emails');
const compiledCache = new Map<string, Handlebars.TemplateDelegate>();

function getTemplate(name: string): Handlebars.TemplateDelegate {
  const cached = compiledCache.get(name);
  if (cached) return cached;

  const filePath = path.join(TEMPLATES_DIR, `${name}.hbs`);
  const source = fs.readFileSync(filePath, 'utf8');
  const compiled = Handlebars.compile(source);
  compiledCache.set(name, compiled);
  return compiled;
}

function renderWithLayout(params: {
  templateName: string;
  subject: string;
  brandName: string;
  badgeText: string;
  footerNote: string;
  data: Record<string, unknown>;
}): string {
  const bodyTemplate = getTemplate(params.templateName);
  const layoutTemplate = getTemplate('layout');

  const body = bodyTemplate({
    ...params.data,
    brandName: params.brandName,
    appName: APP_NAME,
  });

  return layoutTemplate({
    subject: params.subject,
    brandName: params.brandName,
    appName: APP_NAME,
    badgeText: params.badgeText,
    footerNote: params.footerNote,
    year: new Date().getFullYear(),
    body,
  });
}

export function renderOtpEmail(params: {
  brandName: string;
  recipientName: string;
  otpCode: string;
  expiresMinutes?: number;
}): { subject: string; html: string } {
  const subject = `${APP_NAME} Password Reset Verification Code`;
  const html = renderWithLayout({
    templateName: 'otp',
    subject,
    brandName: params.brandName,
    badgeText: 'Account Security',
    footerNote:
      `For your protection, never share your ${APP_NAME} verification code with anyone.`,
    data: {
      recipientName: params.recipientName || 'Team Member',
      otpCode: params.otpCode,
      expiresMinutes: params.expiresMinutes ?? 15,
    },
  });
  return { subject, html };
}

export function renderInviteEmail(params: {
  brandName: string;
  recipientName: string;
  roleLabel: string;
  inviteUrl: string;
  expiresHours?: number;
}): { subject: string; html: string } {
  const subject = `You're invited to join ${APP_NAME}`;
  const html = renderWithLayout({
    templateName: 'invite',
    subject,
    brandName: params.brandName,
    badgeText: 'Team Invitation',
    footerNote:
      `This is an automated onboarding invitation sent via ${APP_NAME} by your administrator.`,
    data: {
      recipientName: params.recipientName || 'Team Member',
      roleLabel: params.roleLabel,
      inviteUrl: params.inviteUrl,
      expiresHours: params.expiresHours ?? 24,
    },
  });
  return { subject, html };
}

export function renderSubmissionEmail(params: {
  brandName: string;
  recipientName: string;
  requirementTitle: string;
  clientName: string;
  candidateName: string;
  workAuth: string;
  rate: string;
  location: string;
  senderName: string;
  subject?: string;
}): { subject: string; html: string } {
  const subject =
    params.subject?.trim() ||
    `Candidate Profile: ${params.candidateName} for ${params.requirementTitle} — ${APP_NAME}`;
  const html = renderWithLayout({
    templateName: 'submission',
    subject,
    brandName: params.brandName,
    badgeText: 'Candidate Submission',
    footerNote:
      `Confidential candidate profile prepared via ${APP_NAME}.`,
    data: {
      recipientName: params.recipientName || 'Hiring Team',
      requirementTitle: params.requirementTitle || 'Open Requisition',
      clientName: params.clientName || 'your organization',
      candidateName: params.candidateName || 'N/A',
      workAuth: params.workAuth || 'Authorized',
      rate: params.rate || 'Competitive',
      location: params.location || 'Remote / Hybrid',
      senderName: params.senderName || `${params.brandName} Recruitment Desk`,
    },
  });
  return { subject, html };
}
