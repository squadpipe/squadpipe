# TalentOS — Multi-Repository Architecture & Directory Structure

This document details the multi-repository architecture, folder hierarchies, and one-click Docker Compose containerization strategy for **TalentOS** (IT Recruitment & Staffing CRM Platform).

---

## 1. System Architecture Overview

TalentOS is distributed across **three core repositories/services** orchestrated via Docker Compose:

```mermaid
flowchart TD
    Client[Browser / User] -->|HTTP / React UI :3000| Frontend[talentos-frontend\nReact + Vite + Tailwind]
    Frontend -->|REST API :5000| Backend[talentos-backend\nNode.js + TypeScript + Prisma]
    Backend -->|Internal REST :8000| ResumeParser[talentos-resume-parser\nPython 3.11 + FastAPI + NLP]
    
    subgraph Storage & External Services
        Backend -->|Prisma Client| Database[(PostgreSQL DB\n:5432)]
        Backend -->|SMTP (Nodemailer)| MailServer[External / Corporate SMTP Server]
    end

    subgraph Dual DB Routing [DB_LOCATION env switch]
        DB_InHouse[In-House Docker PostgreSQL Container] -.->|if DB_LOCATION=in_house| Database
        DB_External[Cloud / External PostgreSQL] -.->|if DB_LOCATION=external| Database
    end
```

### Repositories Overview

| Repository / Directory | Tech Stack | Role & Responsibility |
| :--- | :--- | :--- |
| **`talentos-backend`** | Node.js, TypeScript, Express, Prisma ORM | Core business logic, RBAC & rate masking, JWT authentication, PostgreSQL ORM, SLA & automation engine, SMTP email dispatching, candidate/client/vendor/job order APIs. |
| **`talentos-frontend`** | React 18/19, TypeScript, Vite, Tailwind CSS, TanStack Query, Lucide Icons | Responsive modern SaaS frontend, Kanban pipeline, table lists, rate-masking UI, SLA priority drawer, skill matchers, interactive CSV mapper, placement wizard. |
| **`talentos-resume-parser`** | Python 3.11, FastAPI, Uvicorn, pdfplumber, python-docx, spaCy / Regex | Resume parsing (PDF, DOCX, TXT), contact extraction, work authorization detection, skillset identification, email requirement intake parser, AI/NLP matching scoring. |

---

## 2. Root Orchestrator & Multi-Repo Directory Layout

In production, each service can be housed in its own Git repository (`talentos-backend`, `talentos-frontend`, `talentos-resume-parser`). For development and one-click Docker deployment, a parent orchestrator workspace unites them:

```text
talentos/
├── .env.example                       # Unified root environment template
├── .env                               # Active root environment variables
├── docker-compose.yml                 # One-click orchestration definition
├── docker-compose.override.yml        # Local development live-reload overrides
├── Makefile                           # Developer shortcuts (make up, make migrate, etc.)
├── README.md                          # Quick start instructions
│
├── scripts/                           # Multi-repo management & DB helper scripts
│   ├── init-db.sh                     # In-house DB initialization script
│   ├── wait-for-it.sh                 # TCP dependency availability check
│   ├── migrate.sh                     # Prisma migration runner wrapper
│   └── seed.sh                        # Database seeding script (mock data from prototype)
│
├── talentos-backend/                  # Repository 1: Node.js + TypeScript + Prisma
├── talentos-frontend/                 # Repository 2: React + Vite + Tailwind
└── talentos-resume-parser/            # Repository 3: Python FastAPI + Resume NLP
```

---

## 3. Detailed Repository Structures

### 3.1 Backend (`talentos-backend`)

