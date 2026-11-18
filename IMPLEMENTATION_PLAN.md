# SquadPipe SaaS, White-Label & AI — Step-by-Step Implementation Plan

> **Purpose:** Complete, sequential build plan for turning this SquadPipe repository into the **SaaS + White-Label + AI** edition using **one single codebase/Docker build** controlled purely by `.env` (`AI_PROVIDER=none` turns AI completely OFF; setting a provider turns AI ON without rebuilding or redeploying).
>
> **How this updates [AI_PLAN.md](./AI_PLAN.md):** This master plan builds on the provider-agnostic adapter blueprint in `AI_PLAN.md`, removes the old `/smtp/send` client-email-sender step (since SquadPipe intentionally avoids built-in inbox / OAuth email sync), keeps White-Labeling as a clean deploy-time setup on the partner's server (no extra in-app branding UI), and adds the **Public Requirement CV Intake Form**, **Submitted Resume Capability Evaluation**, **AI Usage Quotas / BYO Key**, and **Recruiter Performance UI**.

---

## Architecture Principles & Locked Scope

### Locked Decisions (What We Are Building vs. Skipping)
* **Build:**
  1. Single `.env` switch: **`AI_PROVIDER=none | cloudflare | openai | gemini | anthropic | ollama | custom`** with strict non-AI fallback.
  2. **AI Resume Parser** (cleans messy CVs) + **AI Intake Email Parser** (cleans messy forwarded job emails).
  3. **Shareable Public Requirement CV Intake Form** (`/apply/:token`) connected to each Requirement.
  4. **Submitted Resume Capability Check** (AI Fit Score, Strengths, Gaps, Verdict — with deterministic keyword matching fallback when `AI=false`).
  5. **Rate-Safe Copy-Ready Pitch / Follow-Up Helper** (for pasting into Outlook/Gmail without needing email integration).
  6. **AI Quotas / BYO Key + Recruiter Performance UI** *(White-Label stays deploy-time only on partner servers)*.
  7. *(Optional Phase 7)* **Action Center Background AI Agent** (`STALE_REQ` top-3 prep with human approval).
* **Intentionally Skipped (Out of Scope Now):**
  * In-App White-Label UI (logo uploader / color picker / custom domain manager inside Settings — handled cleanly at server/deploy time for partners instead).
  * Client & Vendor Agreement / E-Sign workflows *(keep existing Vendor MSA/COI alerts as-is)*.
  * Built-in Email Client / Gmail or Outlook 2-way OAuth Sync.
  * Timesheets, Client Invoicing, and Accounting Integrations.
  * Vector Database / RAG *(SQL pre-filtering + top-K LLM evaluation works well up to ~2,000+ CVs per tenant)*.
  * Autonomous AI actions that auto-reject candidates or auto-send external emails without human approval.

---

## Step 1 — Single `.env` AI Switch (`AI_PROVIDER=none` vs Active Provider)

**Goal:** One `.env` setting controls AI per server/deployment using **one identical pre-built codebase**. Flipping `AI_PROVIDER` in `.env` and restarting the backend turns AI UI & endpoints ON or OFF without rebuilding the frontend.

### 1.1 Environment Variables (`.env` / `.env.example` / `docker-compose.yml`)
Add the AI configuration block to `.env.example` and pass the variables through `docker-compose.yml` (`backend` service):
```env
AI_PROVIDER=none                 # none = OFF | cloudflare | openai | gemini | anthropic | ollama | custom
AI_FALLBACK_TO_OFFLINE=true
AI_TIMEOUT_MS=20000
AI_MAX_INPUT_CHARS=16000
AI_MODEL_FAST=gpt-4o-mini
AI_MODEL_SMART=gpt-4.1-mini
OPENAI_API_KEY=
GEMINI_API_KEY=
ANTHROPIC_API_KEY=
CLOUDFLARE_AI_ACCOUNT_ID=
CLOUDFLARE_AI_API_TOKEN=
AI_CUSTOM_BASE_URL=http://localhost:11434/v1
AI_CUSTOM_API_KEY=
```
* **Rule:** If `AI_PROVIDER === 'none'` (or empty, or missing required API key) and the tenant has no active BYO key, treat AI as **OFF** everywhere.

