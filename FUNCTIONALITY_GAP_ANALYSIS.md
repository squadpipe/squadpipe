# TalentOS CRM — Actual Functionality Gap Analysis

This document catalogs every verified gap between the current prototype-oriented behaviors and a production-ready, multi-tenant SaaS implementation across the TalentOS frontend, backend API, and microservice layers.

---

## 1. Authentication, Session & Multi-Tenancy Gaps

### 1.1 Password Verification Bypass in Login Controller — **[RESOLVED]**
- **Location**: `talentos-backend/src/controllers/auth.controller.ts#L36`
- **Resolution**: Replaced the bypass condition (`password === 'talentos2026' || user.passwordHash?.length > 0`) with `bcrypt.compare(password, user.passwordHash)` verification.

### 1.2 Frontend In-Memory Cache Leak Across Account Switches — **[RESOLVED]**
- **Location**: `talentos-frontend/src/App.tsx`
- **Resolution**: Added `resetWorkspaceState()` to clear `loadedEntities.current` and reset all entity arrays (`candidates`, `requirements`, `clients`, `vendors`, `placements`, `users`, `slaTasks`, `rules`, `auditLogs`, `customFields`, and `sidebarCounts`) inside both `handleSignOut` and `onLoginSuccess`.

### 1.3 My Profile Modal Saves Only to `localStorage` — **[RESOLVED]**
- **Location**: `talentos-backend/src/controllers/auth.controller.ts`, `talentos-backend/src/routes/index.ts`, `talentos-frontend/src/App.tsx`
- **Resolution**: Added `PATCH /api/v1/auth/profile` (`authController.updateProfile`) and wired `handleUpdateProfile` in `App.tsx` to persist profile updates in PostgreSQL before syncing `localStorage`/`sessionStorage`.

### 1.4 Forgot / Reset Password Uses In-Memory Code Storage — **[RESOLVED]**
- **Location**: `talentos-backend/src/controllers/auth.controller.ts`
- **Resolution**: Persisted 6-digit password reset tokens in PostgreSQL `RefreshToken` (15-minute expiry, one-time revocation via `revokedAt`), logged an `EmailLog` entry, and enforced token validation in `resetPassword`.

---

## 2. Pipeline & Job Requirement Lifecycle Gaps

### 2.1 Broken Requirement Stage Update Endpoint (404 on Move) — **[RESOLVED]**
- **Location**: `talentos-frontend/src/App.tsx`, `talentos-backend/src/routes/index.ts`
- **Resolution**: Updated `handleStatusChange` and `handleConfirmPlacement` in `App.tsx` to call `PATCH /api/v1/requirements/:id/stage` and added `PUT /requirements/:id` as a route alias in `routes/index.ts`.

### 2.2 Broken Candidate Assignment & Missing `resourceName` Persistence — **[RESOLVED]**
- **Location**: `talentos-frontend/src/App.tsx`, `talentos-backend/src/services/requirement.service.ts`
- **Resolution**: Updated `handleAssignCandidate` to post to `POST /api/v1/submissions`, included `submissions: { include: { candidate: true } }` in `RequirementService.getRequirements()` and `createRequirement()`, and mapped `submissions[0].candidate.fullName` into `resourceName` in `fetchRequirements()`.

### 2.3 Prisma Uppercase Enums vs. Frontend Title-Case Strings — **[RESOLVED]**
- **Location**: `talentos-frontend/src/App.tsx`
- **Resolution**: Added `formatCandidateStage`, `formatRequirementStatus`, `formatUserRole`, and `formatUserStatus` normalizers across `fetchCandidates`, `fetchRequirements`, `fetchUsers`, and login/create state merges.

---

## 3. Entity Creation, Edit & Delete (CRUD) Gaps

### 3.1 Optimistic Create Keeps Temporary Client IDs — **[RESOLVED]**
- **Location**: `talentos-frontend/src/App.tsx`
- **Resolution**: Updated `onSave` handlers for all 5 create modals (`AddConsultantModal`, `AddRequirementModal`, `AddClientModal`, `AddVendorModal`, `AddPlacementModal`) and `handleConfirmPlacement` to `await apiClient.post(...)`, store the server-returned UUID (`id`) and generated `code`, and refresh sidebar counts.

