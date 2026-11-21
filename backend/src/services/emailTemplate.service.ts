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

function joinBrandAndApp(brandName: string, appName: string, connector: 'on' | 'via'): string {
  const cleanBrand = (brandName || '').trim();
  const cleanApp = (appName || '').trim();
  if (!cleanBrand) return cleanApp;
  if (!cleanApp || cleanBrand.toLowerCase().includes(cleanApp.toLowerCase())) {
    return cleanBrand;
  }
  return `${cleanBrand} ${connector} ${cleanApp}`;
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
  const workspaceContext = joinBrandAndApp(params.brandName, APP_NAME, 'on');

  const body = bodyTemplate({
    ...params.data,
    brandName: params.brandName,
    appName: APP_NAME,
    workspaceContext,
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
  const workspaceContext = joinBrandAndApp(params.brandName, APP_NAME, 'on');
  const senderContext = joinBrandAndApp(params.brandName, APP_NAME, 'via');
  const subject = `Password reset code for ${workspaceContext}`;
  const html = renderWithLayout({
    templateName: 'otp',
    subject,
    brandName: params.brandName,
    badgeText: 'Password Reset',
    footerNote:
      `Automated no-reply security email from ${senderContext}. Never share this code; please do not reply directly to this email.`,
    data: {
      recipientName: params.recipientName || 'Team Member',
      otpCode: params.otpCode,
      expiresMinutes: params.expiresMinutes ?? 15,
    },
  });
  return { subject, html };
}

export function renderSignupVerificationEmail(params: {
  brandName: string;
  recipientName: string;
  otpCode: string;
  expiresMinutes?: number;
}): { subject: string; html: string } {
  const workspaceContext = joinBrandAndApp(params.brandName, APP_NAME, 'on');
  const senderContext = joinBrandAndApp(params.brandName, APP_NAME, 'via');
  const subject = `Verify your email for ${workspaceContext}`;
  const html = renderWithLayout({
    templateName: 'signup-otp',
    subject,
    brandName: params.brandName,
    badgeText: 'Email Verification',
    footerNote:
      `Automated no-reply verification email from ${senderContext}. Never share this code; please do not reply directly to this email.`,
    data: {
      recipientName: params.recipientName || 'Workspace Owner',
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
  const workspaceContext = joinBrandAndApp(params.brandName, APP_NAME, 'on');
  const senderContext = joinBrandAndApp(params.brandName, APP_NAME, 'via');
  const subject = `You're invited to join ${workspaceContext}`;
  const html = renderWithLayout({
    templateName: 'invite',
    subject,
    brandName: params.brandName,
    badgeText: 'Team Invitation',
    footerNote:
      `Automated no-reply invitation from ${senderContext}. Please do not reply directly to this email.`,
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
  const senderContext = joinBrandAndApp(params.brandName, APP_NAME, 'via');
  const subject =
    params.subject?.trim() ||
    `Candidate Profile: ${params.candidateName} for ${params.requirementTitle} — ${params.brandName || APP_NAME}`;
  const html = renderWithLayout({
    templateName: 'submission',
    subject,
    brandName: params.brandName,
    badgeText: 'Candidate Submission',
    footerNote:
      `Confidential candidate profile from ${senderContext}.`,
    data: {
      recipientName: params.recipientName || 'Hiring Team',
      requirementTitle: params.requirementTitle || 'Open Requisition',
      clientName: params.clientName || 'your organization',
      candidateName: params.candidateName || 'N/A',
      workAuth: params.workAuth || 'Authorized',
      rate: params.rate || 'Competitive',
      location: params.location || 'Remote / Hybrid',
      senderName: params.senderName || 'Recruitment Team',
    },
  });
  return { subject, html };
}