### 1.2 Expose Runtime Flag Inside Existing `GET /api/v1/settings` (`backend/src/routes/index.ts`)
* Instead of adding a new endpoint, simply include `ai` in the existing `GET /api/v1/settings` response (already called on every login):
  ```json
  {
    "success": true,
    "data": {
      "general": { "...": "..." },
      "ai": {
        "enabled": false,
        "provider": "none",
        "features": {
          "resumeParser": false,
          "emailIntake": false,
          "capabilityCheck": false,
          "pitchDraft": false,
          "actionCenterAgent": false
        }
      }
    }
  }
  ```
* Because the React browser app cannot read backend `.env` directly, passing `ai.enabled` in `GET /settings` lets **one identical frontend Docker build** hide or show AI buttons depending purely on that server's `.env`.
* If `tenant_settings.general_config` holds an encrypted BYO API key for a white-label/enterprise tenant, `ai.enabled` resolves `true` for that tenant even when global `AI_PROVIDER=none`.

### 1.3 Frontend Policy Sync (`frontend/src/utils/workspaceBrand.ts`)
* Extend existing `WorkspacePolicies` / `useWorkspacePolicies()` (already updated whenever `initWorkspaceBrand()` or `initWorkspaceCurrency()` fetches `/settings` on login in `frontend/src/App.tsx`).
* **Non-AI behavior (`ai.enabled === false`):** All AI-only badges, `"Run AI Check"` buttons, and AI pitch controls stay hidden automatically; every workflow operates identically to Non-AI mode.

### 1.4 Acceptance Criteria (Step 1)
* Setting `AI_PROVIDER=none` in `.env` returns `ai.enabled: false` in `GET /settings` and hides all AI UI controls cleanly.
* Switching `.env` to `AI_PROVIDER=openai` (with key) and restarting backend flips the UI to AI mode with zero frontend rebuild.
* Missing/blank API keys automatically resolve `ai.enabled: false` without crashing backend boot.

---

## Step 2 — Provider-Agnostic AI Engine (`backend/src/services/ai/`)

**Goal:** Build one isolated AI service folder so changing AI vendors requires only `.env` changes, and every response is guaranteed valid typed JSON or safe fallback.

### 2.1 Files to Create (`backend/src/services/ai/`)
Follow the structure defined in `AI_PLAN.md`:
1. `ai.types.ts`: `AiProviderName`, `AiTaskTier` (`'fast' | 'smart'`), `AiProviderAdapter`, `AiCompletionResult`.
2. `ai.schemas.ts`: Strict `zod` schemas for all 4 structured tasks:
   * `ResumeParseAiSchema`
   * `EmailIntakeAiSchema`
   * `SubmissionCapabilityAiSchema` (`fitScore: 0..100`, `strengths: string[]`, `gaps: string[]`, `verdict: string`, `recommendation: 'STRONG_FIT' | 'GOOD_FIT' | 'PARTIAL_FIT' | 'LOW_FIT'`)
   * `BatchRankAiSchema`
3. `ai.json.ts`: Strips markdown code fences, parses JSON, runs `zod.safeParse()`, and performs **at most 1 lightweight JSON repair retry** before throwing to fallback.
4. `providers/none.provider.ts`: Clean no-op provider.
5. `providers/openaiCompatible.provider.ts`: Single native Node 20 `fetch` client supporting **OpenAI**, **Cloudflare Workers AI**, **Google Gemini (OpenAI endpoint)**, **Ollama**, and **Custom endpoints**, using `AbortSignal.timeout(AI_TIMEOUT_MS)`.
6. `providers/anthropic.provider.ts`: Native `fetch` client for Anthropic `/v1/messages`.
7. `ai.router.ts`: Resolves active adapter from `.env` (or encrypted tenant BYO key override).
8. `ai.service.ts`: High-level methods called by routes/services:
   * `enhanceResumeParse(rawText, baselineFields, tenantId)`
   * `enhanceEmailIntakeParse(rawEmailText, baselineFields, tenantId)`
   * `evaluateSubmissionCapability(candidateData, requirementData, { rateMasked, tenantId })`
   * `rankCandidatesForRequirement(candidates, requirement, { rateMasked, tenantId })`
   * `draftClientPitch(candidate, requirement, { tone, purpose, rateMasked, tenantId })`

### 2.2 Strict Security & Cost Guardrails Built Into `ai.service.ts`
* **Input truncation:** Enforce `AI_MAX_INPUT_CHARS` (default `16000` chars) before sending long resumes/emails.
* **Rate-Masking Enforcement:** Never include `targetBillRate`, `maxBillRate`, `billRate`, `hourlySpread`, or `marginPct` in any prompt or draft when `rateMasked === true` (and never include internal rates in public-facing candidate summaries unless specifically authorized).
* **PII Minimization in Ranking:** Send candidate skills, title, work auth, experience snippet, and rate tier — omit unnecessary personal contact info when ranking/scoring.
* **Fail-Safe Fallback:** If `AI_FALLBACK_TO_OFFLINE=true` and an API errors/times out, catch cleanly, log a warning, and return the non-AI baseline with `aiUsed: false`.