### 3.2 Missing Delete UI Actions Across Core Modules — **[RESOLVED]**
- **Location**: `App.tsx`, `ConsultantsView.tsx`, `PipelineView.tsx`, `ClientsView.tsx`, `VendorsView.tsx`, `BillablePlacementsView.tsx`
- **Resolution**: Added `handleDeleteCandidate`, `handleDeleteRequirement`, `handleDeleteClient`, `handleDeleteVendor`, and `handleDeletePlacement` wired to `DELETE /api/v1/<entity>/:id` and exposed delete buttons across all 5 views.

---

## 4. Consultant Roster, Resume Storage & Parser Gaps

### 4.1 Static Placeholder Resume Preview & Non-Functional Download — **[RESOLVED]**
- **Location**: `talentos-frontend/src/components/modals/ResumeViewerModal.tsx`
- **Resolution**: Updated `ResumeViewerModal.tsx` to render `candidate.rawSnippet` when available instead of hardcoded sample experience and implemented real client-side `Blob` file download for the candidate's dossier (`_Resume_Dossier.txt`).

### 4.2 Direct Port 8000 Fetch & Non-UUID State in `ResumeParserModal` — **[RESOLVED]**
- **Location**: `talentos-backend/src/routes/index.ts`, `talentos-frontend/src/components/modals/ResumeParserModal.tsx`
- **Resolution**: Added `POST /api/v1/parse-resume` in `talentos-backend` using `multer` to forward `multipart/form-data` to `talentos-resume-parser` (with regex fallback extraction if unreachable), routed `ResumeParserModal` uploads through `apiClient.post('/parse-resume', ...)`, and persisted the returned UUID on `handleApprove`.

---

## 5. Clients, Vendors & User Management Gaps

### 5.1 Client Detail Drawer "+ Add Contact" Is a No-Op — **[RESOLVED]**
- **Location**: `talentos-backend/src/routes/index.ts`, `talentos-frontend/src/components/modals/ClientDetailDrawer.tsx`, `ClientsView.tsx`
- **Resolution**: Added `POST /api/v1/clients/:id/contacts` in `talentos-backend` and implemented an inline Add Contact form in `ClientDetailDrawer.tsx` that persists new `ClientContact` rows and syncs `clients` state.

### 5.2 Vendor MSA Status Badge Always Renders "Pending Review" — **[RESOLVED]**
- **Location**: `talentos-frontend/src/features/vendors/VendorsView.tsx#L93`
- **Resolution**: Updated the condition to `v.msa === 'Yes' || v.msa === 'Active'` so active MSAs render `"MSA Executed"`.

### 5.3 User Invite Payload Mismatch (500 Error on Invite) — **[RESOLVED]**
- **Location**: `talentos-backend/src/services/user.service.ts`, `talentos-frontend/src/App.tsx`
- **Resolution**: Updated `userService.inviteUser` to accept `fullName || name`, normalize display role strings to valid `UserRole` enum values, and updated `onInviteUser` in `App.tsx` to store the persisted user record returned by the server.

---

## 6. Email Pitch Writer & Intake Parser Gaps

### 6.1 Submission Pitch Writer Calls Non-Existent `/api/v1/smtp/send` Route — **[RESOLVED]**
- **Location**: `talentos-backend/src/routes/index.ts`, `talentos-frontend/src/features/modals/SubmissionPitchModal.tsx`
- **Resolution**: Implemented `POST /api/v1/smtp/send` using `smtpService.sendMail` (persisting `EmailLog` per tenant), switched `SubmissionPitchModal` to `apiClient.post('/smtp/send', ...)`, added editable recipient email/subject/body inputs, and added a consultant selector when opened without a pre-selected candidate.

### 6.2 Email Intake Parser Unsynced State — **[RESOLVED]**
- **Location**: `talentos-frontend/src/features/modals/EmailParserModal.tsx`
- **Resolution**: Updated `handleApprove` in `EmailParserModal.tsx` to assign the server-returned `id` and `code` from `POST /api/v1/requirements` before invoking `onApprove` and refreshing sidebar counts.