```text
talentos-backend/
├── Dockerfile                         # Multi-stage production Dockerfile
├── Dockerfile.dev                     # Fast dev container with nodemon / tsx watch
├── package.json
├── tsconfig.json
├── .env.example
├── prisma/
│   ├── schema.prisma                  # Complete PostgreSQL schema & relations
│   ├── migrations/                    # Prisma migration history
│   └── seed.ts                        # Seed script reproducing prototype data
├── src/
│   ├── server.ts                      # App entry point & HTTP listener
│   ├── app.ts                         # Express application setup, middlewares & routes
│   │
│   ├── config/                        # App configuration & environment validation
│   │   ├── env.config.ts              # Zod/Envalid environment variables validator
│   │   ├── prisma.config.ts           # Prisma client singleton instance
│   │   └── smtp.config.ts             # Nodemailer transporter verification & pool
│   │
│   ├── constants/                     # System constants & error codes
│   │   ├── roles.constant.ts          # Admin, Senior Recruiter, Tech Recruiter, etc.
│   │   ├── stages.constant.ts         # Requirement, Submitted, Interview, Selected, Onboarding
│   │   └── errors.constant.ts         # Standard HTTP error messages
│   │
│   ├── middlewares/                   # Request processing pipeline
│   │   ├── auth.middleware.ts         # JWT token extraction & verification
│   │   ├── rbac.middleware.ts         # Role-based endpoint authorization
│   │   ├── rateMask.middleware.ts     # Strips/masks hourly rates & spreads based on user.rateMasked
│   │   ├── validate.middleware.ts     # Zod request payload validation
│   │   └── errorHandler.middleware.ts # Global JSON error formatter
│   │
│   ├── controllers/                   # HTTP Request/Response Controllers
│   │   ├── auth.controller.ts         # Login, Refresh, Signout, Profile
│   │   ├── user.controller.ts         # User management, invite, rate-mask toggle
│   │   ├── candidate.controller.ts    # Consultants CRUD, search, resume link
│   │   ├── client.controller.ts       # Clients & Client Contacts management
│   │   ├── vendor.controller.ts       # Vendors & Subcontractor terms
│   │   ├── requirement.controller.ts  # Job orders, pipeline stage transitions
│   │   ├── submission.controller.ts   # Submissions, pitches, client feedback
│   │   ├── placement.controller.ts    # Billable placements, margin spreads, SOW extension
│   │   ├── automation.controller.ts   # Automation rules & audit log trigger
│   │   ├── sla.controller.ts          # SLA radar tasks & daily reminders
│   │   ├── customField.controller.ts  # Custom fields & master taxonomy
│   │   └── import.controller.ts       # CSV mapping & bulk import ingestion
│   │
│   ├── services/                      # Core Business Logic & External Integrations
│   │   ├── auth.service.ts
│   │   ├── user.service.ts
│   │   ├── candidate.service.ts
│   │   ├── client.service.ts
│   │   ├── vendor.service.ts
│   │   ├── requirement.service.ts
│   │   ├── submission.service.ts
│   │   ├── placement.service.ts
│   │   ├── resumeParserClient.service.ts # HTTP client to Python parser service (:8000)
│   │   ├── smtp.service.ts            # Outgoing email dispatch, template rendering
│   │   ├── slaEngine.service.ts       # Evaluates feedback > 48h, stale reqs, contract expiries
│   │   ├── automationEngine.service.ts# Triggers and dispatches rules, logs to audit ledger
│   │   ├── customField.service.ts     # Dynamic entity field validator
│   │   └── csvImporter.service.ts     # Stream-based CSV parser & field mapper
│   │
│   ├── jobs/                          # Scheduled Background Tasks
│   │   ├── cron.scheduler.ts          # Cron runner (or BullMQ worker)
│   │   ├── slaRadar.job.ts            # Periodic check for expiring contracts & stale jobs
│   │   └── complianceWatch.job.ts     # 60-day visa expiry compliance alerts
│   │
│   ├── dtos/                          # Zod DTO Validation Schemas
│   │   ├── auth.dto.ts
│   │   ├── candidate.dto.ts
│   │   ├── requirement.dto.ts
│   │   ├── placement.dto.ts
│   │   └── automation.dto.ts
│   │
│   └── types/                         # TypeScript interfaces & declarations
│       ├── express.d.ts               # Extended Express.Request with User context
│       └── models.types.ts
│
└── tests/
    ├── unit/
    └── integration/
```

---

### 3.2 Frontend (`talentos-frontend`)

