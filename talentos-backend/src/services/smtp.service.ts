import { smtpTransporter } from '../config/smtp.config';
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
    const fromName = process.env.SMTP_FROM_NAME || 'TalentOS Recruitment Desk';
    const fromEmail = process.env.SMTP_FROM_EMAIL || 'notifications@talentos-agency.com';

    // Create log record as PENDING
    const log = await prisma.emailLog.create({
      data: {
        tenantId: tenantId || 'talentos-agency',
        recipientEmail: to,
        recipientName: recipientName || to,
        subject,
        bodyHtml: html,
        status: EmailStatus.PENDING
      }
    });

    try {
      const info = await smtpTransporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to,
        subject,
        html,
        text: text || html.replace(/<[^>]*>?/gm, '')
      });

      // Update log to SENT
      await prisma.emailLog.update({
        where: { id: log.id },
        data: {
          status: EmailStatus.SENT,
          smtpMessageId: info.messageId,
          sentAt: new Date()
        }
      });

      return { success: true, messageId: info.messageId };
    } catch (error: any) {
      console.error('SMTP email dispatch error:', error);

      // Update log to FAILED
      await prisma.emailLog.update({
        where: { id: log.id },
        data: {
          status: EmailStatus.FAILED,
          errorMessage: error.message || 'SMTP Transmission failed'
        }
      });

      return { success: false, error: error.message };
    }
  }
}

export const smtpService = new SmtpService();

