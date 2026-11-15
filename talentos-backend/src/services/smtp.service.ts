import {
  createDynamicSmtpTransporter,
  getTenantSettings,
  isSmtpConfigured,
  SmtpSettings,
} from '../config/smtp.config';
import { prisma } from '../config/prisma.config';
import { EmailStatus } from '@prisma/client';
import { APP_NAME } from './emailTemplate.service';

export function resolveSmtpFromName(
  brandName: string,
  configuredFromName?: string | null,
  appName: string = APP_NAME
): string {
  const configured = (configuredFromName || '').replace(/"/g, '').trim();
  const isGenericDefaultFrom =
    !configured ||
    configured === 'TalentOS Recruitment Desk' ||
    configured === 'SquadPipe Recruitment Desk';

  if (!isGenericDefaultFrom) {
    return configured;
  }

  const cleanBrand = (brandName || 'Workspace').replace(/"/g, '').trim() || 'Workspace';
  const cleanApp = (appName || 'SquadPipe').replace(/"/g, '').trim() || 'SquadPipe';
  return cleanBrand.toLowerCase().includes(cleanApp.toLowerCase())
    ? cleanBrand
    : `${cleanBrand} via ${cleanApp}`;
}

export function resolveMailReplyToAndHeaders(options: {
  fromEmail: string;
  configuredReplyTo?: string;
  explicitReplyTo?: string;
  noReply?: boolean;
}): {
  replyTo?: string;
  headers?: Record<string, string>;
} {
  if (options.noReply) {
    return {
      headers: {
        'Auto-Submitted': 'auto-generated',
        'X-Auto-Response-Suppress': 'All',
      },
    };
  }

  const resolvedReplyTo =
    options.explicitReplyTo?.trim() ||
    options.configuredReplyTo?.trim() ||
    options.fromEmail.trim();

  return resolvedReplyTo ? { replyTo: resolvedReplyTo } : {};
}

function resolveEnvSmtpSettings(): SmtpSettings | null {
  const host = process.env.SMTP_HOST?.trim() || '';
  const username = process.env.SMTP_USER?.trim() || '';
  const password = process.env.SMTP_PASS || '';
  const fromEmail = process.env.SMTP_FROM_EMAIL?.trim() || username;

  if (!host || !username || !password || !fromEmail) {
    return null;
  }

  const parsedPort = Number(process.env.SMTP_PORT || 587);
  const port = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 587;
  const isSecure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465;

  return {
    enabled: true,
    host,
    port,
    encryption: isSecure ? 'SSL' : 'STARTTLS',
    username,
    password,
    fromName: process.env.SMTP_FROM_NAME?.trim() || '',
    fromEmail,
    replyToEmail: process.env.SMTP_REPLY_TO?.trim() || '',
  };
}

export interface SendMailOptions {
  to: string;
  recipientName?: string;
  subject: string;
  html: string;
  text?: string;
  tenantId?: string;
  replyTo?: string;
  noReply?: boolean;
}

export class SmtpService {
  async sendMail(options: SendMailOptions) {
    const { to, recipientName, subject, html, text, tenantId, replyTo: explicitReplyTo, noReply } =
      options;
    const resolvedTenantId = tenantId || 'talentos-agency';
    const { general } = await getTenantSettings(resolvedTenantId);

    // Create log record as PENDING
    const log = await prisma.emailLog.create({
      data: {
        tenantId: resolvedTenantId,
        recipientEmail: to,
        recipientName: recipientName || to,
        subject,
        bodyHtml: html,
        status: EmailStatus.PENDING,
      },
    });

    const effectiveSmtp = resolveEnvSmtpSettings();

    if (!effectiveSmtp || !isSmtpConfigured(effectiveSmtp)) {
      const msg =
        'Email (SMTP) is not configured. Please configure SMTP_HOST, SMTP_USER, SMTP_PASS, and SMTP_FROM_EMAIL in the server environment.';

      await prisma.emailLog.update({
        where: { id: log.id },
        data: {
          status: EmailStatus.FAILED,
          errorMessage: msg,
        },
      });

      return { success: false, configured: false, code: 'SMTP_NOT_CONFIGURED', error: msg };
    }

    const brandName = (general.agencyName || general.legalEntityName || 'Workspace').trim();
    const fromName = resolveSmtpFromName(brandName, effectiveSmtp.fromName, APP_NAME);
    const fromEmail = effectiveSmtp.fromEmail.trim();
    const { replyTo, headers } = resolveMailReplyToAndHeaders({
      fromEmail,
      configuredReplyTo: effectiveSmtp.replyToEmail,
      explicitReplyTo,
      noReply,
    });

    try {
      const transporter = createDynamicSmtpTransporter(effectiveSmtp);
      const info = await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        ...(replyTo ? { replyTo } : {}),
        ...(headers ? { headers } : {}),
        to,
        subject,
        html,
        text: text || html.replace(/<[^>]*>?/gm, ''),
      });

      await prisma.emailLog.update({
        where: { id: log.id },
        data: {
          status: EmailStatus.SENT,
          smtpMessageId: info.messageId,
          sentAt: new Date(),
        },
      });

      return { success: true, messageId: info.messageId };
    } catch (error: any) {
      console.error('SMTP email dispatch error:', error);

      await prisma.emailLog.update({
        where: { id: log.id },
        data: {
          status: EmailStatus.FAILED,
          errorMessage: error.message || 'SMTP Transmission failed',
        },
      });

      return { success: false, error: error.message };
    }
  }
}

export const smtpService = new SmtpService();