```text
talentos-frontend/
├── Dockerfile                         # Production Nginx container
├── Dockerfile.dev                     # Vite HMR dev container
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js                 # Theme matching prototype (Plus Jakarta Sans, brand blues)
├── index.html
├── src/
│   ├── main.tsx                       # React application DOM root
│   ├── App.tsx                        # Router & Global Toast Provider
│   │
│   ├── assets/                        # Fonts, logos, SVGs
│   ├── styles/                        # Tailwind directives & custom CSS
│   │
│   ├── config/
│   │   └── api.config.ts              # Axios instance, baseURL, JWT interceptors
│   │
│   ├── context/                       # Global state contexts
│   │   ├── AuthContext.tsx            # Current user, active role, rateMasked state
│   │   ├── ToastContext.tsx           # Global notification toast banners
│   │   └── SlaDrawerContext.tsx       # SLA daily reminder drawer drawer state
│   │
│   ├── hooks/                         # Reusable React hooks
│   │   ├── useAuth.ts
│   │   ├── useRateMask.ts             # Formats rates (e.g. '$95/hr' vs '••••••')
│   │   ├── useDebounce.ts
│   │   └── useModal.ts
│   │
│   ├── types/                         # TypeScript entity definitions matching backend
│   │   ├── user.types.ts
│   │   ├── candidate.types.ts
│   │   ├── requirement.types.ts
│   │   ├── placement.types.ts
│   │   ├── automation.types.ts
│   │   └── customField.types.ts
│   │
│   ├── components/                    # Common atomic and layout components
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx            # Navigation sidebar (Dashboard, Pipeline, etc.)
│   │   │   ├── Topbar.tsx             # Global search, SLA badge, role pill, profile
│   │   │   ├── SlaDrawer.tsx          # Actionable SLA reminder flyout drawer
│   │   │   └── MainLayout.tsx         # Shell wrapping layout
│   │   ├── ui/
│   │   │   ├── Button.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Dropdown.tsx
│   │   │   ├── Table.tsx
│   │   │   └── Toast.tsx
│   │   └── shared/
│   │       ├── QuickAddModal.tsx      # Quick add candidate/req/client/vendor/placement
│   │       ├── SkillTag.tsx
│   │       └── MaskedValue.tsx        # Automatic visual masking of financials
│   │
│   ├── features/                      # Feature-based module views
│   │   ├── dashboard/                 # KPI cards, Active reqs table, gross profit
│   │   ├── pipeline/                  # Kanban board & List table with stage transitions
│   │   ├── consultants/               # Candidate roster, search, resume preview drawer
│   │   ├── clients/                   # Client directory, contact tabs, linked reqs
│   │   ├── vendors/                   # Staffing vendor directory, terms, MSA status
│   │   ├── billable/                  # Billable ledger, margins, SOW extension wizard
│   │   ├── user-management/           # Team administration, role permissions, rate toggle
│   │   ├── automations/               # Visual rule builder, threshold config, audit logs
│   │   ├── custom-fields/             # Custom fields list, master configurable dropdowns
│   │   ├── import-data/               # Candidate CSV mapper, preview table, template
│   │   └── modals/                    # Specialized AI / Action Modals:
│   │       ├── ResumeParserModal.tsx  # Drag & drop resume parser & structured review
│   │       ├── EmailParserModal.tsx   # Client email requirement extractor
│   │       ├── SkillMatcherModal.tsx  # Match candidate bench to requirements
│   │       ├── SubmissionPitchModal.tsx # AI pitch writer & tone switcher
│   │       └── PlacementWizardModal.tsx # Margin spread calculator & activation wizard
│   │
│   └── services/                      # API client service calls
│       ├── auth.api.ts
│       ├── candidate.api.ts
│       ├── requirement.api.ts
│       ├── placement.api.ts
│       ├── client.api.ts
│       ├── vendor.api.ts
│       ├── automation.api.ts
│       └── import.api.ts
```

---

### 3.3 Resume Parser Service (`talentos-resume-parser`)

```text
talentos-resume-parser/
├── Dockerfile                         # Python 3.11 slim image with build dependencies
├── requirements.txt                   # FastAPI, Uvicorn, pdfplumber, python-docx, spacy
├── .env.example
├── app/
│   ├── main.py                        # FastAPI entry point, CORS, routers & healthcheck
│   │
│   ├── core/
│   │   ├── config.py                  # Pydantic Settings (API keys, max file size, etc.)
│   │   └── logging.py                 # Structured JSON logger
│   │
│   ├── api/
│   │   └── v1/
│   │       ├── router.py              # Root v1 router
│   │       └── endpoints/
│   │           ├── parse_resume.py    # POST /api/v1/parse-resume (multipart file upload)
│   │           ├── parse_email.py     # POST /api/v1/parse-email (raw email body text)
│   │           ├── match_skills.py    # POST /api/v1/match-skills (candidate vs req)
│   │           └── generate_pitch.py  # POST /api/v1/generate-pitch (pitch drafts)
│   │
│   ├── parsers/                       # File format text extractors
│   │   ├── pdf_parser.py              # pdfplumber / PyPDF2 text & layout extraction
│   │   ├── docx_parser.py             # python-docx reader
│   │   └── txt_parser.py              # Plain text & UTF-8 sanitizer
│   │
│   ├── extractors/                    # Information Extraction Rules & NLP
│   │   ├── contact_extractor.py       # Regex for emails, North American & international phones
│   │   ├── work_auth_extractor.py     # Matches US Citizen, Green Card, H-1B, C2C, W2
│   │   ├── skills_extractor.py        # IT skill taxonomy dictionary & NER matching
│   │   ├── education_extractor.py     # Degree & university identification
│   │   └── experience_extractor.py    # Job titles, companies, year calculations
│   │
│   ├── schemas/                       # Pydantic Input/Output Schemas
│   │   ├── resume_schema.py           # ParsedCandidateResponse schema
│   │   ├── email_schema.py            # ParsedRequirementResponse schema
│   │   └── match_schema.py            # SkillMatchScoreResponse schema
│   │
│   └── tests/
│       ├── sample_resumes/            # Sample test resumes (.pdf, .docx)
│       └── test_parser.py
```