### 2.3 Acceptance Criteria (Step 2)
* Unit tests in `backend/tests/unit/ai.test.ts` confirm fence stripping, Zod validation, repair retry, timeout handling, rate-mask scrubbing, and `AI_PROVIDER=none` behavior without needing live API keys.

---

## Step 3 — AI Resume Parser & AI Intake Email Parser

**Goal:** Upgrade existing parsing endpoints while keeping 100% deterministic Python/Node fallback when `AI=false`.

### 3.1 Upgrade `POST /api/v1/parse-resume` (`backend/src/routes/index.ts`)
1. Always extract raw text & baseline fields first using Python `resume-parser` (`pdfplumber` / `python-docx` / `spaCy`) — or the Node text fallback if Python parser is unavailable. *(Do NOT parse binary PDFs directly in Node or send raw binary PDFs to expensive vision models in v1.)*
2. Check if AI is enabled for tenant:
   * **If `AI = false`:** Return baseline result directly (`aiUsed: false`).
   * **If `AI = true`:** Pass `raw_text_snippet` + baseline fields to `aiService.enhanceResumeParse()` (`tier: 'fast'`) to clean split names, fix messy 2-column titles, normalize technical skills, verify `work_auth`, extract `education`, and generate a clean `professional_summary`.
   * Keep exact response keys compatible with `frontend/src/components/modals/ResumeParserModal.tsx` and return `aiUsed: true | false`.

### 3.2 Upgrade `POST /api/v1/parse-email` (`backend/src/routes/index.ts`)
1. Run existing `extractEmailHeuristics()` + Python `resumeParserClientService.parseEmail()` as baseline.
2. **If `AI = false`:** Return merged baseline (`aiUsed: false`).
3. **If `AI = true`:** Call `aiService.enhanceEmailIntakeParse()` (`tier: 'fast'`) first to handle forwarded email chains, multiple rates (`$85 W2 / $110 C2C`), hybrid schedules, and missing info notes; merge/fall back cleanly to `extractEmailHeuristics()`.
4. **Frontend (`frontend/src/features/modals/EmailParserModal.tsx` & `ResumeParserModal.tsx`):**
   * Show subtle `"AI Enhanced"` pill only when `res.data.aiUsed === true`.

### 3.3 Bonus High-Value Upgrade: Bulk Multi-CV Upload (`ResumeParserModal.tsx` / `ImportDataView.tsx`)
* Allow selecting/dropping multiple `.pdf`/`.docx` resumes (e.g., up to 20 per batch), queuing sequential calls to `/parse-resume` + `/candidates` with progress bar (`4 / 20 parsed`), duplicate-email skip/merge handling, and works in **both** AI and Non-AI modes.

### 3.4 Acceptance Criteria (Step 3)
* Tested with messy 2-column `.pdf` & `.docx` CVs and messy forwarded job emails under both `AI_PROVIDER=openai` (active) and `AI_PROVIDER=none` (offline).

---

## Step 4 — Shareable Requirement CV Intake Form (Per Requirement)

**Goal:** Every Requirement gets a public, shareable application link (`/apply/:token`) so candidates or sub-vendors can submit CVs straight into that job — with zero login required and zero exposure of internal bill rates.

### 4.1 Database Changes (`backend/prisma/schema.prisma`)
On `Requirement`:
* `publicFormEnabled Boolean @default(false)`
* `publicFormToken String? @unique` (cryptographically random URL-safe slug/token generated when enabled or created, never guessable sequential IDs)
* Optional `publicDescription String? @db.Text` (clean client-safe summary shown on the public form instead of raw forwarded internal emails)

On `Submission`:
* `intakeSource String @default("MANUAL")` (`"MANUAL"` | `"BENCH_MATCH"` | `"PUBLIC_FORM"`)
* `submittedRate String?` (expected rate entered on form or submitted rate)
* `submittedVendorName String?` (if submitted via a partner vendor on the form)

Run `npx prisma migrate dev` and update `prisma/migrations/`.

