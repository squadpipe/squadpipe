# SquadPipe — Provider-Agnostic AI Architecture & Rollout Plan

> **Purpose:** Add AI capabilities to SquadPipe without locking into any single AI vendor. Switching between **No AI** (offline On-Prem), **Cloudflare Workers AI**, **OpenAI**, **Google Gemini**, **Anthropic Claude**, or **Local Ollama / vLLM** (private On-Prem LLM) should only require changing environment configuration (`AI_PROVIDER`), with zero changes to routes, database logic, or UI components.

---

## 1. Design Principles (Why It Won't Break When Switching Providers)

1. **Follow the existing `cvStorage.service.ts` adapter pattern**
   - Just as `backend/src/services/cvStorage.service.ts` abstracts `'local' | 's3' | 'cloudflare'`, all AI calls must go through a single `AiProviderAdapter` interface instead of calling vendor SDKs inside controllers or services.
2. **Use `AI_MODEL_FAST` + `AI_MODEL_SMART` task tiers (not hardcoded model IDs)**
   - Feature code requests a capability tier (`fast` for extraction/cleanup/classification, `smart` for candidate ranking & email drafting), and `.env` maps those tiers to the chosen provider's current models.
3. **One `zod` schema validator + JSON repair layer for every provider**
   - Different LLMs format JSON slightly differently (some return raw JSON, some wrap in markdown fences, some omit optional keys). Using the `zod` package already installed in `backend/package.json` ensures every provider returns the exact same typed contract before reaching controllers or React.
4. **Always keep Non-AI fallback active (`AI_FALLBACK_TO_OFFLINE=true`)**
   - Every AI-enhanced feature delegates gracefully to the existing offline pipeline (`backend/src/services/resumeParserClient.service.ts`, regex heuristics in `backend/src/routes/index.ts`, and `computeCandidateSkillMatch` in `frontend/src/components/modals/AttachBenchDrawer.tsx`) when `AI_PROVIDER=none` or if an external AI API times out.
5. **SQL filters first, LLM reasoning second (no heavy RAG needed for v1)**
   - PostgreSQL (`Candidate` and `Requirement` models in `backend/prisma/schema.prisma`) handles exact hard filters (`tenantId`, `pipelineStage`, `workAuth`, `hourlyRateW2` / `hourlyRateC2c` / `maxBillRate`, `workModel`, `location`). The LLM only ranks and explains pre-filtered candidates.

---

## 2. Target Environment Variables (`.env` / `.env.example`)

Add an AI block following the same style as `CV_STORAGE_PROVIDER` in `.env.example`:

```env
# ------------------------------------------------------------------------------
# AI Provider Configuration (none | cloudflare | openai | gemini | anthropic | ollama | custom)
# ------------------------------------------------------------------------------
AI_PROVIDER=none
AI_FALLBACK_TO_OFFLINE=true
AI_TIMEOUT_MS=20000
AI_MAX_INPUT_CHARS=16000

# Task-tier model names (change per selected AI_PROVIDER)
AI_MODEL_FAST=@cf/meta/llama-3.1-8b-instruct
AI_MODEL_SMART=@cf/meta/llama-3.3-70b-instruct-fp8-fast

# Optional: Unified Gateway (e.g., Cloudflare AI Gateway URL to swap/log providers centrally)
AI_GATEWAY_BASE_URL=

# 1. Cloudflare Workers AI (AI_PROVIDER=cloudflare)
CLOUDFLARE_AI_ACCOUNT_ID=
CLOUDFLARE_AI_API_TOKEN=

# 2. OpenAI (AI_PROVIDER=openai)
OPENAI_API_KEY=

# 3. Google Gemini (AI_PROVIDER=gemini — via Gemini OpenAI-compatible endpoint)
GEMINI_API_KEY=

# 4. Anthropic Claude (AI_PROVIDER=anthropic)
ANTHROPIC_API_KEY=

# 5. Self-Hosted / On-Prem LLM (AI_PROVIDER=ollama or custom OpenAI-compatible endpoint)
AI_CUSTOM_BASE_URL=http://localhost:11434/v1
AI_CUSTOM_API_KEY=
```

### Provider Switching Matrix