---

## 4. Docker Compose & Dual Database Strategy

The system provides a **one-click startup** with support for switching between an **in-house containerized PostgreSQL database** and an **external/cloud PostgreSQL database**.

### 4.1 Environment Variable Logic

The file `.env` controls database routing via `DB_LOCATION`:

- When `DB_LOCATION=in_house`:
  - Docker Compose spins up the `postgres` container.
  - The backend connects using `DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/${DB_NAME}`.
- When `DB_LOCATION=external`:
  - Docker Compose uses Docker profiles (`profiles: ["in_house"]`) so the local `postgres` container **does not start**.
  - The backend connects directly to your external cloud instance using `EXTERNAL_DATABASE_URL` (or the provided host/port/credentials).

### 4.2 Unified `.env.example`

```bash
# ==============================================================================
# TalentOS Unified Environment Configuration
# ==============================================================================

# Application Environment
NODE_ENV=development
APP_PORT=3000
BACKEND_PORT=5000
PARSER_PORT=8000

# ------------------------------------------------------------------------------
# Database Routing (in_house OR external)
# ------------------------------------------------------------------------------
# Choose: "in_house" (launches dockerized postgres) or "external" (uses remote db)
DB_LOCATION=in_house

# 1. In-House Docker PostgreSQL Configuration (Used if DB_LOCATION=in_house)
DB_USER=talentos_admin
DB_PASSWORD=talentos_secure_password_2026
DB_NAME=talentos_crm
DB_PORT=5432
DB_VOLUME_PATH=./docker/postgres_data

# 2. External / Cloud PostgreSQL Configuration (Used if DB_LOCATION=external)
EXTERNAL_DB_HOST=aws-rds.yourdomain.com
EXTERNAL_DB_PORT=5432
EXTERNAL_DB_USER=remote_user
EXTERNAL_DB_PASSWORD=remote_password
EXTERNAL_DB_NAME=production_crm
EXTERNAL_DB_SSL=true
# Or complete external connection string:
EXTERNAL_DATABASE_URL=postgresql://remote_user:remote_password@aws-rds.yourdomain.com:5432/production_crm?sslmode=require

# ------------------------------------------------------------------------------
# SMTP Email Configuration (Nodemailer)
# ------------------------------------------------------------------------------
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=postmaster@talentos-agency.com
SMTP_PASS=super_secret_smtp_key
SMTP_FROM_NAME="TalentOS Recruitment Desk"
SMTP_FROM_EMAIL=notifications@talentos-agency.com

# ------------------------------------------------------------------------------
# JWT Authentication & Security
# ------------------------------------------------------------------------------
JWT_ACCESS_SECRET=your_ultra_secure_jwt_access_secret_key_512bit
JWT_REFRESH_SECRET=your_ultra_secure_jwt_refresh_secret_key_512bit
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# ------------------------------------------------------------------------------
# Internal Microservice URLs (Docker Network)
# ------------------------------------------------------------------------------
RESUME_PARSER_SERVICE_URL=http://resume-parser:8000
BACKEND_SERVICE_URL=http://backend:5000
FRONTEND_URL=http://localhost:3000
```

### 4.3 `docker-compose.yml` Specification

