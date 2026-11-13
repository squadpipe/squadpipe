import { createDynamicSmtpTransporter, getTenantSettings } from '../config/smtp.config';
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
    const { smtp } = await getTenantSettings(resolvedTenantId);

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

    if (!smtp.enabled || !smtp.host?.trim() || !smtp.username?.trim() || !smtp.password || !smtp.fromEmail?.trim()) {
      const msg = !smtp.enabled
        ? 'Outbound SMTP is currently paused in Email Setup (SMTP).'
        : 'SMTP is not configured. Please enter your SMTP credentials in Settings -> Email Setup (SMTP).';

      await prisma.emailLog.update({
        where: { id: log.id },
        data: {
          status: EmailStatus.FAILED,
          errorMessage: msg,
        },
      });

      return { success: false, error: msg };
    }

    const fromName = smtp.fromName?.trim() || 'TalentOS Recruitment Desk';
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