### 4.2 Backend Public Intake Routes (`backend/src/routes/index.ts` — Placed BEFORE `authenticateJwt`)
Add rate-limited public endpoints (reusing `authRateLimiter` / `uploadRateLimiter` from `backend/src/middlewares/security.middleware.ts`):
1. `GET /api/v1/public/apply/:token`:
   * Looks up `Requirement` where `publicFormToken = token` and `publicFormEnabled = true` and `status !== 'CLOSED'`.
   * Fetches tenant white-label brand from `getTenantSettings(reqRecord.tenantId)`.
   * **STRICT SECURITY ALLOWLIST — Returns ONLY safe fields:**
     * `agencyName` (from existing **General Settings** / `APP_NAME`)
     * `code`, `opportunityTitle`, `location`, `workModel`, `skillsRequired`, `openPositions`, `publicDescription`
     * **NEVER return:** `companyName` (optional toggle or agency-masked), `targetBillRate`, `maxBillRate`, `targetPayRate`, `rawEmailText`, `missingNotes`, or `clientContact` email/phone.
2. `POST /api/v1/public/apply/:token` (`uploadRateLimiter`, `optionalSingleCvUpload`):
   * Validates honeypot anti-spam field + required inputs (`fullName`, `email`, `phone`, `workAuth`, CV file).
   * Step A: Upload CV via `cvStorageService.uploadCv(req.file, requirement.tenantId)` (`backend/src/services/cvStorage.service.ts`).
   * Step B: Parse CV text using the Step 3 pipeline (`AI=true` enhances if enabled, else `AI=false` offline parser).
   * Step C: Upsert/match `Candidate` inside `requirement.tenantId` by `[tenantId, email]`:
     * If new candidate: create via `candidateService.createCandidate()` logic (reusing CV storage & parsed skills/title/snippet; default `pipelineStage: SUBMITTED` or keep `AVAILABLE_BENCH` if already active).
     * If existing candidate in tenant: update latest CV/skills carefully without wiping active billable stage.
   * Step D: Create or prevent duplicate `Submission` for `(requirementId, candidateId)` via `submission.service.ts` (`intakeSource: 'PUBLIC_FORM'`, `submittedRate`, `submittedVendorName`).
   * Step E: Automatically trigger **Capability Evaluation** (Step 5) on the new `Submission`!
   * Step F: Record an entry in `AutomationAuditLog` / notification so the assigned recruiter sees the new application immediately.

### 4.3 Authenticated Recruiter Toggle Route (`POST /api/v1/requirements/:id/public-form`)
* Lets recruiters toggle `publicFormEnabled` ON/OFF, regenerate `publicFormToken` if needed, and optionally edit `publicDescription`.

### 4.4 Frontend Public Form & Recruiter Controls
1. **Recruiter UI (`frontend/src/features/requirements/RequirementDetailPage.tsx`):**
   * Header card / sidebar widget: **Public CV Form** toggle (`ON / OFF`), **Copy Form Link** button (`https://<origin>/apply/<token>`), preview/edit `Public Description` button, and `"Form Intake"` badge on submissions received via the form.
2. **Public Application Page (`frontend/src/features/public/PublicRequirementApplyView.tsx`):**
   * In `frontend/src/App.tsx` (before the `if (!currentUser)` login redirect around line 1821), detect `/apply/<token>` cleanly so candidates/vendors can open the link directly without logging in.
   * Clean branded card with job info, drag-and-drop `.pdf`/`.docx` CV uploader, form fields (`Full Name *`, `Email *`, `Phone *`, `Work Authorization *`, `Expected Hourly Rate`, `Vendor / Agency Name (Optional)`), honeypot field, and crisp `"Application Submitted"` confirmation screen.

### 4.5 Acceptance Criteria (Step 4)
* Opening `/apply/:token` incognito displays only public-safe job details (zero bill rates/margins/client emails in network response).
* Submitting a PDF creates CV file in storage, creates/links Candidate + Submission on that Requirement, and handles duplicate re-submissions cleanly.
* Disabling the toggle returns `404` / `"This position is no longer accepting applications"`.

---

## Step 5 — Submitted Resume Capability Check (AI Fit Evaluator + Non-AI Fallback)

**Goal:** Automatically score every candidate's resume against the Requirement's JD & skills — both when submitted via the Public CV Form and when attached manually inside the CRM.

### 5.1 Database Changes (`backend/prisma/schema.prisma`)
Add structured capability fields on `Submission`:
* `capabilityScore Int?` (`0` to `100`)
* `capabilitySummary Json?` (`{ recommendation, verdict, strengths: string[], gaps: string[], evaluatedWithAi: boolean, evaluatedAt: string }`)