| Mode / Vendor | `AI_PROVIDER` | Endpoint Style | Suggested `AI_MODEL_FAST` | Suggested `AI_MODEL_SMART` | Best Use Case |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Non-AI / Offline** | `none` | Local `resume-parser` + SQL | — | — | Privacy-strict On-Prem ($2,500 license fallback) |
| **Cloudflare AI** | `cloudflare` | OpenAI-compatible (`/ai/v1`) | `@cf/meta/llama-3.1-8b-instruct` | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | Low-cost SaaS default ($59+ plans / UK white-label) |
| **OpenAI** | `openai` | OpenAI-compatible | `gpt-4o-mini` | `gpt-4o` / `gpt-4.1` | Maximum accuracy when margin supports higher token cost |
| **Google Gemini** | `gemini` | Gemini OpenAI-compatible | `gemini-2.5-flash` | `gemini-2.5-pro` | Long resumes / bulk inbox email extraction |
| **Anthropic Claude** | `anthropic` | Anthropic Messages API | `claude-3-5-haiku-latest` | `claude-sonnet-4-0` | Natural client pitch emails & subtle CV analysis |
| **Private On-Prem LLM** | `ollama` / `custom` | OpenAI-compatible (`/v1`) | `llama3.1:8b` | `qwen2.5:32b` | Enterprise buyers needing AI inside their own VPC/server |

---

## 3. Clean Backend Folder Structure (`backend/src/services/ai/`)

Keep **all** AI logic isolated inside `backend/src/services/ai/` so core ATS files remain clean and easy to sync between Non-AI and AI builds:

```text
backend/src/services/ai/
├── ai.types.ts                 # AiProviderAdapter interface, task input/output types, AiTaskTier
├── ai.schemas.ts               # Zod validation schemas for all structured AI responses
├── ai.json.ts                  # Markdown fence stripper + JSON parser + 1-shot schema repair retry
├── ai.router.ts                # Reads AI_PROVIDER (+ optional TenantSettings override) -> returns adapter
├── ai.service.ts               # High-level recruitment methods used by routes/services
└── providers/
    ├── none.provider.ts            # Returns disabled status cleanly
    ├── openaiCompatible.provider.ts # Single native-fetch adapter for Cloudflare, OpenAI, Gemini, Ollama, Custom
    └── anthropic.provider.ts       # Native-fetch adapter for Anthropic Messages API
```

### Core Contract (`ai.types.ts`)

Every provider only needs to implement one minimal interface using Node 20's built-in `fetch` (no heavy vendor SDK lock-in):

```ts
export type AiProviderName =
  | 'none'
  | 'cloudflare'
  | 'openai'
  | 'gemini'
  | 'anthropic'
  | 'ollama'
  | 'custom';

export type AiTaskTier = 'fast' | 'smart';

export interface AiChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiCompletionResult {
  text: string;
  provider: AiProviderName;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs: number;
}

export interface AiProviderAdapter {
  readonly name: AiProviderName;
  isConfigured(): boolean;
  complete(params: {
    tier: AiTaskTier;
    messages: AiChatMessage[];
    temperature?: number;
    maxTokens?: number;
    expectJson?: boolean;
  }): Promise<AiCompletionResult>;
}
```

### Why `openaiCompatible.provider.ts` Handles 5 Providers at Once
Cloudflare Workers AI (`/accounts/<id>/ai/v1/chat/completions`), OpenAI (`https://api.openai.com/v1/chat/completions`), Google Gemini (`https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`), Ollama (`http://.../v1/chat/completions`), and Cloudflare AI Gateway all accept the **same `/chat/completions` JSON format**. One clean adapter handles all five, and only `anthropic.provider.ts` needs a small ~70-line wrapper for `/v1/messages`.

---

## 4. Safeguards Required So Switching Providers Never Breaks Output

1. **Normalize & Validate Every JSON Output (`ai.json.ts` + `ai.schemas.ts`)**
   - Never pass raw LLM text directly to frontend state or Prisma.
   - Flow for structured tasks (Resume Parse, JD Email Parse, Candidate Ranking):
     1. Prompt clearly specifies exact JSON keys.
     2. Strip ` ```json ... ``` ` wrappers if returned by any model.
     3. Validate with `zod` (`safeParse`).
     4. If invalid, run **1 lightweight repair retry** (*"Fix this JSON to match schema..."*) or seamlessly fall back to the offline baseline result.
2. **Input Size Caps & Cost Control (`AI_MAX_INPUT_CHARS`)**
   - Trim noisy resume/email text (keep relevant top/summary sections up to `AI_MAX_INPUT_CHARS`, e.g., 16,000 chars) before calling external APIs so long PDFs do not blow token limits on smaller models.
