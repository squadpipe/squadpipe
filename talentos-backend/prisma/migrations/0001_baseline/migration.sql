-- CreateEnum
CREATE TYPE "AuditStatus" AS ENUM ('EXECUTED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "AutomationCategory" AS ENUM ('FEEDBACK', 'INTERVIEW', 'STALE_REQ', 'CONTRACT', 'COMPLIANCE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "CandidatePipelineStage" AS ENUM ('AVAILABLE_BENCH', 'SUBMITTED', 'INTERVIEW', 'SELECTED', 'ONBOARDING', 'BILLABLE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CustomFieldEntityType" AS ENUM ('CONSULTANT', 'REQUIREMENT', 'CLIENT', 'VENDOR', 'PLACEMENT');

-- CreateEnum
CREATE TYPE "CustomFieldType" AS ENUM ('TEXT', 'DROPDOWN', 'DATE', 'NUMBER', 'BOOLEAN');

-- CreateEnum
CREATE TYPE "DeploymentType" AS ENUM ('ONSHORE', 'NEARSHORE', 'OFFSHORE');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "MasterTaxonomyCategory" AS ENUM ('WORK_AUTH', 'PAYMENT_TERMS', 'EDUCATION', 'STAGES');

-- CreateEnum
CREATE TYPE "PitchTone" AS ENUM ('PROFESSIONAL', 'HIGH_IMPACT', 'TECHNICAL_FOCUS');

-- CreateEnum
CREATE TYPE "PlacementStatus" AS ENUM ('ACTIVE', 'EXPIRING_SOON', 'EXTENDED', 'COMPLETED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "PlacementType" AS ENUM ('C2C_SUBCONTRACTOR', 'W2_HOURLY', 'TEN_NINETY_NINE', 'FULL_TIME');

-- CreateEnum
CREATE TYPE "RequirementStatus" AS ENUM ('REQUIREMENT', 'SUBMITTED', 'INTERVIEW', 'SELECTED', 'ONBOARDING', 'CLOSED');

-- CreateEnum
CREATE TYPE "SlaActionType" AS ENUM ('PITCH', 'PIPELINE', 'MATCHER', 'BILLABLE', 'CHECKLIST');

-- CreateEnum
CREATE TYPE "SlaCategory" AS ENUM ('AWAITING_FEEDBACK', 'INTERVIEW_TODAY', 'STALE_REQUIREMENT', 'CONTRACT_EXPIRING', 'COMPLIANCE_ALERT');

-- CreateEnum
CREATE TYPE "TriggerEvent" AS ENUM ('FEEDBACK_DELAYED', 'INTERVIEW_TODAY', 'STALE_REQ', 'CONTRACT_ENDING', 'VISA_EXPIRING', 'HIGH_MARGIN', 'CUSTOM');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMINISTRATOR', 'SENIOR_RECRUITER', 'TECHNICAL_RECRUITER', 'BENCH_SALES_LEAD', 'ACCOUNT_EXECUTIVE', 'ASSOCIATE_RECRUITER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'INVITED');

-- CreateEnum
CREATE TYPE "WorkModel" AS ENUM ('REMOTE', 'HYBRID', 'ONSITE');

-- CreateTable
CREATE TABLE "AutomationAuditLog" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT,
    "ruleName" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "conditionsMet" TEXT,
    "actionDispatched" TEXT NOT NULL,
    "status" "AuditStatus" NOT NULL DEFAULT 'EXECUTED',
    "errorDetails" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "AutomationCategory" NOT NULL DEFAULT 'FEEDBACK',
    "icon" TEXT NOT NULL DEFAULT 'fa-solid fa-bolt',
    "color" TEXT NOT NULL DEFAULT 'amber',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "triggerEvent" "TriggerEvent" NOT NULL,
    "threshold" TEXT NOT NULL,
    "thresholdUnit" TEXT,
    "whenText" TEXT NOT NULL,
    "thenSummary" TEXT NOT NULL,
    "actions" JSONB NOT NULL,
    "executionsCount" INTEGER NOT NULL DEFAULT 0,
    "lastFiredAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'talentos-agency',

    CONSTRAINT "AutomationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Candidate" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "currentTitle" TEXT NOT NULL,
    "workAuth" TEXT NOT NULL,
    "education" TEXT,
    "skillset" TEXT NOT NULL,
    "hourlyRateW2" DECIMAL(10,2),
    "hourlyRateC2c" DECIMAL(10,2),
    "hourlyRateDisplay" TEXT,
    "relocation" TEXT NOT NULL DEFAULT 'Yes',
    "resumeFileName" TEXT,
    "resumeFormat" TEXT,
    "resumeFileUrl" TEXT,
    "rawSnippet" TEXT,
    "pipelineStage" "CandidatePipelineStage" NOT NULL DEFAULT 'AVAILABLE_BENCH',
    "customFields" JSONB DEFAULT '{}',
    "assignedRecruiterId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'talentos-agency',

    CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "website" TEXT,
    "boardNumber" TEXT,
    "location" TEXT NOT NULL,
    "msaStatus" BOOLEAN NOT NULL DEFAULT true,
    "msaExpirationDate" TIMESTAMP(3),
    "clientType" TEXT DEFAULT 'End Client',
    "customFields" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'talentos-agency',

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientContact" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomFieldDefinition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "entity" "CustomFieldEntityType" NOT NULL,
    "type" "CustomFieldType" NOT NULL DEFAULT 'TEXT',
    "options" JSONB,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'talentos-agency',

    CONSTRAINT "CustomFieldDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "recipientName" TEXT,
    "subject" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "status" "EmailStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "smtpMessageId" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT NOT NULL DEFAULT 'talentos-agency',

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MasterTaxonomy" (
    "id" TEXT NOT NULL,
    "category" "MasterTaxonomyCategory" NOT NULL,
    "optionValue" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MasterTaxonomy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Placement" (
    "id" TEXT NOT NULL,
    "recruiterId" TEXT,
    "candidateId" TEXT,
    "requirementId" TEXT,
    "clientId" TEXT,
    "vendorId" TEXT,
    "customer" TEXT NOT NULL,
    "customerContact" TEXT,
    "resourceName" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "skillRole" TEXT NOT NULL,
    "deployment" "DeploymentType" NOT NULL DEFAULT 'ONSHORE',
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "billRate" DECIMAL(10,2) NOT NULL,
    "payRate" DECIMAL(10,2) NOT NULL,
    "hourlySpread" DECIMAL(10,2) NOT NULL,
    "marginPct" DECIMAL(5,2) NOT NULL,
    "placementType" "PlacementType" NOT NULL DEFAULT 'C2C_SUBCONTRACTOR',
    "purchaseOrderNumber" TEXT,
    "status" "PlacementStatus" NOT NULL DEFAULT 'ACTIVE',
    "customFields" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'talentos-agency',

    CONSTRAINT "Placement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Requirement" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "clientId" TEXT,
    "clientContactId" TEXT,
    "opportunityTitle" TEXT NOT NULL,
    "skillsRequired" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "workModel" "WorkModel" NOT NULL DEFAULT 'REMOTE',
    "targetBillRate" DECIMAL(10,2),
    "maxBillRate" DECIMAL(10,2),
    "targetPayRate" DECIMAL(10,2),
    "status" "RequirementStatus" NOT NULL DEFAULT 'REQUIREMENT',
    "vmsReqId" TEXT,
    "rawEmailText" TEXT,
    "missingNotes" TEXT,
    "customFields" JSONB DEFAULT '{}',
    "assignedRecruiterId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'talentos-agency',

    CONSTRAINT "Requirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SlaTask" (
    "id" TEXT NOT NULL,
    "category" "SlaCategory" NOT NULL,
    "slaRuleTag" TEXT NOT NULL,
    "badgeClass" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "meta" TEXT,
    "actionType" "SlaActionType" NOT NULL DEFAULT 'PITCH',
    "actionLabel" TEXT NOT NULL,
    "isDone" BOOLEAN NOT NULL DEFAULT false,
    "assignedUserId" TEXT,
    "relatedEntityType" TEXT,
    "relatedEntityId" TEXT,
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'talentos-agency',

    CONSTRAINT "SlaTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "recruiterId" TEXT,
    "stage" "RequirementStatus" NOT NULL DEFAULT 'SUBMITTED',
    "pitchEmailSubject" TEXT,
    "pitchEmailBody" TEXT,
    "pitchTone" "PitchTone" NOT NULL DEFAULT 'PROFESSIONAL',
    "submissionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastClientFeedbackDate" TIMESTAMP(3),
    "interviewDate" TIMESTAMP(3),
    "interviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'talentos-agency',

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'TECHNICAL_RECRUITER',
    "desk" TEXT NOT NULL DEFAULT 'US IT Contract (C2C & W2)',
    "rateMasked" BOOLEAN NOT NULL DEFAULT true,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "workload" TEXT DEFAULT '0 Requisitions • 0 Submissions',
    "lastActiveAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "agencyName" TEXT NOT NULL DEFAULT 'TalentOS Staffing',
    "tenantId" TEXT NOT NULL DEFAULT 'talentos-agency',

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "skillSpecialization" TEXT NOT NULL,
    "paymentTerms" TEXT NOT NULL DEFAULT 'Net 45',
    "invoicingTerms" TEXT NOT NULL DEFAULT 'Bi-weekly',
    "msaSigned" BOOLEAN NOT NULL DEFAULT true,
    "coiExpiryDate" TIMESTAMP(3),
    "customFields" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'talentos-agency',

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_settings" (
    "tenant_id" TEXT NOT NULL,
    "general_config" JSONB NOT NULL DEFAULT '{}',
    "smtp_config" JSONB NOT NULL DEFAULT '{}',
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_settings_pkey" PRIMARY KEY ("tenant_id")
);

-- CreateIndex
CREATE INDEX "AutomationAuditLog_createdAt_idx" ON "AutomationAuditLog"("createdAt" ASC);

-- CreateIndex
CREATE INDEX "AutomationAuditLog_ruleId_idx" ON "AutomationAuditLog"("ruleId" ASC);

-- CreateIndex
CREATE INDEX "AutomationRule_active_idx" ON "AutomationRule"("active" ASC);

-- CreateIndex
CREATE INDEX "AutomationRule_category_idx" ON "AutomationRule"("category" ASC);

-- CreateIndex
CREATE INDEX "AutomationRule_tenantId_idx" ON "AutomationRule"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "Candidate_assignedRecruiterId_idx" ON "Candidate"("assignedRecruiterId" ASC);

-- CreateIndex
CREATE INDEX "Candidate_email_idx" ON "Candidate"("email" ASC);

-- CreateIndex
CREATE INDEX "Candidate_fullName_idx" ON "Candidate"("fullName" ASC);

-- CreateIndex
CREATE INDEX "Candidate_pipelineStage_idx" ON "Candidate"("pipelineStage" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Candidate_tenantId_email_key" ON "Candidate"("tenantId" ASC, "email" ASC);

-- CreateIndex
CREATE INDEX "Candidate_tenantId_idx" ON "Candidate"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "Client_name_idx" ON "Client"("name" ASC);

-- CreateIndex
CREATE INDEX "Client_tenantId_idx" ON "Client"("tenantId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Client_tenantId_name_key" ON "Client"("tenantId" ASC, "name" ASC);

-- CreateIndex
CREATE INDEX "ClientContact_clientId_idx" ON "ClientContact"("clientId" ASC);

-- CreateIndex
CREATE INDEX "ClientContact_email_idx" ON "ClientContact"("email" ASC);

-- CreateIndex
CREATE INDEX "CustomFieldDefinition_active_idx" ON "CustomFieldDefinition"("active" ASC);

-- CreateIndex
CREATE INDEX "CustomFieldDefinition_entity_idx" ON "CustomFieldDefinition"("entity" ASC);

-- CreateIndex
CREATE INDEX "CustomFieldDefinition_tenantId_idx" ON "CustomFieldDefinition"("tenantId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "CustomFieldDefinition_tenantId_key_key" ON "CustomFieldDefinition"("tenantId" ASC, "key" ASC);

-- CreateIndex
CREATE INDEX "EmailLog_recipientEmail_idx" ON "EmailLog"("recipientEmail" ASC);

-- CreateIndex
CREATE INDEX "EmailLog_status_idx" ON "EmailLog"("status" ASC);

-- CreateIndex
CREATE INDEX "EmailLog_tenantId_idx" ON "EmailLog"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "MasterTaxonomy_category_idx" ON "MasterTaxonomy"("category" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "MasterTaxonomy_category_optionValue_key" ON "MasterTaxonomy"("category" ASC, "optionValue" ASC);

-- CreateIndex
CREATE INDEX "Placement_customer_idx" ON "Placement"("customer" ASC);

-- CreateIndex
CREATE INDEX "Placement_endDate_idx" ON "Placement"("endDate" ASC);

-- CreateIndex
CREATE INDEX "Placement_resourceName_idx" ON "Placement"("resourceName" ASC);

-- CreateIndex
CREATE INDEX "Placement_status_idx" ON "Placement"("status" ASC);

-- CreateIndex
CREATE INDEX "Placement_tenantId_idx" ON "Placement"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "RefreshToken_token_idx" ON "RefreshToken"("token" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_token_key" ON "RefreshToken"("token" ASC);

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId" ASC);

-- CreateIndex
CREATE INDEX "Requirement_assignedRecruiterId_idx" ON "Requirement"("assignedRecruiterId" ASC);

-- CreateIndex
CREATE INDEX "Requirement_code_idx" ON "Requirement"("code" ASC);

-- CreateIndex
CREATE INDEX "Requirement_companyName_idx" ON "Requirement"("companyName" ASC);

-- CreateIndex
CREATE INDEX "Requirement_status_idx" ON "Requirement"("status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Requirement_tenantId_code_key" ON "Requirement"("tenantId" ASC, "code" ASC);

-- CreateIndex
CREATE INDEX "Requirement_tenantId_idx" ON "Requirement"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "SlaTask_assignedUserId_idx" ON "SlaTask"("assignedUserId" ASC);

-- CreateIndex
CREATE INDEX "SlaTask_category_idx" ON "SlaTask"("category" ASC);

-- CreateIndex
CREATE INDEX "SlaTask_isDone_idx" ON "SlaTask"("isDone" ASC);

-- CreateIndex
CREATE INDEX "SlaTask_tenantId_idx" ON "SlaTask"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "Submission_candidateId_idx" ON "Submission"("candidateId" ASC);

-- CreateIndex
CREATE INDEX "Submission_requirementId_idx" ON "Submission"("requirementId" ASC);

-- CreateIndex
CREATE INDEX "Submission_stage_idx" ON "Submission"("stage" ASC);

-- CreateIndex
CREATE INDEX "Submission_tenantId_idx" ON "Submission"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email" ASC);

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role" ASC);

-- CreateIndex
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "Vendor_name_idx" ON "Vendor"("name" ASC);

-- CreateIndex
CREATE INDEX "Vendor_tenantId_idx" ON "Vendor"("tenantId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_tenantId_name_key" ON "Vendor"("tenantId" ASC, "name" ASC);

-- AddForeignKey
ALTER TABLE "AutomationAuditLog" ADD CONSTRAINT "AutomationAuditLog_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "AutomationRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRule" ADD CONSTRAINT "AutomationRule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_assignedRecruiterId_fkey" FOREIGN KEY ("assignedRecruiterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientContact" ADD CONSTRAINT "ClientContact_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Placement" ADD CONSTRAINT "Placement_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Placement" ADD CONSTRAINT "Placement_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Placement" ADD CONSTRAINT "Placement_recruiterId_fkey" FOREIGN KEY ("recruiterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Placement" ADD CONSTRAINT "Placement_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "Requirement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Placement" ADD CONSTRAINT "Placement_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requirement" ADD CONSTRAINT "Requirement_assignedRecruiterId_fkey" FOREIGN KEY ("assignedRecruiterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requirement" ADD CONSTRAINT "Requirement_clientContactId_fkey" FOREIGN KEY ("clientContactId") REFERENCES "ClientContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requirement" ADD CONSTRAINT "Requirement_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlaTask" ADD CONSTRAINT "SlaTask_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_recruiterId_fkey" FOREIGN KEY ("recruiterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "Requirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