### 5.2 Unified Capability Service (`backend/src/services/capability.service.ts`)
Called automatically on `PUBLIC_FORM` submit, manually via `POST /api/v1/submissions/:id/evaluate`, and optionally on `POST /api/v1/match-skills`:
* **When `AI = true`:**
  * Sends candidate's extracted resume text (`rawSnippet`), skills, title, workAuth, and rate vs. Requirement's title, `skillsRequired`, location, workModel, and `rawEmailText` JD snippet (respecting `rateMasked` and `AI_MAX_INPUT_CHARS`).
  * Returns `fitScore` (0–100), `recommendation` (`Strong Fit` / `Good Fit` / `Partial Fit` / `Low Fit`), top 3–4 `strengths` (catching related tech like `AKS` ≈ `Kubernetes`), top 2–3 `gaps`, and 1-sentence `verdict`.
* **When `AI = false` (Deterministic Fallback):**
  * Uses normalized keyword/synonym matching between `requirement.skillsRequired` and `candidate.skillset + candidate.rawSnippet` (matching the same logic as `computeCandidateSkillMatch()` in `AttachBenchDrawer.tsx`) → stores deterministic `capabilityScore` + `Matched Skills` / `Missing Skills` (`evaluatedWithAi: false`).

### 5.3 Frontend UI (`RequirementDetailPage.tsx` & `AttachBenchDrawer.tsx`)
* **Inside `RequirementDetailPage.tsx` Applicants Table:**
  * Show a clean **Capability Fit Badge** (`92% • Strong Fit` in green, `68% • Partial Fit` in amber, etc.) per applicant, sorted highest-fit first (or sortable).
  * Click/expand badge to inspect **Matched Strengths**, **Missing Gaps**, and **Recruiter Verdict**.
  * Show **"Run AI Check"** button on existing submissions when `aiEnabled === true` (hidden when `aiEnabled === false`).
* **Inside `AttachBenchDrawer.tsx` (`Skill Matcher`):**
  * Keep instant local keyword match on open; when `aiEnabled === true`, add **"AI Rank Top Matches"** button calling `/api/v1/match-skills` (SQL pre-filters top 25 candidates first, then AI ranks & explains).

### 5.4 Acceptance Criteria (Step 5)
* Submitting via `/apply/:token` populates `capabilityScore` + `capabilitySummary` in both `AI=true` (LLM analysis) and `AI=false` (deterministic skill match) modes.
* Zero bill rate / margin fields leak to rate-masked users.

---

## Step 6 — Rate-Safe Client Pitch & Follow-Up Copy Helper (No Email Sync Needed)

**Goal:** Let recruiters send faster emails using **their own Outlook or Gmail** with 1-click generated copy, without SquadPipe needing OAuth or SMTP inbox hosting.

### 6.1 Backend Endpoint (`POST /api/v1/submissions/:id/pitch-draft`)
* Uses `pitchTone` (`PROFESSIONAL` | `HIGH_IMPACT` | `TECHNICAL_FOCUS` already in `schema.prisma`) and `purpose` (`client_pitch` | `interview_followup`).
* Respects `req.user.rateMasked`: if masked, never injects candidate pay/bill rates or agency spread.
* **When `AI = true`:** `aiService.draftClientPitch()` writes a crisp 4–5 line email body + subject referencing matched strengths from the resume.
* **When `AI = false`:** Returns a clean deterministic structured template built from candidate title, top skills, work auth, availability, and agency name.

### 6.2 Frontend UI (`RequirementDetailPage.tsx` & `ConsultantDetailPage.tsx`)
* Add **"Prepare Pitch"** button on each applicant row:
  * Opens compact modal showing editable Subject + Message + **"Copy Text"** button + **"Open in Email (`mailto:`)"** button + reminder/shortcut to attach the downloaded **Profile PDF** or **Original CV**.
* Add optional **"Blind / Redacted PDF"** checkbox before downloading `generateCandidateResumePdf()` (`frontend/src/utils/pdfGenerator.ts`) to hide candidate phone/email when desired.

---

## Step 7 — SaaS Usage Controls, Recruiter Performance UI & White-Label Deploy Setup

**Goal:** Keep SaaS AI billing safe, surface recruiter metrics, and deploy cleanly for white-label partners without adding in-app white-label UI bloat.

