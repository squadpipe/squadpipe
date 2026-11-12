import { PrismaClient, UserRole, UserStatus, CandidatePipelineStage, RequirementStatus, WorkModel, DeploymentType, PlacementType, PlacementStatus, AutomationCategory, TriggerEvent, SlaCategory, SlaActionType, CustomFieldEntityType, CustomFieldType, MasterTaxonomyCategory } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding TalentOS database with prototype dataset...');

  // 1. Clean existing records
  await prisma.emailLog.deleteMany();
  await prisma.slaTask.deleteMany();
  await prisma.automationAuditLog.deleteMany();
  await prisma.automationRule.deleteMany();
  await prisma.placement.deleteMany();
  await prisma.submission.deleteMany();
  await prisma.requirement.deleteMany();
  await prisma.clientContact.deleteMany();
  await prisma.client.deleteMany();
  await prisma.vendor.deleteMany();
  await prisma.candidate.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
  await prisma.customFieldDefinition.deleteMany();
  await prisma.masterTaxonomy.deleteMany();

  const defaultPasswordHash = await bcrypt.hash('TalentOS@2026', 10);

  // 2. Seed Users
  const userAdmin = await prisma.user.create({
    data: {
      fullName: 'Johnathan Miller',
      email: 'j.miller@talentos-agency.com',
      passwordHash: defaultPasswordHash,
      role: UserRole.ADMINISTRATOR,
      desk: 'Executive Operations & Billing',
      rateMasked: false,
      status: UserStatus.ACTIVE,
      workload: '12 Accounts • 6 Placements',
      lastActiveAt: new Date()
    }
  });

  const userSeniorRecruiter = await prisma.user.create({
    data: {
      fullName: 'Marcus Brody',
      email: 'm.brody@talentos-agency.com',
      passwordHash: defaultPasswordHash,
      role: UserRole.SENIOR_RECRUITER,
      desk: 'US IT Contract (C2C & W2)',
      rateMasked: false,
      status: UserStatus.ACTIVE,
      workload: '8 Requisitions • 14 Submissions',
      lastActiveAt: new Date()
    }
  });

  const userTechRecruiter = await prisma.user.create({
    data: {
      fullName: 'Sarah Jenkins',
      email: 's.jenkins@talentos-agency.com',
      passwordHash: defaultPasswordHash,
      role: UserRole.TECHNICAL_RECRUITER,
      desk: 'Cloud & DevOps Practice',
      rateMasked: true,
      status: UserStatus.ACTIVE,
      workload: '6 Requisitions • 9 Submissions',
      lastActiveAt: new Date()
    }
  });

  const userBenchLead = await prisma.user.create({
    data: {
      fullName: 'David Kim',
      email: 'd.kim@talentos-agency.com',
      passwordHash: defaultPasswordHash,
      role: UserRole.BENCH_SALES_LEAD,
      desk: 'Candidate Bench Marketing',
      rateMasked: false,
      status: UserStatus.ACTIVE,
      workload: '5 Bench Placements • 11 Submissions',
      lastActiveAt: new Date()
    }
  });

  const userAE = await prisma.user.create({
    data: {
      fullName: 'Elena Rostova',
      email: 'e.rostova@talentos-agency.com',
      passwordHash: defaultPasswordHash,
      role: UserRole.ACCOUNT_EXECUTIVE,
      desk: 'Enterprise Client Accounts',
      rateMasked: false,
      status: UserStatus.ACTIVE,
      workload: '4 Client MSAs • 7 Requisitions',
      lastActiveAt: new Date()
    }
  });

  await prisma.user.create({
    data: {
      fullName: 'Priya Patel',
      email: 'p.patel@talentos-agency.com',
      passwordHash: defaultPasswordHash,
      role: UserRole.ASSOCIATE_RECRUITER,
      desk: 'Offshore Sourcing Desk',
      rateMasked: true,
      status: UserStatus.INVITED,
      workload: 'Intake Queue Pending',
      lastActiveAt: null
    }
  });

  // 3. Seed Candidates
  const con1 = await prisma.candidate.create({
    data: {
      fullName: 'Alex Rivera',
      phone: '+1 (512) 555-0182',
      email: 'alex.rivera.cloud@gmail.com',
      workAuth: 'US Citizen',
      education: "Master's in Computer Engineering",
      currentTitle: 'Senior Cloud Security Architect',
      skillset: 'AWS, Kubernetes, Terraform, IAM, FedRAMP',
      hourlyRateW2: 90.00,
      hourlyRateDisplay: '$90/hr (W2)',
      relocation: 'Yes',
      resumeFileName: 'Alex_Rivera_Cloud_Sec_Resume.pdf',
      resumeFormat: 'PDF (3 Pages)',
      assignedRecruiterId: userSeniorRecruiter.id,
      pipelineStage: CandidatePipelineStage.INTERVIEW
    }
  });

  const con2 = await prisma.candidate.create({
    data: {
      fullName: 'Priya Sharma',
      phone: '+1 (415) 555-8392',
      email: 'priya.sharma.java@gmail.com',
      workAuth: 'H-1B',
      education: "Master's in Information Systems",
      currentTitle: 'Lead Java Backend Engineer',
      skillset: 'Java 17, Spring Boot, Kafka, AWS, PostgreSQL',
      hourlyRateC2c: 82.00,
      hourlyRateDisplay: '$82/hr (C2C)',
      relocation: 'Yes',
      resumeFileName: 'Priya_Sharma_FullStack_2026.docx',
      resumeFormat: 'DOCX (4 Pages)',
      assignedRecruiterId: userTechRecruiter.id,
      pipelineStage: CandidatePipelineStage.SUBMITTED
    }
  });

  const con3 = await prisma.candidate.create({
    data: {
      fullName: 'Vikram Malhotra',
      phone: '+1 (404) 555-4921',
      email: 'vikram.data@outlook.com',
      workAuth: 'Green Card',
      education: "Bachelor's in Computer Science",
      currentTitle: 'Principal Data Engineer',
      skillset: 'PySpark, Databricks, Snowflake, Airflow, dbt',
      hourlyRateW2: 95.00,
      hourlyRateDisplay: '$95/hr (W2)',
      relocation: 'No',
      resumeFileName: 'Vikram_Malhotra_DataEngineer.pdf',
      resumeFormat: 'PDF (2 Pages)',
      assignedRecruiterId: userSeniorRecruiter.id,
      pipelineStage: CandidatePipelineStage.SELECTED
    }
  });

  const con4 = await prisma.candidate.create({
    data: {
      fullName: 'Elena Rostova',
      phone: '+1 (408) 555-1928',
      email: 'elena.sre.devops@gmail.com',
      workAuth: 'US Citizen',
      education: "Master's in Systems Engineering",
      currentTitle: 'Staff DevOps & Platform Engineer',
      skillset: 'Kubernetes, Helm, GCP, Python, CI/CD, Terraform',
      hourlyRateW2: 92.00,
      hourlyRateDisplay: '$92/hr (W2)',
      relocation: 'No',
      resumeFileName: 'Elena_Rostova_Platform_SRE.pdf',
      resumeFormat: 'PDF (3 Pages)',
      assignedRecruiterId: userTechRecruiter.id,
      pipelineStage: CandidatePipelineStage.ONBOARDING
    }
  });

  const con5 = await prisma.candidate.create({
    data: {
      fullName: 'David Kim',
      phone: '+1 (212) 555-3819',
      email: 'david.kim.quant@gmail.com',
      workAuth: 'US Citizen',
      education: 'Ph.D. in Computational Finance',
      currentTitle: 'Senior Quant Algorithm Developer',
      skillset: 'C++, Python, Low-Latency, Linux Kernel, FIX',
      hourlyRateW2: 120.00,
      hourlyRateDisplay: '$120/hr (W2)',
      relocation: 'No',
      resumeFileName: 'David_Kim_Quant_Lead.pdf',
      resumeFormat: 'PDF (4 Pages)',
      assignedRecruiterId: userSeniorRecruiter.id,
      pipelineStage: CandidatePipelineStage.BILLABLE
    }
  });

  await prisma.candidate.create({
    data: {
      fullName: 'Ananya Deshmukh',
      phone: '+1 (732) 555-9201',
      email: 'ananya.sap@gmail.com',
      workAuth: 'H-1B',
      education: 'Bachelor of Technology',
      currentTitle: 'Senior SAP S/4HANA Consultant',
      skillset: 'SAP FICO, Central Finance, S/4HANA, GL, AP/AR',
      hourlyRateC2c: 88.00,
      hourlyRateDisplay: '$88/hr (C2C)',
      relocation: 'Yes',
      resumeFileName: 'Ananya_Deshmukh_SAP_FICO.docx',
      resumeFormat: 'DOCX (3 Pages)',
      assignedRecruiterId: userAE.id,
      pipelineStage: CandidatePipelineStage.AVAILABLE_BENCH
    }
  });

  // 4. Seed Clients & Contacts
  const clientPfizer = await prisma.client.create({
    data: {
      name: 'Pfizer Global Health',
      website: 'https://pfizer.com',
      boardNumber: '+1 (212) 733-2323',
      location: 'New York, NY',
      msaStatus: true,
      contacts: {
        create: [
          {
            fullName: 'Robert Vance',
            designation: 'VP Global Infrastructure',
            phone: '+1 (212) 733-1102',
            email: 'robert.vance@pfizer.com',
            isPrimary: true
          }
        ]
      }
    },
    include: { contacts: true }
  });

  const clientCapOne = await prisma.client.create({
    data: {
      name: 'Capital One Financial',
      website: 'https://capitalone.com',
      boardNumber: '+1 (703) 720-1000',
      location: 'McLean, VA',
      msaStatus: true,
      contacts: {
        create: [
          {
            fullName: 'Jessica Albright',
            designation: 'Engineering Director',
            phone: '+1 (703) 720-4491',
            email: 'jessica.albright@capitalone.com',
            isPrimary: true
          }
        ]
      }
    },
    include: { contacts: true }
  });

  const clientDelta = await prisma.client.create({
    data: {
      name: 'Delta Air Lines',
      website: 'https://delta.com',
      boardNumber: '+1 (800) 221-1212',
      location: 'Atlanta, GA',
      msaStatus: true,
      contacts: {
        create: [
          {
            fullName: 'Michael Chang',
            designation: 'Head of Data Platforms',
            phone: '+1 (404) 715-2600',
            email: 'michael.chang@delta.com',
            isPrimary: true
          }
        ]
      }
    },
    include: { contacts: true }
  });

  // 5. Seed Vendors
  const vendorApex = await prisma.vendor.create({
    data: {
      name: 'Apex Talent Solutions Inc.',
      contactName: 'Rajesh Verma',
      phone: '+1 (469) 555-1092',
      email: 'rajesh@apextalent.com',
      location: 'Plano, TX',
      skillSpecialization: 'Cloud, DevOps & SRE',
      paymentTerms: 'Net 45',
      invoicingTerms: 'Bi-weekly',
      msaSigned: true
    }
  });

  const vendorSynapse = await prisma.vendor.create({
    data: {
      name: 'Synapse Infotech Partners',
      contactName: 'Sunita Nair',
      phone: '+1 (732) 555-8812',
      email: 'sunita@synapseinfotech.com',
      location: 'Edison, NJ',
      skillSpecialization: 'Java & AWS Talent',
      paymentTerms: 'Net 30',
      invoicingTerms: 'Bi-weekly',
      msaSigned: true
    }
  });

  // 6. Seed Requirements
  await prisma.requirement.create({
    data: {
      code: 'REQ-1001',
      companyName: 'Pfizer Global Health',
      clientId: clientPfizer.id,
      clientContactId: clientPfizer.contacts[0].id,
      opportunityTitle: 'Senior Cloud Security Architect',
      skillsRequired: 'AWS, Kubernetes, Terraform, IAM, FedRAMP',
      location: 'New York, NY (Hybrid)',
      workModel: WorkModel.HYBRID,
      targetBillRate: 115.00,
      targetPayRate: 80.00,
      status: RequirementStatus.INTERVIEW,
      assignedRecruiterId: userSeniorRecruiter.id
    }
  });

  await prisma.requirement.create({
    data: {
      code: 'REQ-1002',
      companyName: 'Capital One Financial',
      clientId: clientCapOne.id,
      clientContactId: clientCapOne.contacts[0].id,
      opportunityTitle: 'Lead Full-Stack Java / Microservices Engineer',
      skillsRequired: 'Java 17, Spring Boot, Kafka, AWS, PostgreSQL',
      location: 'McLean, VA (Remote)',
      workModel: WorkModel.REMOTE,
      targetBillRate: 120.00,
      targetPayRate: 92.00,
      status: RequirementStatus.SUBMITTED,
      assignedRecruiterId: userTechRecruiter.id
    }
  });

  await prisma.requirement.create({
    data: {
      code: 'REQ-1003',
      companyName: 'Delta Air Lines',
      clientId: clientDelta.id,
      clientContactId: clientDelta.contacts[0].id,
      opportunityTitle: 'Principal Data Engineer (Lakehouse)',
      skillsRequired: 'PySpark, Databricks, Snowflake, Airflow, dbt',
      location: 'Atlanta, GA (Hybrid)',
      workModel: WorkModel.HYBRID,
      targetBillRate: 125.00,
      targetPayRate: 95.00,
      status: RequirementStatus.SELECTED,
      assignedRecruiterId: userSeniorRecruiter.id
    }
  });

  // 7. Seed Billable Placements
  await prisma.placement.create({
    data: {
      recruiterId: userSeniorRecruiter.id,
      candidateId: con5.id,
      clientId: clientPfizer.id,
      customer: 'JPMorgan Chase & Co.',
      customerContact: 'Arthur Pendelton',
      resourceName: 'David Kim',
      phone: '+1 (212) 555-3819',
      email: 'david.kim@jpmchase.com',
      skillRole: 'Lead Quantitative C++ Developer',
      deployment: DeploymentType.ONSHORE,
      startDate: new Date('2025-11-15'),
      endDate: new Date('2026-11-16'),
      billRate: 145.00,
      payRate: 105.00,
      hourlySpread: 40.00,
      marginPct: 27.60,
      placementType: PlacementType.C2C_SUBCONTRACTOR,
      status: PlacementStatus.ACTIVE
    }
  });

  await prisma.placement.create({
    data: {
      recruiterId: userTechRecruiter.id,
      candidateId: con3.id,
      clientId: clientPfizer.id,
      customer: 'Pfizer Global Health',
      customerContact: 'Robert Vance',
      resourceName: 'Vikram Malhotra',
      phone: '+1 (555) 019-2834',
      email: 'vikram.m@pfizer.com',
      skillRole: 'Senior Cloud Security Architect',
      deployment: DeploymentType.ONSHORE,
      startDate: new Date('2026-06-01'),
      endDate: new Date('2027-05-31'),
      billRate: 115.00,
      payRate: 80.00,
      hourlySpread: 35.00,
      marginPct: 30.40,
      placementType: PlacementType.W2_HOURLY,
      status: PlacementStatus.ACTIVE
    }
  });

  await prisma.placement.create({
    data: {
      recruiterId: userAE.id,
      candidateId: con2.id,
      clientId: clientCapOne.id,
      vendorId: vendorSynapse.id,
      customer: 'Capital One Financial',
      customerContact: 'Jessica Albright',
      resourceName: 'Priya Sharma',
      phone: '+1 (703) 555-0142',
      email: 'priya.s@capitalone.com',
      skillRole: 'Lead Full-Stack Java / Microservices',
      deployment: DeploymentType.ONSHORE,
      startDate: new Date('2026-08-10'),
      endDate: new Date('2027-08-09'),
      billRate: 120.00,
      payRate: 92.00,
      hourlySpread: 28.00,
      marginPct: 23.30,
      placementType: PlacementType.C2C_SUBCONTRACTOR,
      status: PlacementStatus.ACTIVE
    }
  });

  // 8. Seed Default Automation Rules
  await prisma.automationRule.create({
    data: {
      name: 'Client Feedback Follow-Up',
      category: AutomationCategory.FEEDBACK,
      icon: 'fa-solid fa-comments',
      color: 'amber',
      active: true,
      triggerEvent: TriggerEvent.FEEDBACK_DELAYED,
      threshold: '2 Days (48h)',
      thresholdUnit: 'HOURS',
      whenText: 'Candidate is awaiting client feedback for',
      thenSummary: 'Notify assigned recruiter & prepare client follow-up email draft',
      actions: [
        { icon: 'fa-solid fa-bell', label: 'Recruiter SLA Task', color: 'blue' },
        { icon: 'fa-solid fa-envelope', label: 'Draft Client Email', color: 'emerald' },
        { icon: 'fa-solid fa-triangle-exclamation', label: 'Escalate if > 72h', color: 'amber' }
      ],
      executionsCount: 6,
      createdById: userAdmin.id
    }
  });

  await prisma.automationRule.create({
    data: {
      name: 'Same-Day Interview Checklist',
      category: AutomationCategory.INTERVIEW,
      icon: 'fa-solid fa-calendar-check',
      color: 'blue',
      active: true,
      triggerEvent: TriggerEvent.INTERVIEW_TODAY,
      threshold: 'Today',
      thresholdUnit: 'HOURS',
      whenText: 'Candidate technical interview is scheduled for',
      thenSummary: 'Send interview prep checklist to candidate and calendar reminder to recruiter',
      actions: [
        { icon: 'fa-solid fa-mobile-screen', label: 'Candidate SMS Prep', color: 'emerald' },
        { icon: 'fa-solid fa-clipboard-check', label: 'Recruiter Briefing', color: 'blue' }
      ],
      executionsCount: 2,
      createdById: userAdmin.id
    }
  });

  await prisma.automationRule.create({
    data: {
      name: 'Contract Expiration Warning',
      category: AutomationCategory.CONTRACT,
      icon: 'fa-solid fa-file-contract',
      color: 'purple',
      active: true,
      triggerEvent: TriggerEvent.CONTRACT_ENDING,
      threshold: '30 Days',
      thresholdUnit: 'DAYS',
      whenText: 'Active placement contract is expiring in',
      thenSummary: 'Notify account executive to initiate SOW renewal or prepare bench re-deployment',
      actions: [
        { icon: 'fa-solid fa-signature', label: 'SOW Extension Alert', color: 'purple' },
        { icon: 'fa-solid fa-arrows-spin', label: 'Bench Re-deployment', color: 'blue' }
      ],
      executionsCount: 3,
      createdById: userAdmin.id
    }
  });

  // 9. Seed Master Taxonomy
  const taxonomies = [
    { category: MasterTaxonomyCategory.WORK_AUTH, value: 'US Citizen', sort: 1 },
    { category: MasterTaxonomyCategory.WORK_AUTH, value: 'Green Card (Permanent Resident)', sort: 2 },
    { category: MasterTaxonomyCategory.WORK_AUTH, value: 'H-1B Specialty Occupation', sort: 3 },
    { category: MasterTaxonomyCategory.WORK_AUTH, value: 'TN Visa (NAFTA)', sort: 4 },
    { category: MasterTaxonomyCategory.WORK_AUTH, value: 'OPT / CPT EAD', sort: 5 },
    { category: MasterTaxonomyCategory.PAYMENT_TERMS, value: 'Net 30 Days', sort: 1 },
    { category: MasterTaxonomyCategory.PAYMENT_TERMS, value: 'Net 45 Days', sort: 2 },
    { category: MasterTaxonomyCategory.PAYMENT_TERMS, value: 'Net 60 Days', sort: 3 },
    { category: MasterTaxonomyCategory.EDUCATION, value: "Master's Degree (MS/MBA)", sort: 1 },
    { category: MasterTaxonomyCategory.EDUCATION, value: "Bachelor's Degree (BS/B.Tech)", sort: 2 },
    { category: MasterTaxonomyCategory.EDUCATION, value: "Doctorate / Ph.D.", sort: 3 }
  ];

  for (const t of taxonomies) {
    await prisma.masterTaxonomy.create({
      data: {
        category: t.category,
        optionValue: t.value,
        sortOrder: t.sort
      }
    });
  }

  // 10. Seed SLA Reminders
  await prisma.slaTask.create({
    data: {
      category: SlaCategory.AWAITING_FEEDBACK,
      slaRuleTag: 'Feedback SLA (>48h)',
      badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
      title: 'Goldman Sachs: Feedback Pending for David Kim',
      description: 'David Kim was submitted for Cyber Security Incident Responder 4 days ago. SLA threshold breached; follow-up recommended.',
      meta: 'Submitted Oct 25, 2026 • Recruiter: Marcus Brody',
      actionType: SlaActionType.PITCH,
      actionLabel: 'Draft Follow-up Pitch',
      assignedUserId: userSeniorRecruiter.id
    }
  });

  await prisma.slaTask.create({
    data: {
      category: SlaCategory.INTERVIEW_TODAY,
      slaRuleTag: 'Interview Radar',
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
      title: 'Pfizer: Elena Rostova Technical Round @ 2:00 PM EST',
      description: 'Second-round video interview with Robert Vance & DevOps panel. Candidate prep checklist pending.',
      meta: 'Scheduled Today @ 2:00 PM • Duration 45m',
      actionType: SlaActionType.PIPELINE,
      actionLabel: 'Open Pipeline',
      assignedUserId: userTechRecruiter.id
    }
  });

  console.log('TalentOS database successfully seeded!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

