import assert from 'assert';
import {
  APP_NAME,
  renderInviteEmail,
  renderOtpEmail,
  renderSubmissionEmail,
} from '../../src/services/emailTemplate.service';
import {
  resolveMailReplyToAndHeaders,
  resolveSmtpFromName,
} from '../../src/services/smtp.service';

export function runEmailTemplateTests() {
  console.log('--- Running Email Template Branding Tests ---');
  const companyName = 'Acme Staffing Group';

  // 1. Invite email: aligned subject and body naming workspace + app name, no-reply notice
  const invite = renderInviteEmail({
    brandName: companyName,
    recipientName: 'Nakul Das',
    roleLabel: 'Technical Recruiter',
    inviteUrl: 'https://squadpipe.softiox.com/?inviteToken=abc',
    expiresHours: 24,
  });
  assert(
    invite.subject.includes(`${companyName} on ${APP_NAME}`),
    'Invite subject must align company name and app name'
  );
  assert(invite.html.includes(`>${companyName}<`), 'Invite header must include company name');
  assert(
    invite.html.includes('Accept your team invitation'),
    'Invite heading must show clear team invitation action'
  );
  assert(
    invite.html.includes(`${companyName} on ${APP_NAME}`),
    'Invite body must reference company workspace on app name'
  );
  assert(
    invite.html.includes('do not reply directly to this email'),
    'Invite footer must include automated no-reply notice'
  );
  console.log('  ✅ Invite email streamlines subject and body cleanly');

  // 2. OTP email: aligned subject and body naming workspace + app name, no-reply notice
  const otp = renderOtpEmail({
    brandName: companyName,
    recipientName: 'Nakul Das',
    otpCode: '123456',
    expiresMinutes: 15,
  });
  assert(
    otp.subject.includes(`Password reset code for ${companyName} on ${APP_NAME}`),
    'OTP subject must align password reset code with company and app name'
  );
  assert(otp.html.includes(`>${companyName}<`), 'OTP header must include company name');
  assert(otp.html.includes('Reset your password'), 'OTP heading must clearly state password reset action');
  assert(
    otp.html.includes(`${companyName} on ${APP_NAME}`),
    'OTP body must reference company workspace on app name'
  );
  assert(
    otp.html.includes('Automated no-reply security email'),
    'OTP footer must include automated no-reply notice'
  );
  console.log('  ✅ OTP email streamlines subject and body cleanly');

  // 3. Submission email fallback: candidate + requirement + company without no-reply notice
  const submission = renderSubmissionEmail({
    brandName: companyName,
    recipientName: 'Sarah Thompson',
    requirementTitle: 'Senior Python Developer',
    clientName: 'BluePeak Technologies',
    candidateName: 'Amanda Bryant',
    workAuth: 'US Citizen',
    rate: '$95/hr C2C',
    location: 'Chicago, IL',
    senderName: 'Recruiter',
  });
  assert(
    submission.subject.includes('Candidate Profile: Amanda Bryant for Senior Python Developer'),
    'Submission subject must include candidate and requirement'
  );
  assert(submission.subject.includes(companyName), 'Submission subject fallback must include company name');
  assert(
    submission.html.includes('Candidate Profile: Amanda Bryant'),
    'Submission heading must include candidate name cleanly'
  );
  assert(
    !submission.html.includes('do not reply'),
    'Submission email must not include no-reply notice so clients can reply'
  );
  console.log('  ✅ Submission email streamlines subject and body cleanly');

  // 4. SMTP From Name formatting: "<Company> via <App>" for generic/blank SMTP_FROM_NAME
  assert.strictEqual(
    resolveSmtpFromName('Softiox Recruitment', 'TalentOS Recruitment Desk', 'SquadPipe'),
    'Softiox Recruitment via SquadPipe'
  );
  assert.strictEqual(
    resolveSmtpFromName('Softiox Recruitment', 'SquadPipe Recruitment Desk', 'SquadPipe'),
    'Softiox Recruitment via SquadPipe'
  );
  assert.strictEqual(
    resolveSmtpFromName('Softiox Recruitment', '', 'SquadPipe'),
    'Softiox Recruitment via SquadPipe'
  );
  assert.strictEqual(
    resolveSmtpFromName('SquadPipe Staffing', '', 'SquadPipe'),
    'SquadPipe Staffing'
  );
  assert.strictEqual(
    resolveSmtpFromName('Softiox Recruitment', '"Custom Desk"', 'SquadPipe'),
    'Custom Desk'
  );
  console.log('  ✅ SMTP sender name formats cleanly as "<Company> via <App>"');

  // 5. No-reply headers vs explicit recruiter Reply-To
  const noReplyDispatch = resolveMailReplyToAndHeaders({
    fromEmail: 'noreply@softiox.com',
    noReply: true,
  });
  assert.strictEqual(noReplyDispatch.replyTo, undefined);
  assert.strictEqual(noReplyDispatch.headers?.['Auto-Submitted'], 'auto-generated');
  assert.strictEqual(noReplyDispatch.headers?.['X-Auto-Response-Suppress'], 'All');

  const submissionDispatch = resolveMailReplyToAndHeaders({
    fromEmail: 'noreply@softiox.com',
    explicitReplyTo: 'recruiter@softiox.com',
  });
  assert.strictEqual(submissionDispatch.replyTo, 'recruiter@softiox.com');
  assert.strictEqual(submissionDispatch.headers, undefined);
  console.log('  ✅ No-reply system emails suppress Reply-To and set Auto-Submitted headers');
}