3. **PII-Conscious Prompting**
   - For **Candidate Matching / Ranking** (`matchSkills`), send anonymized or minimal fields (`candidateId`, `currentTitle`, `skillset`, `workAuth`, `relocation`, rate range, truncated `rawSnippet`) — no need to send candidate phone/email/vendor contact info to the LLM.
4. **Timeout + Circuit-Safe Fallback**
   - Enforce `AbortSignal.timeout(AI_TIMEOUT_MS)` on every `fetch`.
   - If the AI provider returns 429/5xx or times out and `AI_FALLBACK_TO_OFFLINE=true`, log a warning and return the offline parser/matcher result with `aiUsed: false` so recruiters are never blocked mid-workflow.
5. **Strict Multi-Tenant Isolation (`tenantId`)**
   - Any future vector search (Phase 2) or usage logs must always include and filter by `tenantId` (`Candidate`, `Requirement`, `TenantSettings`, `EmailLog` already index `tenantId` in `backend/prisma/schema.prisma`).

---

## 5. Phased Implementation Plan Against Current Codebase

### Phase 0 — Pre-AI Foundations (Low-Risk Wiring Gaps to Close First)
1. **Capabilities endpoint (`GET /api/v1/ai/capabilities` or inside `GET /settings`)**
   - Expose `{ aiEnabled: boolean, provider: string, features: { resumeCleanup, emailIntake, aiMatch, aiEmailDraft } }`.
   - Frontend reads this flag on load: when `false`, all AI buttons stay hidden and the app behaves 100% identically to Non-AI mode.
2. **Connect Frontend Send-Email Flow to Existing `/api/v1/smtp/send`**
   - Today `POST /api/v1/smtp/send` (`backend/src/routes/index.ts`) and `renderSubmissionEmail` (`backend/src/services/emailTemplate.service.ts`) exist in backend, and `submission.service.ts` already tracks `pitchEmailSubject` / `pitchEmailBody` / `pitchTone`, but no frontend modal currently calls `/smtp/send`.
   - Add a **"Send Client Email"** dialog wired to `/smtp/send` (plus an **Email Setup (SMTP)** section in `frontend/src/features/settings/SettingsView.tsx` if per-tenant SMTP override is enabled).
3. **White-Label Branding Support (for Resellers like UK Partners)**
   - Allow `brandName` and custom logo URL/mark in `TenantSettings.generalConfig` (`backend/prisma/schema.prisma`) instead of relying solely on hardcoded `'SquadPipe'` in `frontend/src/components/shared/BrandMark.tsx` and `APP_NAME` in `emailTemplate.service.ts`.

---

### Phase 1 — Core v1 AI Features (Touches Only ~6–8 Existing Files)

1. **AI Resume Cleanup & Extraction (`POST /api/v1/parse-resume`)**
   - Keep `resume-parser` (`FastAPI` + `pdfplumber` + `python-docx` + `spaCy`) extracting clean raw text + baseline fields locally (no heavy PDF parsing in Node!).
   - When `aiEnabled` is true, pass extracted text + baseline fields to `aiService.enhanceResumeParse()` (`tier: 'fast'`) to clean noisy job titles, normalize skills, fix split names/work auth, and build a crisp structured summary.
   - Keep response fields identical so `frontend/src/components/modals/ResumeParserModal.tsx` needs zero breaking changes (optionally show a small `"AI Enhanced"` badge).

2. **AI Requirement Email Parser (`POST /api/v1/parse-email`)**
   - In `backend/src/routes/index.ts`, keep `extractEmailHeuristics()` and `resumeParserClientService.parseEmail()` as fallback.
   - When `aiEnabled` is true, run `aiService.enhanceEmailIntakeParse()` (`tier: 'fast'`) first to handle messy forwarded email chains, bulleted JDs, bill/pay rate ranges, hybrid schedules, and missing-info detection cleanly.
   - `frontend/src/features/modals/EmailParserModal.tsx` gets dramatically cleaner extracted results with minimal UI edits.

3. **AI Semantic Candidate Matching & Fit Reasoner (`POST /api/v1/match-skills`)**
   - Step 1 (Backend SQL): Filter `Candidate` by `tenantId`, `pipelineStage`, optional `workAuth` / rate ceiling / keyword overlap -> narrow to top 20–30 candidates.
   - Step 2 (`aiService.rankAndExplainCandidates()`, `tier: 'smart'`): Score each candidate `0–100` against the `Requirement` and return:
     - `matchedHighlights: string[]` (why they fit, even with related skills like `AKS` ≈ `Kubernetes` or `PySpark` ≈ `Spark`)
     - `gaps: string[]` (missing skills or rate/location risk)
     - `oneLineSummary: string`
   - UI: Upgrade `frontend/src/components/modals/AttachBenchDrawer.tsx` to keep instant local `computeCandidateSkillMatch()` as baseline and add an **"AI Match & Explain"** mode displaying score + fit bullets.

