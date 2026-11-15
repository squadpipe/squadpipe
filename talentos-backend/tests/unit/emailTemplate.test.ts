import assert from 'assert';
import {
  APP_NAME,
  renderInviteEmail,
  renderOtpEmail,
  renderSubmissionEmail,
} from '../../src/services/emailTemplate.service';

export function runEmailTemplateTests() {
  console.log('--- Running Email Template Branding Tests ---');
  const companyName = 'Acme Staffing Group';

  // 1. Invite email: app name in subject, company name in header & heading only
  const invite = renderInviteEmail({
    brandName: companyName,
    recipientName: 'Nakul Das',
    roleLabel: 'Technical Recruiter',
    inviteUrl: 'https://squadpipe.softiox.com/?inviteToken=abc',
    expiresHours: 24,
  });
  assert(invite.subject.includes(APP_NAME), 'Invite subject must include app name');
  assert(!invite.subject.includes(companyName), 'Invite subject must not include company name');
  assert(invite.html.includes(`>${companyName}<`), 'Invite header must include company name');
  assert(
    invite.html.includes(`You&rsquo;re invited to ${companyName}`),
    'Invite heading must include company name'
  );
  console.log('  ✅ Invite email uses app name in subject and company name in heading');

  // 2. OTP email: app name in subject, company name in header & heading only
  const otp = renderOtpEmail({
    brandName: companyName,
    recipientName: 'Nakul Das',
    otpCode: '123456',
    expiresMinutes: 15,
  });
  assert(otp.subject.includes(APP_NAME), 'OTP subject must include app name');
  assert(!otp.subject.includes(companyName), 'OTP subject must not include company name');
  assert(otp.html.includes(`>${companyName}<`), 'OTP header must include company name');
  assert(
    otp.html.includes(`${companyName} Verification Code`),
    'OTP heading must include company name'
  );
  console.log('  ✅ OTP email uses app name in subject and company name in heading');

  // 3. Submission email fallback: app name in subject, company name in header & heading only
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
  assert(submission.subject.includes(APP_NAME), 'Submission subject must include app name');
  assert(
    !submission.subject.includes(companyName),
    'Submission subject must not include company name'
  );
  assert(
    submission.html.includes(`${companyName} &mdash; Candidate Profile Submission`),
    'Submission heading must include company name'
  );
  console.log('  ✅ Submission email uses app name in subject and company name in heading');
}
