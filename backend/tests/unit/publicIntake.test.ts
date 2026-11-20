import assert from 'node:assert/strict';
import { maskFinancialRecord } from '../../src/middlewares/rateMask.middleware';
import { normalizeApplicationForms } from '../../src/config/smtp.config';
import {
  formatWorkModelLabel,
  generatePublicFormToken,
  serializePublicRequirementPayload,
  validatePublicApplicationInput,
} from '../../src/services/publicIntake.service';
import { sanitizePublicSummaryHtml } from '../../src/utils/publicSummary';

export const runPublicIntakeTests = () => {
  console.log('--- Running Public Requirement CV Intake Form Tests ---');

  // 1. Cryptographic token generation
  const tokens = new Set<string>();
  for (let i = 0; i < 20; i++) {
    const token = generatePublicFormToken();
    assert.ok(token.length >= 20, 'Token should be at least 20 URL-safe characters');
    assert.match(token, /^[a-zA-Z0-9_-]+$/);
    tokens.add(token);
  }
  assert.equal(tokens.size, 20, 'Generated public form tokens must be unique');

  // 2. Work model formatting
  assert.equal(formatWorkModelLabel('REMOTE'), 'Remote');
  assert.equal(formatWorkModelLabel('HYBRID'), 'Hybrid');
  assert.equal(formatWorkModelLabel('ONSITE'), 'Onsite');

  // 3. Strict security allowlist strips all internal bill rates, client names, emails, and notes
  const sensitiveReqRecord: Record<string, any> = {
    id: 'req-uuid-secret',
    tenantId: 'tenant-secret',
    code: 'REQ-2045',
    companyName: 'Confidential Bank Corp',
    clientContactId: 'cc-secret-1',
    clientContact: { fullName: 'Hidden VP', email: 'vp@secretbank.com' },
    opportunityTitle: 'Senior Cloud Platform Engineer',
    location: 'Austin, TX',
    workModel: 'HYBRID',
    skillsRequired: 'AWS, Terraform, Kubernetes',
    openPositions: 2,
    targetBillRate: 155,
    maxBillRate: 170,
    targetPayRate: 110,
    rawEmailText: 'Internal note: bill client $155/hr and target pay $110/hr.',
    missingNotes: 'Hiring manager direct mobile 555-999-1111',
    publicDescription: 'Build multi-region Kubernetes clusters on AWS.',
  };

  const publicPayload = serializePublicRequirementPayload(
    {
      ...sensitiveReqRecord,
      rawEmailText: [
        'From: Hidden VP <vp@secretbank.com>',
        'Client: Confidential Bank Corp',
        'Internal note: bill client $155/hr and target pay $110/hr.',
        '- Lead Kubernetes multi-region cluster design and Terraform automation.',
        '- Partner with security engineering for SOC2 & IAM hardening.',
        'Looking for 8+ years experience, 12 months contract.',
      ].join('\n'),
    } as any,
    'Beacon IT Staffing'
  );
  const serializedStr = JSON.stringify(publicPayload);

  assert.equal(publicPayload.agencyName, 'Beacon IT Staffing');
  assert.equal(publicPayload.opportunityTitle, 'Senior Cloud Platform Engineer');
  assert.equal(publicPayload.workModel, 'Hybrid');
  assert.equal(publicPayload.openPositions, 2);
  assert.equal(publicPayload.publicDescription, 'Build multi-region Kubernetes clusters on AWS.');
  assert.ok(publicPayload.highlights.some((h) => h.includes('Kubernetes multi-region')));
  assert.ok(publicPayload.engagementSummary?.includes('8+ years'));

  const cleanedHtml = sanitizePublicSummaryHtml(
    '<p onclick="alert(1)">Role scope</p><ul><li>Build AWS APIs</li></ul><script>evil()</script>'
  );
  assert.equal(cleanedHtml, '<p>Role scope</p><ul><li>Build AWS APIs</li></ul>');

  for (const forbiddenKey of [
    'code',
    'requirementCode',
    'companyName',
    'targetBillRate',
    'maxBillRate',
    'targetPayRate',
    'rawEmailText',
    'missingNotes',
    'clientContact',
    'clientContactId',
    'tenantId',
    'id',
  ]) {
    assert.equal(
      Object.prototype.hasOwnProperty.call(publicPayload, forbiddenKey),
      false,
      `Forbidden internal field leaked in public payload: ${forbiddenKey}`
    );
  }
  assert.equal(serializedStr.includes('REQ-2045'), false);
  assert.equal(serializedStr.includes('Confidential Bank'), false);
  assert.equal(serializedStr.includes('secretbank.com'), false);
  assert.equal(serializedStr.includes('155'), false);
  assert.equal(serializedStr.includes('170'), false);
  assert.equal(serializedStr.includes('110'), false);

  // 4. Anti-spam honeypot & input validation
  const dummyCv = {
    originalname: 'Jordan_Patel_CV.pdf',
    mimetype: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4 sample resume text'),
    size: 29,
  };

  assert.throws(
    () =>
      validatePublicApplicationInput(
        {
          fullName: 'Bot User',
          email: 'bot@spam.io',
          phone: '+1 555 222 3333',
          workAuth: 'US Citizen',
          _hpWebsite: 'https://spam-link.example',
        },
        dummyCv
      ),
    (err: any) => err.statusCode === 400
  );

  assert.throws(
    () =>
      validatePublicApplicationInput(
        {
          fullName: 'Jordan Patel',
          email: 'jordan@example.com',
          phone: '+1 555 222 3333',
          workAuth: 'US Citizen',
        },
        null
      ),
    (err: any) => err.statusCode === 400
  );

  assert.throws(
    () =>
      validatePublicApplicationInput(
        {
          fullName: 'Jordan Patel',
          email: 'not-an-email',
          phone: '+1 555 222 3333',
          workAuth: 'US Citizen',
        },
        dummyCv
      ),
    (err: any) => err.statusCode === 400
  );

  const validApp = validatePublicApplicationInput(
    {
      fullName: '  Jordan Patel  ',
      email: ' Jordan.Patel@Example.COM ',
      phone: ' +1 (512) 555-0199 ',
      workAuth: 'US Citizen',
      submittedRate: '$95/hr (W2)',
      submittedVendorName: 'PartnerTek LLC',
    },
    dummyCv
  );
  assert.equal(validApp.fullName, 'Jordan Patel');
  assert.equal(validApp.email, 'jordan.patel@example.com');
  assert.equal(validApp.submittedRate, '$95/hr (W2)');
  assert.equal(validApp.submittedVendorName, 'PartnerTek LLC');

  // 5. RateMask middleware masks submittedRate on public-intake submissions for rate-masked users
  const maskedSub = maskFinancialRecord({
    id: 'sub-1',
    intakeSource: 'PUBLIC_FORM',
    submittedRate: '$95/hr (W2)',
    submittedVendorName: 'PartnerTek LLC',
  });
  assert.equal(maskedSub.submittedRate, '••••••');
  assert.equal(maskedSub.submittedVendorName, 'PartnerTek LLC');

  // 6. Application form template width normalization preserves half/full width settings
  const normalizedForms = normalizeApplicationForms([
    {
      id: 'form-width-test',
      name: 'Width Test Form',
      isDefault: true,
      heading: 'Apply Now',
      includeVendorName: true,
      fieldWidths: {
        currentTitle: 'full',
        expectedRate: 'half',
        vendorName: 'half',
      },
      customFields: [
        {
          key: 'joining_timeline',
          name: 'Earliest Start Date',
          type: 'DROPDOWN',
          options: ['Immediate', '2 Weeks', '30 Days'],
          required: true,
          width: 'full',
        },
        {
          key: 'relocation_ok',
          name: 'Open to relocation?',
          type: 'BOOLEAN',
          required: false,
          width: 'half',
        },
      ],
    },
  ]);
  assert.equal(normalizedForms.length, 1);
  assert.equal(normalizedForms[0].fieldWidths?.currentTitle, 'full');
  assert.equal(normalizedForms[0].fieldWidths?.expectedRate, 'half');
  assert.equal(normalizedForms[0].fieldWidths?.vendorName, 'half');
  assert.equal(normalizedForms[0].customFields[0].width, 'full');
  assert.equal(normalizedForms[0].customFields[1].width, 'half');

  console.log('✅ Public Requirement CV Intake Form Tests: PASSED');
};
