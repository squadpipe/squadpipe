import { createDynamicSmtpTransporter, getTenantSettings, isSmtpConfigured } from '../config/smtp.config';
import { prisma } from '../config/prisma.config';
import { EmailStatus } from '@prisma/client';

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
    const { general, smtp } = await getTenantSettings(resolvedTenantId);

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

    if (!isSmtpConfigured(smtp)) {
      const msg = !smtp.enabled
        ? 'Email dispatch is paused. Please enable Outbound SMTP in Settings → Email Setup (SMTP) to dispatch emails.'
        : 'Email (SMTP) is not configured. Please configure your SMTP settings in Settings → Email Setup (SMTP) to dispatch emails.';

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
    const fromName =
      smtp.fromName?.trim() && smtp.fromName.trim() !== 'TalentOS Recruitment Desk'
        ? smtp.fromName.trim()
        : `${brandName} Recruitment Desk`;
    const fromEmail = smtp.fromEmail.trim();
    const replyTo = smtp.replyToEmail?.trim() || fromEmail;

    try {
      const transporter = createDynamicSmtpTransporter(smtp);
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