4. **AI Client Pitch & Follow-Up Email Assistant (`POST /api/v1/ai/draft-email`)**
   - Inputs: `requirementId`, `candidateId` (or `submissionId`), `purpose` (`client_pitch` | `interview_followup` | `vendor_check`), `tone` (`concise` | `executive` | `consultative` — matching `pitchTone` in `submission.service.ts`).
   - Output (`tier: 'smart'`): `{ subject, bodyText, bodyHtml }` highlighting candidate fit without exposing masked rates (`rateMaskMiddleware` / user `rateMasked` flag enforced!).
   - UI: `"Draft with AI"` button inside the Client Email / Submission Pitch modal, letting recruiters review, edit, and send via `/smtp/send`.

---

### Phase 2 — SaaS Metering, Tenant Controls & Large-Pool Search

1. **AI Usage & Quota Tracking (`AiUsageLog` in `schema.prisma`)**
   - Log `tenantId`, `provider`, `model`, `feature`, `inputTokens`, `outputTokens`, `latencyMs`, `createdAt`.
   - Enables monthly AI limits per SaaS plan, cost monitoring per customer, and white-label partner usage reports.
2. **Per-Tenant Provider / Key Overrides (Optional Enterprise Tier)**
   - Allow storing an encrypted custom `aiProvider` / BYO API key inside `TenantSettings.generalConfig` (using the same `SETTINGS_ENCRYPTION_KEY` encryption pattern already used for SMTP passwords in `backend/src/config/smtp.config.ts`).
3. **Lightweight Vector Search (Only When Tenants Exceed ~2,000+ Stored CVs)**
   - Use **PostgreSQL `pgvector`** (keeps `tenantId` + SQL rate/visa filters in one transaction) or **Cloudflare Vectorize** (with strict mandatory `tenantId` metadata filtering).
   - Never replace SQL hard filters with vector similarity — always run `SQL filters + vector top-K -> LLM rerank`.

---

### Phase 3 — Autonomous Agentic Workflows (Differentiator for UK / Enterprise Plans)

1. **Agentic Automation Actions (`backend/src/services/automationEngine.service.ts`)**
   - On `STALE_REQ` ("Jobs Without Applicants"): Agent automatically runs SQL + AI ranking and attaches top 3 suggested bench candidates to the Action Center card for 1-click submission.
   - On `FEEDBACK_DELAYED` ("Client Feedback Reminder"): Agent pre-drafts a polite follow-up email ready for 1-click send via `/smtp/send`.
   - **Human-in-the-loop rule:** Agents *draft and prepare* external emails by default rather than auto-emailing clients without recruiter approval (critical for UK/EU GDPR & agency trust).
2. **Inbound Email Auto-Intake (Optional IMAP / Webhook)**
   - Sync a dedicated agency inbox (`jobs@agency.com`) -> `aiService.enhanceEmailIntakeParse()` -> create draft Requirements & notify assigned recruiter.

---

## 6. Verification Checklist Before Shipping Any Provider Change

- [ ] **`AI_PROVIDER=none` parity test:** App boots cleanly without any Cloudflare/OpenAI/Anthropic keys; `/parse-resume`, `/parse-email`, `/match-skills`, and `AttachBenchDrawer` work identically to Non-AI build; AI UI controls stay hidden.
- [ ] **Provider-swap smoke test:** Running the exact same test suite against `cloudflare`, `openai`, `gemini`, and `ollama` returns valid `zod`-parsed outputs for all 4 Phase 1 tasks.
- [ ] **Failure / timeout resilience:** Disconnecting or timing out the external AI endpoint cleanly triggers `AI_FALLBACK_TO_OFFLINE=true` and returns HTTP `200` with offline fallback data instead of crashing user requests.
- [ ] **Rate Masking & Tenant Isolation:** When `req.user.rateMasked === true`, AI-generated emails and match summaries never leak hidden client bill rates or margins; queries strictly scope by `tenantId`.
- [ ] **Unit & build checks:** `npx tsc --noEmit`, `npm test`, and frontend `npx tsc --noEmit && npm run build` pass cleanly in both `AI_PROVIDER=none` and active AI modes.