```yaml
version: '3.8'

services:
  # ============================================================================
  # In-House PostgreSQL (Only active when DB_LOCATION=in_house via profile)
  # ============================================================================
  postgres:
    image: postgres:16-alpine
    container_name: talentos-postgres
    restart: unless-stopped
    profiles:
      - in_house
      - default
    environment:
      POSTGRES_USER: ${DB_USER:-talentos_admin}
      POSTGRES_PASSWORD: ${DB_PASSWORD:-talentos_secure_password_2026}
      POSTGRES_DB: ${DB_NAME:-talentos_crm}
    ports:
      - "${DB_PORT:-5432}:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init-db.sh:/docker-entrypoint-initdb.d/init.sh
    networks:
      - talentos-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER:-talentos_admin} -d ${DB_NAME:-talentos_crm}"]
      interval: 5s
      timeout: 5s
      retries: 5

  # ============================================================================
  # Python Resume & Email Parser Microservice
  # ============================================================================
  resume-parser:
    build:
      context: ./talentos-resume-parser
      dockerfile: Dockerfile
    container_name: talentos-resume-parser
    restart: unless-stopped
    ports:
      - "${PARSER_PORT:-8000}:8000"
    environment:
      - ENVIRONMENT=production
      - LOG_LEVEL=info
    networks:
      - talentos-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 10s
      timeout: 5s
      retries: 3

  # ============================================================================
  # Node.js + TypeScript Backend (API & Business Logic)
  # ============================================================================
  backend:
    build:
      context: ./talentos-backend
      dockerfile: Dockerfile
    container_name: talentos-backend
    restart: unless-stopped
    ports:
      - "${BACKEND_PORT:-5000}:5000"
    environment:
      - NODE_ENV=production
      - PORT=5000
      - DB_LOCATION=${DB_LOCATION:-in_house}
      - DB_USER=${DB_USER}
      - DB_PASSWORD=${DB_PASSWORD}
      - DB_NAME=${DB_NAME}
      - DB_PORT=${DB_PORT}
      - EXTERNAL_DATABASE_URL=${EXTERNAL_DATABASE_URL}
      - SMTP_HOST=${SMTP_HOST}
      - SMTP_PORT=${SMTP_PORT}
      - SMTP_SECURE=${SMTP_SECURE}
      - SMTP_USER=${SMTP_USER}
      - SMTP_PASS=${SMTP_PASS}
      - SMTP_FROM_NAME=${SMTP_FROM_NAME}
      - SMTP_FROM_EMAIL=${SMTP_FROM_EMAIL}
      - JWT_ACCESS_SECRET=${JWT_ACCESS_SECRET}
      - JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
      - RESUME_PARSER_SERVICE_URL=http://resume-parser:8000
    depends_on:
      resume-parser:
        condition: service_healthy
    networks:
      - talentos-network

  # ============================================================================
  # React + Vite Frontend (Nginx Production Server)
  # ============================================================================
  frontend:
    build:
      context: ./talentos-frontend
      dockerfile: Dockerfile
    container_name: talentos-frontend
    restart: unless-stopped
    ports:
      - "${APP_PORT:-3000}:80"
    environment:
      - VITE_API_URL=http://localhost:${BACKEND_PORT:-5000}/api/v1
    depends_on:
      - backend
    networks:
      - talentos-network

networks:
  talentos-network:
    driver: bridge

volumes:
  postgres_data:
    driver: local
```

### 4.4 Dynamic Database Resolver in Backend (`src/config/prisma.config.ts`)

```typescript
import { PrismaClient } from '@prisma/client';

const resolveDatabaseUrl = (): string => {
  const dbLocation = process.env.DB_LOCATION || 'in_house';

  if (dbLocation === 'external') {
    if (process.env.EXTERNAL_DATABASE_URL) {
      return process.env.EXTERNAL_DATABASE_URL;
    }
    const host = process.env.EXTERNAL_DB_HOST;
    const port = process.env.EXTERNAL_DB_PORT || 5432;
    const user = process.env.EXTERNAL_DB_USER;
    const pass = process.env.EXTERNAL_DB_PASSWORD;
    const name = process.env.EXTERNAL_DB_NAME;
    const ssl = process.env.EXTERNAL_DB_SSL === 'true' ? '?sslmode=require' : '';
    return `postgresql://${user}:${pass}@${host}:${port}/${name}${ssl}`;
  }

  // In-House Docker / Local fallback
  const user = process.env.DB_USER || 'talentos_admin';
  const pass = process.env.DB_PASSWORD || 'talentos_secure_password_2026';
  const host = process.env.DB_HOST || 'postgres'; // 'postgres' within docker network, 'localhost' for local dev
  const port = process.env.DB_PORT || 5432;
  const name = process.env.DB_NAME || 'talentos_crm';
  return `postgresql://${user}:${pass}@${host}:${port}/${name}`;
};

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: resolveDatabaseUrl(),
    },
  },
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});
```

---

## 5. Summary & Next Steps

This structure guarantees clean separation of concerns, containerized reproducibility, and zero manual database reconfiguration whether hosting on a local server or connecting to enterprise Amazon RDS / Google Cloud SQL databases.

