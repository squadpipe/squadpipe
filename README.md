# TalentOS — IT Recruitment & Staffing CRM Platform

TalentOS is a multi-service recruitment management platform orchestrated via Docker Compose.

## Repositories & Services
1. **`talentos-backend`**: Node.js, TypeScript, Prisma ORM, Express, Nodemailer SMTP.
2. **`talentos-frontend`**: React 18, TypeScript, Vite, Tailwind CSS.
3. **`talentos-resume-parser`**: Python 3.11, FastAPI, NLP extraction (PDF, DOCX, TXT).

## Quick Start (One-Click)

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Start the platform:
   ```bash
   make up
   ```
3. Run initial database migration & mock seeding:
   ```bash
   make migrate
   make seed
   ```
4. Access the applications:
   - **Frontend UI**: http://localhost:3000
   - **Backend API**: http://localhost:5000/api/v1
   - **Resume Parser API**: http://localhost:8000/api/v1 (Docs at `/docs`)

## Dual Database Configuration
- In-House: Set `DB_LOCATION=in_house` in `.env` to start the local containerized PostgreSQL instance.
- External: Set `DB_LOCATION=external` and provide `EXTERNAL_DATABASE_URL` to connect to remote AWS RDS or Cloud SQL instances.

