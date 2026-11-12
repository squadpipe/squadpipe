# TalentOS — Production Operations & Handover Runbook

This runbook provides complete operational guidance for deploying, maintaining, and operating the **TalentOS** IT Recruitment & Staffing CRM Platform across its three microservices and containerized infrastructure.

---

## 1. System Architecture & Ports

| Service | Directory | Port | Healthcheck Endpoint | Description |
| :--- | :--- | :---: | :--- | :--- |
| **Frontend** | `talentos-frontend` | `:3000` | `http://localhost:3000` | React 18 + Vite + Tailwind CSS CRM web dashboard |
| **Backend API** | `talentos-backend` | `:5000` | `http://localhost:5000/api/v1/health` | Node.js + TypeScript + Prisma ORM + Nodemailer |
| **Resume Parser** | `talentos-resume-parser` | `:8000` | `http://localhost:8000/health` | Python 3.11 + FastAPI + NLP resume & email parser |
| **PostgreSQL** | Docker Container | `:5432` | `pg_isready -U talentos_admin` | In-house containerized PostgreSQL 16 (optional) |

---

## 2. Environment Configuration (`.env`)

The unified [`.env`](file:///Users/nakuldas/Public/projects/saas/monday/talentos/.env) file at the root coordinates all three services.

### 2.1 Database Switching (`DB_LOCATION`)
TalentOS supports zero-downtime switching between an in-house Docker PostgreSQL database and external cloud instances (AWS RDS / GCP Cloud SQL):

#### Mode A: In-House Docker PostgreSQL (Default)
```bash
DB_LOCATION=in_house
DB_USER=talentos_admin
DB_PASSWORD=talentos_secure_password_2026
DB_NAME=talentos_crm
DB_PORT=5432
DB_HOST=postgres
```
*When `DB_LOCATION=in_house`, running `make up` automatically starts the local `postgres:16-alpine` container with persistent storage at `./docker/postgres_data/`.*

#### Mode B: External / Cloud Database (AWS RDS, Supabase, Cloud SQL)
```bash
DB_LOCATION=external
EXTERNAL_DATABASE_URL=postgresql://db_user:secret_pass@your-rds-endpoint.amazonaws.com:5432/talentos_prod?sslmode=require
```
*When `DB_LOCATION=external`, running `make up` bypasses the local PostgreSQL container entirely.*

### 2.2 SMTP Outbound Email Credentials
```bash
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=postmaster@your-agency-domain.com
SMTP_PASS=your_smtp_secret_password
SMTP_FROM_NAME="TalentOS Recruitment Desk"
SMTP_FROM_EMAIL=notifications@your-agency-domain.com
```

---

## 3. One-Click Command Reference (`Makefile`)

| Command | Action |
| :--- | :--- |
| `make up` | Starts all services in detached mode (automatically detects in-house vs. external DB) |
| `make down` | Gracefully stops all active containers |
| `make restart` | Restarts all containers |
| `make logs` | Streams live unified logs from all services |
| `make build` | Rebuilds Docker images from scratch |
| `make migrate` | Applies Prisma schema migrations to the active database |
| `make seed` | Populates the database with the full prototype dataset |
| `make clean` | Stops containers and cleans local storage volumes |

---

## 4. Initial Bootstrap Guide

To spin up a new deployment from scratch:
```bash
# 1. Clone repositories and enter root workspace
cd talentos

# 2. Configure environment
cp .env.example .env

# 3. Spin up all containers
make up

# 4. Initialize database schema & seed initial agency records
make migrate
make seed
```

Once running:
- Web App UI: [http://localhost:3000](http://localhost:3000)
- Backend API Docs: [http://localhost:5000/api/v1/health](http://localhost:5000/api/v1/health)
- Python Parser Swagger Docs: [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 5. Security Architecture & Rate Masking Verification

### 5.1 Financial Rate Masking Layer
To protect commercial margins and billing data:
- Recruiters with `rateMasked: true` are restricted at the API serialization level (`rateMask.middleware.ts`).
- Numeric bill rates, pay rates, spreads, and margin percentages are replaced with `null` or `0`, and display strings are scrubbed to `••••••` **before HTTP network responses leave the server**.
- Inspecting browser DevTools network payloads will never reveal raw financial figures to restricted users.

### 5.2 Deterministic Background Jobs
The platform runs two continuous scheduled tasks:
1. **SLA Radar (`slaRadar.job.ts`)**: Scans for open requisitions with 0 submissions past 5 days and placements expiring within 30 days. Automatically provisions actionable tasks into recruiters' morning priority queues.
2. **Compliance Watch (`complianceWatch.job.ts`)**: Checks staffing vendor Certificate of Insurance (COI) dates expiring within 60 days.

