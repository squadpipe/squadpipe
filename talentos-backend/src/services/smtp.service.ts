import {
  createDynamicSmtpTransporter,
  getTenantSettings,
  isSmtpConfigured,
  SmtpSettings,
} from '../config/smtp.config';
import { prisma } from '../config/prisma.config';
import { EmailStatus } from '@prisma/client';

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
    replyToEmail: fromEmail,
  };
}

export interface SendMailOptions {
  to: string;
  recipientName?: string;
  subject: string;
  html: string;
  text?: string;
  tenantId?: string;
}

export class SmtpService {
  async sendMail(options: SendMailOptions) {
    const { to, recipientName, subject, html, text, tenantId } = options;
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
    const configuredFromName = effectiveSmtp.fromName?.trim();
    const isGenericDefaultFrom =
      !configuredFromName ||
      configuredFromName === 'TalentOS Recruitment Desk' ||
      configuredFromName === 'SquadPipe Recruitment Desk';
    const fromName = isGenericDefaultFrom
      ? `${brandName} Recruitment Desk`
      : configuredFromName;
    const fromEmail = effectiveSmtp.fromEmail.trim();
    const replyTo = effectiveSmtp.replyToEmail?.trim() || fromEmail;

    try {
      const transporter = createDynamicSmtpTransporter(effectiveSmtp);
      const info = await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        replyTo,
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