### 7.1 White-Label Deploy Checklist (Server / Build Level Only — Zero In-App UI)
When deploying onto a white-label partner’s server, branding takes 5 minutes at deploy time:
1. Set `APP_NAME` in `.env` (already supported in `backend/src/services/emailTemplate.service.ts`).
2. Swap partner name/SVG icon in `frontend/src/components/shared/BrandMark.tsx` and `<title>` + favicon in `frontend/index.html`.
3. Configure partner’s company name, website, email, phone, and currency in **General Settings** (already updates **Profile Brief PDFs** and email templates).

### 7.2 AI Usage Metering & BYO Key (`schema.prisma` + `SettingsView.tsx`)
* Add `AiUsageLog` model in `backend/prisma/schema.prisma`:
  * `id`, `tenantId`, `userId?`, `provider`, `model`, `feature` (`resume_parse` | `email_parse` | `capability_check` | `match_rank` | `pitch_draft` | `agent_prep`), `inputTokens`, `outputTokens`, `latencyMs`, `createdAt`.
* Enforce configurable monthly tenant AI action/token limits (gracefully falling back to Non-AI mode with a clear notice if quota is reached).
* Optional **BYO AI Key** section in `SettingsView` (encrypted using `SETTINGS_ENCRYPTION_KEY`, exposed only for authorized SaaS/enterprise plans).

### 7.3 Recruiter Performance Dashboard UI (`analytics.service.ts` Already Built!)
* Wire the existing `GET /api/v1/dashboard/recruiter-performance?period=week|month|all` endpoint (`backend/src/routes/index.ts` + `backend/src/services/analytics.service.ts`) into `DashboardView.tsx` (or a new **Team Performance** card/tab):
  * Displays per-recruiter **Open Reqs**, **Submissions**, **Interviews**, **Placements**, and conversion % by Weekly / Monthly / All-Time periods.

---

## Step 8 — *(Optional Phase Later)* Action Center AI Agents

**Only add after Steps 1–7 are live with customers:**
* Add `agentPayload Json?` on `SlaTask` (`backend/prisma/schema.prisma`).
* Inside `slaEngine.service.ts`, **only once when a new `SlaTask` is created** (and AI is active via `AI_PROVIDER !== 'none'`):
  * **`STALE_REQ` ("Jobs Without Applicants"):** Run SQL hard-filters + `rankCandidatesForRequirement()` on top 20 `AVAILABLE_BENCH` candidates → store Top 3 suggestions on `SlaTask.agentPayload`.
  * **`AWAITING_FEEDBACK` / `CONTRACT_ENDING`:** Pre-draft a rate-safe follow-up or renewal message on `SlaTask.agentPayload`.
* Render suggestions inside `frontend/src/components/layout/SlaDrawer.tsx` with 1-click **[Review & Attach]** or **[Copy Message]** buttons (always Human-in-the-Loop).

---

## End-to-End Verification Checklist (Required Before Any Release)

1. **Non-AI Parity Test (`AI_PROVIDER=none`):**
   * Boot stack with no AI API keys (`AI_PROVIDER=none`).
   * Verify `GET /api/v1/settings` returns `ai.enabled: false` and UI shows zero AI clutter.
   * Test: Upload CV, Paste Job Email, Open Public `/apply/:token` & Submit CV (verify non-AI skill match score populates), Attach Bench, Activate Placement, `Require PO Number`, `End Before Delete`.
2. **AI Mode Test (`AI_PROVIDER=openai | cloudflare | gemini`):**
   * Switch only `.env` and restart backend (no frontend rebuild), verify `GET /api/v1/settings` returns `ai.enabled: true`.
   * Test Resume Parse, Email Parse, Public Form CV Capability Score, Skill Matcher ranking, and Pitch Draft across configured provider (`openai` / `cloudflare` / `gemini`).
3. **Failure & Timeout Resilience:**
   * Simulate invalid API key / unreachable AI endpoint with `AI_FALLBACK_TO_OFFLINE=true` → verify every endpoint returns HTTP `200` with clean Non-AI fallback results (`aiUsed: false`).
4. **Security & Privacy Audit:**
   * Verify `GET /api/v1/public/apply/:token` never returns `targetBillRate`, `maxBillRate`, `targetPayRate`, or `clientContact` email/phone.
   * Verify `rateMasked = true` users never receive financial rates/margins inside AI match summaries or pitch drafts.
   * Verify all DB queries and `AiUsageLog` / `SlaTask` queries strictly scope by `tenantId`.
5. **Automated Checks:**
   * `cd backend && npx tsc --noEmit && npm test`
   * `cd frontend && npx tsc --noEmit && npm run build`
   * `cd resume-parser && python tests/test_parser.py`
