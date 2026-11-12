import nodemailer from 'nodemailer';

export const smtpTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.mailgun.org',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER || 'postmaster@talentos-agency.com',
    pass: process.env.SMTP_PASS || 'secret',
  },
});

export const verifySmtpConnection = async (): Promise<boolean> => {
  try {
    await smtpTransporter.verify();
    console.log('SMTP mail server connection verified successfully.');
    return true;
  } catch (error) {
    console.warn('SMTP connection verification failed (check credentials in .env):', error);
    return false;
  }
};

