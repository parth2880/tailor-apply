# tailor-apply

## Section A 

Build a local monorepo called **apply-kit** (ApplyKit). TypeScript only — **NestJS API + Next.js web**. No Python.

### Product goal
LinkedIn assistant for frontend / UI-UX roles that:
1. Finds recent matching LinkedIn jobs (Playwright + persistent Chromium profile)
2. Scores each job against my master resume (heuristic + LLM)
3. Generates a tailored one-page European CV PDF (+ optional cover letter)
4. Lets me review in a web UI and **apply myself on LinkedIn**

**Do NOT implement auto-apply.** Statuses like applied/skipped are manual marks after I apply.
Tagline: “Find · tailor · you apply”.

### Stack & layout
```
apply-kit/
├── package.json                 # pnpm workspace root, Node >= 20
├── pnpm-workspace.yaml          # packages: apps/*
├── .env.example / .env
├── README.md
├── apps/
│   ├── api/                     # NestJS on 127.0.0.1:3001
│   └── web/                     # Next.js on :3000
├── config/roles.yaml
├── config/preferences.yaml
├── data/
│   ├── app.db
│   ├── master_resume.yaml
│   ├── master_resume.md
│   ├── browser_profile/
│   ├── outputs/
│   └── last_search_filters.json
└── scripts/daily_run.sh
```

Root scripts: `dev` (api+web parallel), `api`, `web`, `linkedin-login`, `pipeline`, `process`, `build`.

### Env
See `.env.example` in Section B. `DATABASE_URL="file:../../../data/app.db"` relative to `apps/api/prisma`. Load dotenv from monorepo root. Discover project root by finding `config/roles.yaml`.

### Behavior to match Section B exactly
- Prisma Job model / statuses as in schema
- Nest routes: POST/GET jobs, score, tailor, resume.pdf, status; run status/start; llm providers
- Pipeline: search → enrich JD → score → tailor; skip_search for process-only
- LinkedIn Playwright persistent profile in `data/browser_profile`
- LLM: groq/gemini/ollama/openai; free failover ollama→groq→gemini never onto paid OpenAI; retired model auto-upgrade
- Scoring blend + tailor integrity (no fake employers; lock contact from master)
- European + classic Handlebars PDF via Playwright
- Next UI: table, sticky actions, live filters, Add job modal, Find jobs / Score & tailor, tooltips, detail page
- Next rewrite `/api/*` → `:3001`

**Prefer recreating from Section B source files** so behavior matches 1:1. If anything conflicts, Section B wins.

---

## Section B — Full source (path → file)

Copy each block to the path shown in the heading.

### `.env.example`

```bash
# LLM provider: groq | gemini | ollama | openai
# Keep only ONE LLM_PROVIDER= line uncommented (last assignment wins).

# --- Groq (free): https://console.groq.com/keys ---
# llama-3.3-70b-versatile retired Aug 2026 — use openai/gpt-oss-120b
LLM_PROVIDER=groq
GROQ_API_KEY=gsk_your_key_here
LLM_MODEL=openai/gpt-oss-120b

# --- Google Gemini (free): https://aistudio.google.com/apikey ---
# LLM_PROVIDER=gemini
# GEMINI_API_KEY=your_gemini_key
# LLM_MODEL=gemini-2.5-flash

# --- Ollama (local): run `ollama serve` and `ollama pull llama3.2` ---
# LLM_PROVIDER=ollama
# LLM_MODEL=llama3.2

# --- OpenAI (paid) ---
# LLM_PROVIDER=openai
# OPENAI_API_KEY=sk-your-key-here
# LLM_MODEL=gpt-4o-mini

# Nest/Prisma (path is relative to apps/api/prisma)
DATABASE_URL="file:../../../data/app.db"
```

### `package.json`

```json
{
  "name": "job-automator",
  "private": true,
  "scripts": {
    "dev": "pnpm --parallel --filter @job-automator/api --filter @job-automator/web run start:dev",
    "api": "pnpm --filter @job-automator/api start:dev",
    "web": "pnpm --filter @job-automator/web dev",
    "linkedin-login": "pnpm --filter @job-automator/api linkedin-login",
    "pipeline": "pnpm --filter @job-automator/api run:pipeline",
    "process": "pnpm --filter @job-automator/api process",
    "build": "pnpm --filter @job-automator/api build && pnpm --filter @job-automator/web build"
  },
  "engines": {
    "node": ">=20"
  }
}
```

### `pnpm-workspace.yaml`

```yaml
packages:
  - "apps/*"
```

### `README.md`

```markdown
# Job Automator

LinkedIn assistant for **frontend / UI-UX** roles that:

1. Finds recent matching jobs
2. Scores them against your profile
3. Generates a **European one-page resume PDF** tailored to each JD
4. Lets **you** open LinkedIn and apply yourself

Stack: **Next.js** review portal (`:3000`) + **NestJS** API / pipeline (`:3001`), sharing `data/`, `config/`, and Playwright’s `data/browser_profile`.

## Setup

Requires **Node 20+** and [pnpm](https://pnpm.io).

```bash
cd "job-automator"
pnpm install
pnpm --filter @job-automator/api exec playwright install chromium
cp .env.example .env   # then add API keys
```

`DATABASE_URL` in `.env` should point at the SQLite file:

```
DATABASE_URL="file:../../../data/app.db"
```

(That path is relative to `apps/api/prisma`.)

## Commands

```bash
pnpm linkedin-login     # LinkedIn login (Playwright window)
pnpm pipeline           # search → score → tailor
pnpm process            # score + tailor existing queue only
pnpm dev                # Nest :3001 + Next :3000
```

Open **http://127.0.0.1:3000** for the review table, **Find new jobs**, and **Score & tailor**.

Daily cron-friendly script: `scripts/daily_run.sh`.

## Free LLM options

Groq (`openai/gpt-oss-120b`), Gemini (`gemini-2.5-flash`), local Ollama, or paid OpenAI. Configure in `.env`. The API auto-fails over across free providers when rate-limited. Retired Groq Llama 3.3 IDs are auto-upgraded.

## Config

Edit facts in [`data/master_resume.yaml`](data/master_resume.yaml).  
Adjust roles in [`config/roles.yaml`](config/roles.yaml) and search prefs in [`config/preferences.yaml`](config/preferences.yaml).

## Resume templates

PDFs use the **European CV** layout by default (`resume_template: european` in `config/preferences.yaml`): A4, company-tailored profile/headline/bullets. Classic US Letter is still available.
```

### `.gitignore`

```gitignore
.env

# Local data & browser session
data/app.db
data/app.db-*
data/outputs/
data/browser_profile/
data/apply_state.json
*.pdf

# OS / IDE
.DS_Store
.idea/
.vscode/

# Node / Next / Nest
node_modules/
apps/web/.next/
apps/api/dist/
*.tsbuildinfo
.pnpm-store/
```

### `scripts/daily_run.sh`

```bash
#!/usr/bin/env bash
# Daily job: search → score → tailor (you apply on LinkedIn yourself)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "Starting Nest pipeline (search → score → tailor)..."
pnpm run --filter @job-automator/api run:pipeline "$@"
echo "Done. Review with: pnpm dev  (http://127.0.0.1:3000)"
```

### `config/roles.yaml`

```yaml
titles:
  - Frontend Developer
  - UI/UX Developer
  - Frontend Engineer
  - UI Engineer
  - React Developer
  - Vue Developer

skills:
  - React
  - Vue
  - Next.js
  - Nuxt
  - Tailwind CSS
  - CSS
  - SCSS
  - TypeScript
  - JavaScript
  - HTML
  - UI/UX

# Scoring / LLM context label
location: "Europe"
relocation_target: europe
remote_ok: true

# LinkedIn searches one location at a time — rotate through EU hubs each run
locations:
  - "European Union"
  - "Germany"
  - "Netherlands"
  - "United Kingdom"
  - "Ireland"
  - "Portugal"
  - "Spain"
  - "France"
  - "Poland"
  - "Remote"

# Boost / penalize during heuristic + LLM scoring
location_prefer_keywords:
  - europe
  - european union
  - emea
  - eu
  - germany
  - berlin
  - munich
  - netherlands
  - amsterdam
  - rotterdam
  - united kingdom
  - uk
  - london
  - ireland
  - dublin
  - portugal
  - lisbon
  - spain
  - barcelona
  - madrid
  - france
  - paris
  - poland
  - warsaw
  - visa sponsorship
  - relocation
  - relocate
  - work permit

location_avoid_keywords:
  - us only
  - united states only
  - must be located in the us
  - us citizenship
  - clearance required
  - india only
  - must be in india
  - no sponsorship
  - without sponsorship

# Fresh jobs: 72 = Past 3 days (EU listings are sparser than India)
posted_within_hours: 72
min_match_score: 55
max_jobs_per_run: 40
```

### `config/preferences.yaml`

```yaml
# Search & pacing
exclude_keywords:
  - "unpaid"
  - "internship"
  - "intern "
  - "volunteer"
  - "us citizenship required"
  - "must be located in the us"
  - "us only"

seniority_prefer:
  - mid
  - senior
  - junior

max_jobs_per_day: 40
search_delay_seconds_min: 2.0
search_delay_seconds_max: 5.0
detail_delay_seconds_min: 1.5
detail_delay_seconds_max: 4.0

# Resume / cover letter
generate_cover_letter: true
master_resume_path: data/master_resume.yaml
resume_template: european
resume_page_format: A4

# LinkedIn
linkedin_base_url: "https://www.linkedin.com"
browser_profile_dir: data/browser_profile
headless: false

# Search filters only (you apply yourself on LinkedIn)
# f_AL=true → Easy Apply listings; f_WT=2 → Remote; f_TPR from roles.posted_within_hours
search_easy_apply_filter: true
discover_external_apply: true
# false = include on-site/hybrid EU jobs (better for relocation); true = remote-only pass
linkedin_remote_filter: false
# When true, also run a second remote-only pass per location (remote_ok must be true)
search_remote_pass: true
```

### `data/master_resume.yaml`

```yaml
name: Parth Sharma
headline: Frontend Engineer | React.js · Next.js · Vue.js · TypeScript
profile: >-
  Frontend/UI Engineer with 3.5 years of experience building modern, scalable, and
  accessible web applications using React, Next.js, Vue.js, and TypeScript. Contributed
  to the frontend rebuild of Toolstation, a Netherlands-based e-commerce platform,
  helping drive up to a 35% improvement in application performance with Nuxt 3 and
  Tailwind CSS. Currently leading UX and frontend delivery for live UK product platforms
  at Tedekstra. Experienced in reusable, atomic-design component libraries and shipping
  production interfaces for international clients. Based in India and open to relocating
  across Europe.
email: parthinteract@gmail.com
phone: "+91 78768-00210"
location: India | Open to Relocation across Europe
linkedin: "https://www.linkedin.com/in/parthsharma2880/"
github: "https://github.com/parth2880"
portfolio: "https://parth-interact.vercel.app/"

languages: "English (Professional Working Proficiency); Hindi (Native)"

skill_groups:
  - label: Frontend
    items: React.js, Next.js, Vue.js, Nuxt.js, TypeScript, JavaScript (ES6+), HTML5, CSS3
  - label: UI & Styling
    items: Tailwind CSS, Bootstrap, Responsive Design, Component Libraries, Design Systems
  - label: Engineering
    items: State Management (Pinia), Performance Optimization, RBAC, Internationalisation (i18n)
  - label: Backend & Tools
    items: NestJS, Node.js, Express, MongoDB, MySQL, Builder.io, Flowbite, Git, Vite, Postman, Vercel

education:
  - school: Meri College of Engineering and Technology
    location: India
    degree: B.Tech in Computer Science & Engineering
    dates: 2022 – 2026
    details: []

experience:
  - company: Tedekstra
    location: Remote
    title: User Experience Lead
    dates: 10/2025 – Present
    bullets:
      - Owned assigned frontend work across live UK product platforms, shipping features and production fixes rather than full rebuilds.
      - Delivered EN/CY internationalisation, CMS-driven content, booking and authentication UI for Cycling4All (Next.js / React / TypeScript).
      - Implemented and enhanced RBAC, HR dashboard/calendar, customer notes with @mentions, and project/package forms for Aqueous Digital’s internal CRM.
      - Maintained and improved Access Support’s role-based DSA/NMH product across availability, DST handling, calendar/session flows and UAT/production delivery.

  - company: WebReinvent Technologies Pvt. Ltd.
    location: Delhi, India
    title: Software Engineer
    dates: 01/2024 – 10/2025
    bullets:
      - Delivered production frontend features in React.js and Vue.js for international clients.
      - Contributed to the frontend rebuild of Toolstation, helping drive up to a 35% improvement in performance.
      - Built and maintained reusable, atomic-design component libraries.
      - Collaborated with cross-functional teams to ship responsive and pixel-perfect interfaces.

  - company: WebReinvent Technologies Pvt. Ltd.
    location: Delhi, India
    title: Frontend Developer Trainee
    dates: 07/2023 – 01/2024
    bullets:
      - Built responsive, user-friendly interfaces in React.js for client-facing websites.
      - Identified and resolved production bugs and implemented new features.

projects:
  - name: Cycling4All — Live Cycling Platform
    location: United Kingdom
    title: Next.js · React · TypeScript · Tailwind CSS
    dates: ""
    bullets:
      - Delivered frontend features and production fixes on a live Next.js/React application rather than rebuilding the platform from scratch.
      - Implemented English/Welsh (EN/CY) internationalisation, CMS-driven content, booking and authentication UI.
      - Integrated and supported Google Analytics and resolved production issues across footer, contact and user-facing flows.
      - Owned assigned frontend work within a team, shipping features and fixes to the existing production application.

  - name: Aqueous Digital — Internal CRM Platform
    location: United Kingdom
    title: Next.js · React · TypeScript · Tailwind CSS · NestJS · MongoDB
    dates: ""
    bullets:
      - Delivered frontend features and production fixes for an internal CRM used by a UK marketing organisation.
      - Implemented and enhanced RBAC, HR dashboard/calendar, customer notes with @mentions, project/package forms and navigation UI.
      - Worked across the frontend layer of a Next.js/React/TypeScript product integrated with a NestJS and MongoDB backend.
      - Shipped ongoing product improvements and bug fixes as part of continuous feature delivery.

  - name: Access Support — DSA/NMH Product Platform
    location: United Kingdom
    title: React · Node.js · Express · MySQL
    dates: ""
    bullets:
      - Maintained and enhanced a live role-based application, shipping production product improvements rather than performing a platform rebuild.
      - Delivered fixes and UI improvements across staff availability, daylight-saving-time handling, calendar/session flows and admin/staff workflows.
      - Supported UAT deployments and production delivery across role-restricted application flows.
      - Worked as part of a team on frontend product development and issue resolution.

  - name: Toolstation — E-Commerce Platform Rebuild
    location: Netherlands
    title: Nuxt.js 3, Vue.js, Tailwind CSS, Pinia, Builder.io, Flowbite
    dates: 12/2023 – Present
    bullets:
      - Contributed to a live rebuild serving 600+ stores across Europe.
      - Built a component library structured on atomic-design principles (atoms → molecules → organisms).
      - Used Builder.io for CMS-driven content and Pinia for application state management.

skills: >-
  Frontend: React.js, Next.js, Vue.js, Nuxt.js, TypeScript, JavaScript (ES6+), HTML5, CSS3;
  UI & Styling: Tailwind CSS, Bootstrap, Responsive Design, Component Libraries, Design Systems;
  Engineering: State Management (Pinia), Performance Optimization, RBAC, Internationalisation (i18n);
  Backend & Tools: NestJS, Node.js, Express, MongoDB, MySQL, Builder.io, Flowbite, Git, Vite, Postman, Vercel

interests: >-
  Open to frontend / UI roles across Europe (remote or on-site with relocation support);
  component libraries and design systems; performance-focused product engineering
```

### `data/master_resume.md`

```markdown
# Parth Sharma

**Frontend Engineer | React.js · Next.js · Vue.js · TypeScript**  
India | Open to Relocation across Europe · parthinteract@gmail.com · +91 78768-00210 · [LinkedIn](https://www.linkedin.com/in/parthsharma2880/) · [GitHub](https://github.com/parth2880) · [Portfolio](https://parth-interact.vercel.app/)

> Canonical structured data used by the automator lives in `data/master_resume.yaml`.
> Edit that YAML first — this Markdown is a human-readable mirror.

## Professional Summary

Frontend/UI Engineer with 3.5 years of experience building modern, scalable, and accessible web applications using React, Next.js, Vue.js, and TypeScript. Contributed to the frontend rebuild of Toolstation, a Netherlands-based e-commerce platform, helping drive up to a 35% improvement in application performance with Nuxt 3 and Tailwind CSS. Currently leading UX and frontend delivery for live UK product platforms at Tedekstra. Experienced in reusable, atomic-design component libraries and shipping production interfaces for international clients.

## Technical Skills

**Frontend:** React.js, Next.js, Vue.js, Nuxt.js, TypeScript, JavaScript (ES6+), HTML5, CSS3  

**UI & Styling:** Tailwind CSS, Bootstrap, Responsive Design, Component Libraries, Design Systems  

**Engineering:** State Management (Pinia), Performance Optimization, RBAC, Internationalisation (i18n)  

**Backend & Tools:** NestJS, Node.js, Express, MongoDB, MySQL, Builder.io, Flowbite, Git, Vite, Postman, Vercel

## Professional Experience

**Tedekstra** — Remote  
*User Experience Lead* · 10/2025 – Present  
- Owned assigned frontend work across live UK product platforms, shipping features and production fixes rather than full rebuilds.
- Delivered EN/CY internationalisation, CMS-driven content, booking and authentication UI for Cycling4All (Next.js / React / TypeScript).
- Implemented and enhanced RBAC, HR dashboard/calendar, customer notes with @mentions, and project/package forms for Aqueous Digital’s internal CRM.
- Maintained and improved Access Support’s role-based DSA/NMH product across availability, DST handling, calendar/session flows and UAT/production delivery.

**WebReinvent Technologies Pvt. Ltd.** — Delhi, India  
*Software Engineer* · 01/2024 – 10/2025  
- Delivered production frontend features in React.js and Vue.js for international clients.
- Contributed to the frontend rebuild of Toolstation, helping drive up to a 35% improvement in performance.
- Built and maintained reusable, atomic-design component libraries.
- Collaborated with cross-functional teams to ship responsive and pixel-perfect interfaces.

**WebReinvent Technologies Pvt. Ltd.** — Delhi, India  
*Frontend Developer Trainee* · 07/2023 – 01/2024  
- Built responsive, user-friendly interfaces in React.js for client-facing websites.
- Identified and resolved production bugs and implemented new features.

## Selected Projects

**Cycling4All — Live Cycling Platform** · United Kingdom  
*Next.js · React · TypeScript · Tailwind CSS*  
- Delivered frontend features and production fixes on a live Next.js/React application rather than rebuilding the platform from scratch.
- Implemented English/Welsh (EN/CY) internationalisation, CMS-driven content, booking and authentication UI.
- Integrated and supported Google Analytics and resolved production issues across footer, contact and user-facing flows.
- Owned assigned frontend work within a team, shipping features and fixes to the existing production application.

**Aqueous Digital — Internal CRM Platform** · United Kingdom  
*Next.js · React · TypeScript · Tailwind CSS · NestJS · MongoDB*  
- Delivered frontend features and production fixes for an internal CRM used by a UK marketing organisation.
- Implemented and enhanced RBAC, HR dashboard/calendar, customer notes with @mentions, project/package forms and navigation UI.
- Worked across the frontend layer of a Next.js/React/TypeScript product integrated with a NestJS and MongoDB backend.
- Shipped ongoing product improvements and bug fixes as part of continuous feature delivery.

**Access Support — DSA/NMH Product Platform** · United Kingdom  
*React · Node.js · Express · MySQL*  
- Maintained and enhanced a live role-based application, shipping production product improvements rather than performing a platform rebuild.
- Delivered fixes and UI improvements across staff availability, daylight-saving-time handling, calendar/session flows and admin/staff workflows.
- Supported UAT deployments and production delivery across role-restricted application flows.
- Worked as part of a team on frontend product development and issue resolution.

**Toolstation — E-Commerce Platform Rebuild (Netherlands)** · 12/2023 – Present  
*Nuxt.js 3, Vue.js, Tailwind CSS, Pinia, Builder.io, Flowbite*  
- Contributed to a live rebuild serving 600+ stores across Europe.
- Built a component library structured on atomic-design principles (atoms → molecules → organisms).
- Used Builder.io for CMS-driven content and Pinia for application state management.

## Education

**Meri College of Engineering and Technology** — India  
*B.Tech in Computer Science & Engineering* · 2022 – 2026

## Languages

**English:** Professional Working Proficiency  
**Hindi:** Native
```

### `apps/api/nest-cli.json`

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true,
    "tsConfigPath": "tsconfig.build.json",
    "assets": ["resume/templates/*.hbs"]
  }
}
```

### `apps/api/package.json`

```json
{
  "name": "@job-automator/api",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "build": "nest build",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:prod": "node dist/main",
    "prisma:generate": "DATABASE_URL=file:../../../data/app.db prisma generate",
    "postinstall": "DATABASE_URL=file:../../../data/app.db prisma generate",
    "linkedin-login": "ts-node -r tsconfig-paths/register src/cli.ts login",
    "run:pipeline": "ts-node -r tsconfig-paths/register src/cli.ts run",
    "process": "ts-node -r tsconfig-paths/register src/cli.ts process"
  },
  "dependencies": {
    "@nestjs/common": "^11.0.0",
    "@nestjs/config": "^4.0.0",
    "@nestjs/core": "^11.0.0",
    "@nestjs/platform-express": "^11.0.0",
    "@prisma/client": "^6.14.0",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.2",
    "commander": "^14.0.0",
    "dotenv": "^16.6.1",
    "handlebars": "^4.7.8",
    "js-yaml": "^4.1.0",
    "openai": "^4.104.0",
    "playwright": "^1.55.0",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.2"
  },
  "devDependencies": {
    "@nestjs/cli": "^11.0.0",
    "@nestjs/schematics": "^11.0.0",
    "@types/express": "^5.0.3",
    "@types/js-yaml": "^4.0.9",
    "@types/node": "^22.17.0",
    "prisma": "^6.14.0",
    "ts-node": "^10.9.2",
    "tsconfig-paths": "^4.2.0",
    "typescript": "^5.9.2"
  }
}
```

### `apps/api/prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

/// Matches the Python SQLite schema in src/job_automator/db/models.py
model Job {
  id                    Int     @id @default(autoincrement())
  linkedinJobId         String  @unique @map("linkedin_job_id")
  title                 String
  company               String  @default("")
  location              String  @default("")
  url                   String
  postedText            String  @default("") @map("posted_text")
  description           String  @default("")
  matchScore            Int?    @map("match_score")
  matchRationale        String  @default("") @map("match_rationale")
  status                String  @default("new")
  isEasyApply           Int     @default(1) @map("is_easy_apply")
  tailoredResumeMdPath  String? @map("tailored_resume_md_path")
  tailoredResumePdfPath String? @map("tailored_resume_pdf_path")
  coverLetterPath       String? @map("cover_letter_path")
  applyError            String  @default("") @map("apply_error")
  appliedAt             String? @map("applied_at")
  createdAt             String  @default("") @map("created_at")
  updatedAt             String  @default("") @map("updated_at")

  @@index([status], map: "idx_jobs_status")
  @@index([matchScore], map: "idx_jobs_score")
  @@index([isEasyApply], map: "idx_jobs_easy_apply")
  @@map("jobs")
}
```

### `apps/api/src/app.module.ts`

```typescript
import { Module } from "@nestjs/common";
import { JobsModule } from "./jobs/jobs.module";
import { PipelineModule } from "./pipeline/pipeline.module";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [PrismaModule, JobsModule, PipelineModule],
})
export class AppModule {}
```

### `apps/api/src/cli.ts`

```typescript
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Command } from "commander";
import { config as loadDotenv } from "dotenv";
import { join } from "path";
import { AppModule } from "./app.module";
import { PROJECT_ROOT, ensureDataDirs } from "./common/paths";
import { JobsService } from "./jobs/jobs.service";
import { LinkedInSession } from "./linkedin/session";
import { runPipeline } from "./pipeline/pipeline";
import { defaultSearchOptions } from "./pipeline/search-options";
import { getRolesConfig } from "./common/config";

loadDotenv({ path: join(PROJECT_ROOT, ".env") });
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = `file:${join(PROJECT_ROOT, "data", "app.db")}`;
}

async function withApp<T>(fn: (jobs: JobsService) => Promise<T>): Promise<T> {
  ensureDataDirs();
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ["error", "warn"] });
  try {
    const jobs = app.get(JobsService);
    return await fn(jobs);
  } finally {
    await app.close();
  }
}

const program = new Command();
program.name("job-automator").description("NestJS LinkedIn job finder (search → score → tailor)");

program
  .command("login")
  .option("--timeout <seconds>", "Wait for manual LinkedIn login", "180")
  .action(async (opts) => {
    const session = new LinkedInSession({ headless: false });
    await session.start();
    try {
      await session.ensureLoggedIn(Number(opts.timeout) || 180);
      console.log("Login session saved to data/browser_profile");
    } finally {
      await session.close();
    }
  });

program
  .command("run")
  .option("--min-score <n>", "Override min match score")
  .option("--dry-run", "Search + score only", false)
  .action(async (opts) => {
    await withApp((jobs) =>
      runPipeline(jobs, {
        dryRun: Boolean(opts.dryRun),
        minScore: opts.minScore ? Number(opts.minScore) : undefined,
        searchOptions: defaultSearchOptions({
          posted_within_hours: getRolesConfig().posted_within_hours,
        }),
      }),
    );
  });

program
  .command("process")
  .option("--min-score <n>", "Override min match score")
  .action(async (opts) => {
    await withApp((jobs) =>
      runPipeline(jobs, {
        skipSearch: true,
        minScore: opts.minScore ? Number(opts.minScore) : undefined,
      }),
    );
  });

program.parseAsync(process.argv);
```

### `apps/api/src/common/config.ts`

```typescript
import { readFileSync } from "fs";
import { config as loadDotenv } from "dotenv";
import { join } from "path";
import * as yaml from "js-yaml";
import { PREFERENCES_CONFIG, PROJECT_ROOT, ROLES_CONFIG, ensureDataDirs } from "./paths";

loadDotenv({ path: join(PROJECT_ROOT, ".env") });

export type RolesConfig = {
  titles: string[];
  skills: string[];
  location: string;
  locations: string[];
  remote_ok: boolean;
  relocation_target: string;
  location_prefer_keywords: string[];
  location_avoid_keywords: string[];
  posted_within_hours: number;
  min_match_score: number;
  max_jobs_per_run: number;
};

export type PreferencesConfig = {
  exclude_keywords: string[];
  seniority_prefer: string[];
  max_jobs_per_day: number;
  search_delay_seconds_min: number;
  search_delay_seconds_max: number;
  detail_delay_seconds_min: number;
  detail_delay_seconds_max: number;
  generate_cover_letter: boolean;
  master_resume_path: string;
  resume_template: string;
  resume_page_format: string;
  linkedin_base_url: string;
  browser_profile_dir: string;
  headless: boolean;
  search_easy_apply_filter: boolean;
  discover_external_apply: boolean;
  linkedin_remote_filter: boolean;
  search_remote_pass: boolean;
};

export type AppSettings = {
  llm_provider: string;
  llm_model?: string;
  llm_base_url?: string;
  groq_api_key?: string;
  gemini_api_key?: string;
  openai_api_key?: string;
  openai_model: string;
};

const rolesDefaults: RolesConfig = {
  titles: [],
  skills: [],
  location: "Europe",
  locations: [],
  remote_ok: true,
  relocation_target: "any",
  location_prefer_keywords: [],
  location_avoid_keywords: [],
  posted_within_hours: 24,
  min_match_score: 55,
  max_jobs_per_run: 20,
};

const prefsDefaults: PreferencesConfig = {
  exclude_keywords: [],
  seniority_prefer: [],
  max_jobs_per_day: 40,
  search_delay_seconds_min: 2,
  search_delay_seconds_max: 5,
  detail_delay_seconds_min: 1.5,
  detail_delay_seconds_max: 4,
  generate_cover_letter: true,
  master_resume_path: "data/master_resume.yaml",
  resume_template: "european",
  resume_page_format: "A4",
  linkedin_base_url: "https://www.linkedin.com",
  browser_profile_dir: "data/browser_profile",
  headless: false,
  search_easy_apply_filter: true,
  discover_external_apply: true,
  linkedin_remote_filter: false,
  search_remote_pass: true,
};

function loadYaml(path: string): Record<string, unknown> {
  try {
    const data = yaml.load(readFileSync(path, "utf8"));
    return data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

let rolesCache: RolesConfig | null = null;
let prefsCache: PreferencesConfig | null = null;

export function getRolesConfig(): RolesConfig {
  ensureDataDirs();
  if (!rolesCache) {
    rolesCache = { ...rolesDefaults, ...loadYaml(ROLES_CONFIG) } as RolesConfig;
  }
  return rolesCache;
}

export function getPreferences(): PreferencesConfig {
  ensureDataDirs();
  if (!prefsCache) {
    prefsCache = { ...prefsDefaults, ...loadYaml(PREFERENCES_CONFIG) } as PreferencesConfig;
  }
  return prefsCache;
}

export function getSettings(): AppSettings {
  return {
    llm_provider: (process.env.LLM_PROVIDER || "groq").trim().toLowerCase(),
    llm_model: process.env.LLM_MODEL || undefined,
    llm_base_url: process.env.LLM_BASE_URL || undefined,
    groq_api_key: process.env.GROQ_API_KEY || undefined,
    gemini_api_key: process.env.GEMINI_API_KEY || undefined,
    openai_api_key: process.env.OPENAI_API_KEY || undefined,
    openai_model: process.env.OPENAI_MODEL || "gpt-4o-mini",
  };
}

export function reloadConfigs(): void {
  rolesCache = null;
  prefsCache = null;
}

export function searchLocations(roles: RolesConfig): string[] {
  if (roles.locations?.length) return roles.locations;
  return roles.location ? [roles.location] : ["Europe"];
}
```

### `apps/api/src/common/job-status.ts`

```typescript
export const JobStatus = {
  NEW: "new",
  SCORED: "scored",
  READY: "ready",
  APPLIED: "applied",
  SKIPPED: "skipped",
  NEEDS_REVIEW: "needs_review",
  NOT_EASY_APPLY: "not_easy_apply",
} as const;

export type JobStatusValue = (typeof JobStatus)[keyof typeof JobStatus];

export const JOB_STATUSES = Object.values(JobStatus);

export type JobDto = {
  id: number;
  linkedin_job_id: string;
  title: string;
  company: string;
  location: string;
  url: string;
  posted_text: string;
  description: string;
  match_score: number | null;
  match_rationale: string;
  status: string;
  is_easy_apply: boolean;
  tailored_resume_md_path: string | null;
  tailored_resume_pdf_path: string | null;
  cover_letter_path: string | null;
  apply_error: string;
  applied_at: string | null;
  created_at: string;
  updated_at: string;
};

export function nowIso(): string {
  return new Date().toISOString().slice(0, 19);
}
```

### `apps/api/src/common/paths.ts`

```typescript
import { existsSync, mkdirSync } from "fs";
import { join, resolve } from "path";

function findProjectRoot(): string {
  const candidates = [
    process.env.PROJECT_ROOT,
    process.cwd(),
    join(process.cwd(), "..", ".."),
    join(__dirname, "..", "..", "..", ".."),
    join(__dirname, "..", "..", ".."),
  ].filter(Boolean) as string[];

  for (const dir of candidates) {
    const root = resolve(dir);
    if (existsSync(join(root, "config", "roles.yaml"))) {
      return root;
    }
  }
  return resolve(process.cwd());
}

export const PROJECT_ROOT = findProjectRoot();
export const CONFIG_DIR = join(PROJECT_ROOT, "config");
export const DATA_DIR = join(PROJECT_ROOT, "data");
export const OUTPUTS_DIR = join(DATA_DIR, "outputs");
export const DB_PATH = join(DATA_DIR, "app.db");
export const ROLES_CONFIG = join(CONFIG_DIR, "roles.yaml");
export const PREFERENCES_CONFIG = join(CONFIG_DIR, "preferences.yaml");
export const MASTER_RESUME_YAML = join(DATA_DIR, "master_resume.yaml");
export const BROWSER_PROFILE = join(DATA_DIR, "browser_profile");

export function ensureDataDirs(): void {
  mkdirSync(DATA_DIR, { recursive: true });
  mkdirSync(OUTPUTS_DIR, { recursive: true });
  mkdirSync(BROWSER_PROFILE, { recursive: true });
}
```

### `apps/api/src/jobs/job.mapper.ts`

```typescript
import { Job, Prisma } from "@prisma/client";
import { JobDto, JobStatus, JobStatusValue, nowIso } from "../common/job-status";

export function toJobDto(job: Job): JobDto {
  return {
    id: job.id,
    linkedin_job_id: job.linkedinJobId,
    title: job.title,
    company: job.company,
    location: job.location,
    url: job.url,
    posted_text: job.postedText,
    description: job.description,
    match_score: job.matchScore,
    match_rationale: job.matchRationale,
    status: job.status,
    is_easy_apply: Boolean(job.isEasyApply),
    tailored_resume_md_path: job.tailoredResumeMdPath,
    tailored_resume_pdf_path: job.tailoredResumePdfPath,
    cover_letter_path: job.coverLetterPath,
    apply_error: job.applyError,
    applied_at: job.appliedAt,
    created_at: job.createdAt,
    updated_at: job.updatedAt,
  };
}

export type JobFilters = {
  status?: string | null;
  minScore?: number | null;
  maxScore?: number | null;
  q?: string | null;
  company?: string | null;
  location?: string | null;
  easyApply?: boolean | null;
  hasResume?: boolean | null;
};

export function buildWhere(filters: JobFilters): Prisma.JobWhereInput {
  const where: Prisma.JobWhereInput = {};
  if (filters.status) where.status = filters.status;
  if (filters.minScore != null || filters.maxScore != null) {
    where.matchScore = {};
    if (filters.minScore != null) where.matchScore.gte = filters.minScore;
    if (filters.maxScore != null) where.matchScore.lte = filters.maxScore;
  }
  if (filters.q?.trim()) {
    const q = filters.q.trim();
    where.OR = [
      { title: { contains: q } },
      { company: { contains: q } },
      { location: { contains: q } },
      { description: { contains: q } },
      { matchRationale: { contains: q } },
      { postedText: { contains: q } },
    ];
  }
  if (filters.company?.trim()) {
    where.company = { contains: filters.company.trim() };
  }
  if (filters.location?.trim()) {
    where.location = { contains: filters.location.trim() };
  }
  if (filters.easyApply === true) where.isEasyApply = 1;
  if (filters.easyApply === false) where.isEasyApply = 0;
  if (filters.hasResume === true) where.tailoredResumePdfPath = { not: null };
  if (filters.hasResume === false) where.tailoredResumePdfPath = null;
  return where;
}

export function orderByFor(sort: string): Prisma.JobOrderByWithRelationInput[] {
  switch (sort) {
    case "oldest":
      return [{ createdAt: "asc" }, { id: "asc" }];
    case "score_desc":
      return [{ matchScore: "desc" }, { createdAt: "desc" }];
    case "score_asc":
      return [{ matchScore: "asc" }, { createdAt: "desc" }];
    case "updated":
      return [{ updatedAt: "desc" }, { id: "desc" }];
    default:
      return [{ createdAt: "desc" }, { id: "desc" }];
  }
}

export { nowIso, JobStatus };
export type { JobStatusValue };
```

### `apps/api/src/jobs/jobs.controller.ts`

```typescript
import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Res,
} from "@nestjs/common";
import type { Response } from "express";
import { createReadStream, existsSync, readFileSync } from "fs";
import { JobsService } from "./jobs.service";
import { toJobDto } from "./job.mapper";
import { JOB_STATUSES, JobStatus, JobStatusValue } from "../common/job-status";
import { scoreJob } from "../matching/scorer";
import { tailorJob } from "../resume/tailor";
import { LLMError } from "../llm/llm";

type CreateManualBody = {
  title?: string;
  company?: string;
  location?: string;
  url?: string;
  description?: string;
  is_easy_apply?: boolean;
  /** If true, score and generate tailored PDF immediately */
  process?: boolean;
};

const DEFAULT_PER_PAGE = 25;
const ALLOWED_PER_PAGE = new Set([10, 25, 50, 100]);

function parseEasyApply(value?: string): boolean | null {
  if (!value || value === "all") return null;
  if (value === "easy") return true;
  if (value === "external") return false;
  return null;
}

function parseHasResume(value?: string): boolean | null {
  if (!value || value === "all") return null;
  if (value === "yes") return true;
  if (value === "no") return false;
  return null;
}

@Controller("api/jobs")
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Post()
  async createManual(@Body() body: CreateManualBody) {
    try {
      let job = await this.jobs.createManual({
        title: body.title || "",
        company: body.company,
        location: body.location,
        url: body.url,
        description: body.description || "",
        isEasyApply: body.is_easy_apply,
      });
      if (body.process) {
        if (job.matchScore == null) {
          const [score, rationale] = await scoreJob(job, undefined, true);
          await this.jobs.updateScore(job.id, score, rationale, JobStatus.SCORED);
          job = (await this.jobs.get(job.id))!;
        }
        try {
          job = await tailorJob(this.jobs, job);
        } catch (exc) {
          const msg = exc instanceof LLMError || exc instanceof Error ? exc.message : String(exc);
          throw new HttpException(
            {
              message: `Job saved (id ${job.id}) but tailor failed: ${msg}`,
              job: toJobDto(job),
            },
            HttpStatus.BAD_GATEWAY,
          );
        }
      }
      return toJobDto(job);
    } catch (exc) {
      if (exc instanceof HttpException) throw exc;
      const msg = exc instanceof Error ? exc.message : String(exc);
      throw new HttpException(msg, HttpStatus.BAD_REQUEST);
    }
  }

  @Get()
  async list(
    @Query("status") status?: string,
    @Query("min_score") minScore?: string,
    @Query("max_score") maxScore?: string,
    @Query("q") q?: string,
    @Query("company") company?: string,
    @Query("location") location?: string,
    @Query("apply_type") applyType = "all",
    @Query("has_resume") hasResume = "all",
    @Query("sort") sort = "newest",
    @Query("page") page = "1",
    @Query("per_page") perPage = String(DEFAULT_PER_PAGE),
  ) {
    const filters = {
      status: status || null,
      q: q || null,
      company: company || null,
      location: location || null,
      minScore: minScore ? Number(minScore) : null,
      maxScore: maxScore ? Number(maxScore) : null,
      easyApply: parseEasyApply(applyType),
      hasResume: parseHasResume(hasResume),
    };
    const sortVal = ["newest", "oldest", "score_desc", "score_asc", "updated"].includes(sort)
      ? sort
      : "newest";
    const perPageNum = ALLOWED_PER_PAGE.has(Number(perPage)) ? Number(perPage) : DEFAULT_PER_PAGE;
    const total = await this.jobs.count(filters);
    const totalPages = total ? Math.max(1, Math.ceil(total / perPageNum)) : 1;
    const pageVal = Math.min(Math.max(1, Number(page) || 1), totalPages);
    const offset = (pageVal - 1) * perPageNum;
    const rows = await this.jobs.list(filters, sortVal, perPageNum, offset);
    const counts = {
      all: await this.jobs.count(),
      ready: await this.jobs.count({ status: "ready" }),
      scored: await this.jobs.count({ status: "scored" }),
      applied: await this.jobs.count({ status: "applied" }),
      needs_review: await this.jobs.count({ status: "needs_review" }),
      skipped: await this.jobs.count({ status: "skipped" }),
      new: await this.jobs.count({ status: "new" }),
      not_easy_apply: await this.jobs.count({ status: "not_easy_apply" }),
    };
    return {
      jobs: rows.map(toJobDto),
      page: pageVal,
      per_page: perPageNum,
      total,
      total_pages: totalPages,
      counts,
      showing_from: rows.length ? offset + 1 : 0,
      showing_to: offset + rows.length,
    };
  }

  @Post(":id/score")
  async scoreOne(@Param("id", ParseIntPipe) id: number) {
    const job = await this.jobs.get(id);
    if (!job) throw new NotFoundException("Job not found");
    const [score, rationale] = await scoreJob(job, undefined, true);
    await this.jobs.updateScore(id, score, rationale, JobStatus.SCORED);
    const updated = await this.jobs.get(id);
    return toJobDto(updated!);
  }

  @Post(":id/tailor")
  async tailorOne(@Param("id", ParseIntPipe) id: number) {
    let job = await this.jobs.get(id);
    if (!job) throw new NotFoundException("Job not found");
    if (job.matchScore == null) {
      const [score, rationale] = await scoreJob(job, undefined, true);
      await this.jobs.updateScore(id, score, rationale, JobStatus.SCORED);
      job = (await this.jobs.get(id))!;
    }
    try {
      const tailored = await tailorJob(this.jobs, job);
      return toJobDto(tailored);
    } catch (exc) {
      const msg = exc instanceof LLMError || exc instanceof Error ? exc.message : String(exc);
      throw new HttpException(msg, HttpStatus.BAD_GATEWAY);
    }
  }

  @Get(":id/resume.pdf")
  async resumePdf(@Param("id", ParseIntPipe) id: number, @Res() res: Response) {
    const job = await this.jobs.get(id);
    if (!job?.tailoredResumePdfPath || !existsSync(job.tailoredResumePdfPath)) {
      throw new NotFoundException("PDF not found");
    }
    res.setHeader("Content-Type", "application/pdf");
    createReadStream(job.tailoredResumePdfPath).pipe(res);
  }

  @Get(":id")
  async one(@Param("id", ParseIntPipe) id: number) {
    const job = await this.jobs.get(id);
    if (!job) throw new NotFoundException("Job not found");
    let cover = "";
    let resume_md = "";
    if (job.coverLetterPath && existsSync(job.coverLetterPath)) {
      cover = readFileSync(job.coverLetterPath, "utf8");
    }
    if (job.tailoredResumeMdPath && existsSync(job.tailoredResumeMdPath)) {
      resume_md = readFileSync(job.tailoredResumeMdPath, "utf8");
    }
    return { ...toJobDto(job), cover, resume_md };
  }

  @Post(":id/status/:status")
  async setStatus(
    @Param("id", ParseIntPipe) id: number,
    @Param("status") status: string,
  ) {
    const st = status.toLowerCase() as JobStatusValue;
    if (!JOB_STATUSES.includes(st)) {
      throw new HttpException("Invalid status", HttpStatus.BAD_REQUEST);
    }
    try {
      const job = await this.jobs.setStatus(id, st);
      return toJobDto(job);
    } catch {
      throw new NotFoundException("Job not found");
    }
  }
}
```

### `apps/api/src/jobs/jobs.module.ts`

```typescript
import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { JobsController } from "./jobs.controller";
import { JobsService } from "./jobs.service";

@Module({
  imports: [PrismaModule],
  controllers: [JobsController],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
```

### `apps/api/src/jobs/jobs.service.ts`

```typescript
import { Injectable } from "@nestjs/common";
import { Job, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { JobStatus, JobStatusValue, nowIso } from "../common/job-status";
import { JobFilters, buildWhere, orderByFor } from "./job.mapper";

function fromSqliteRow(row: Record<string, unknown>): Job {
  return {
    id: Number(row.id),
    linkedinJobId: String(row.linkedin_job_id),
    title: String(row.title ?? ""),
    company: String(row.company ?? ""),
    location: String(row.location ?? ""),
    url: String(row.url ?? ""),
    postedText: String(row.posted_text ?? ""),
    description: String(row.description ?? ""),
    matchScore: row.match_score == null ? null : Number(row.match_score),
    matchRationale: String(row.match_rationale ?? ""),
    status: String(row.status),
    isEasyApply: Number(row.is_easy_apply ?? 1),
    tailoredResumeMdPath: (row.tailored_resume_md_path as string) ?? null,
    tailoredResumePdfPath: (row.tailored_resume_pdf_path as string) ?? null,
    coverLetterPath: (row.cover_letter_path as string) ?? null,
    applyError: String(row.apply_error ?? ""),
    appliedAt: (row.applied_at as string) ?? null,
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

@Injectable()
export class JobsService {
  constructor(private readonly prisma: PrismaService) {}

  get(id: number) {
    return this.prisma.job.findUnique({ where: { id } });
  }

  list(filters: JobFilters, sort = "newest", limit = 100, offset = 0) {
    return this.prisma.job.findMany({
      where: buildWhere(filters),
      orderBy: orderByFor(sort),
      take: Math.max(0, limit),
      skip: Math.max(0, offset),
    });
  }

  count(filters: JobFilters = {}) {
    return this.prisma.job.count({ where: buildWhere(filters) });
  }

  async createManual(input: {
    title: string;
    company?: string;
    location?: string;
    url?: string;
    description: string;
    isEasyApply?: boolean;
  }): Promise<Job> {
    const title = input.title.trim();
    const description = input.description.trim();
    if (!title) throw new Error("Title is required");
    if (description.length <= 40) {
      throw new Error("Job description must be longer than 40 characters");
    }
    const linkedinJobId = `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const url = (input.url || "").trim() || `manual://local/${linkedinJobId}`;
    const easy = input.isEasyApply === false ? false : true;
    return this.upsertDiscovered({
      linkedinJobId,
      title,
      company: (input.company || "").trim(),
      location: (input.location || "").trim(),
      url,
      postedText: "Manual",
      description,
      isEasyApply: easy,
      status: easy ? JobStatus.NEW : JobStatus.NOT_EASY_APPLY,
    });
  }

  async upsertDiscovered(input: {
    linkedinJobId: string;
    title: string;
    company: string;
    location: string;
    url: string;
    postedText?: string;
    description?: string;
    isEasyApply?: boolean;
    status?: JobStatusValue;
  }): Promise<Job> {
    const now = nowIso();
    const easy = input.isEasyApply === false ? 0 : 1;
    const initialStatus =
      input.status ||
      (easy ? JobStatus.NEW : JobStatus.NOT_EASY_APPLY);
    const existing = await this.prisma.job.findUnique({
      where: { linkedinJobId: input.linkedinJobId },
    });
    if (existing) {
      let newStatus = existing.status;
      if (
        !existing.isEasyApply &&
        easy &&
        existing.status === JobStatus.NOT_EASY_APPLY
      ) {
        newStatus = JobStatus.NEW;
      } else if (
        input.status &&
        (existing.status === JobStatus.NEW ||
          existing.status === JobStatus.NOT_EASY_APPLY)
      ) {
        newStatus = input.status;
      }
      const desc = input.description || "";
      return this.prisma.job.update({
        where: { linkedinJobId: input.linkedinJobId },
        data: {
          title: input.title,
          company: input.company,
          location: input.location,
          url: input.url,
          postedText: input.postedText || existing.postedText,
          description:
            desc.length > (existing.description || "").length
              ? desc
              : existing.description,
          isEasyApply: easy ? 1 : existing.isEasyApply,
          status: newStatus,
          updatedAt: now,
        },
      });
    }
    return this.prisma.job.create({
      data: {
        linkedinJobId: input.linkedinJobId,
        title: input.title,
        company: input.company,
        location: input.location,
        url: input.url,
        postedText: input.postedText || "",
        description: input.description || "",
        status: initialStatus,
        isEasyApply: easy,
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  updateDescription(id: number, description: string) {
    return this.prisma.job.update({
      where: { id },
      data: { description, updatedAt: nowIso() },
    });
  }

  updateScore(
    id: number,
    score: number,
    rationale: string,
    status: JobStatusValue = JobStatus.SCORED,
  ) {
    return this.prisma.job.update({
      where: { id },
      data: {
        matchScore: score,
        matchRationale: rationale,
        status,
        updatedAt: nowIso(),
      },
    });
  }

  updateTailoredPaths(
    id: number,
    mdPath: string,
    pdfPath: string,
    coverLetterPath: string | null,
    status: JobStatusValue = JobStatus.READY,
  ) {
    return this.prisma.job.update({
      where: { id },
      data: {
        tailoredResumeMdPath: mdPath,
        tailoredResumePdfPath: pdfPath,
        coverLetterPath,
        status,
        updatedAt: nowIso(),
      },
    });
  }

  async setStatus(id: number, status: JobStatusValue) {
    const now = nowIso();
    const data: Prisma.JobUpdateInput = { status, updatedAt: now };
    if (status === JobStatus.APPLIED) {
      data.appliedAt = now;
    }
    return this.prisma.job.update({ where: { id }, data });
  }

  async listNeedingDescription(limit = 50): Promise<Job[]> {
    const rows = await this.prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT * FROM jobs
      WHERE status IN (${JobStatus.NEW}, ${JobStatus.NOT_EASY_APPLY})
        AND (description IS NULL OR length(trim(description)) <= 40)
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
    return rows.map(fromSqliteRow);
  }

  async listForScoring(limit = 50): Promise<Job[]> {
    const rows = await this.prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT * FROM jobs
      WHERE status IN (${JobStatus.NEW}, ${JobStatus.NOT_EASY_APPLY})
        AND length(description) > 40
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
    return rows.map(fromSqliteRow);
  }

  async listForTailoring(minScore: number, limit = 50): Promise<Job[]> {
    const rows = await this.prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT * FROM jobs
      WHERE status = ${JobStatus.SCORED} AND match_score >= ${minScore}
      ORDER BY match_score DESC
      LIMIT ${limit}
    `;
    return rows.map(fromSqliteRow);
  }

  countToday() {
    return this.prisma.$queryRaw<{ c: number }[]>`
      SELECT COUNT(*) AS c FROM jobs WHERE date(created_at) = date('now')
    `.then((rows) => Number(rows[0]?.c ?? 0));
  }
}
```

### `apps/api/src/linkedin/job-detail.ts`

```typescript
import { Page } from "playwright";
import { Job } from "@prisma/client";
import { LinkedInSession } from "./session";
import { JobsService } from "../jobs/jobs.service";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function extractJobIdFromUrl(url: string): string | null {
  const patterns = [/\/jobs\/view\/(\d+)/, /[?&]currentJobId=(\d+)/, /\/jobs\/collections\/[^/]+\/?.*?(\d{8,})/];
  for (const pattern of patterns) {
    const m = url.match(pattern);
    if (m) return m[1];
  }
  return null;
}

function normalizeWhitespace(text: string): string {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function fetchJobDescription(
  page: Page,
  jobUrl: string,
  settleSeconds = 1.5,
): Promise<string> {
  await page.goto(jobUrl, { waitUntil: "domcontentloaded" });
  await sleep(settleSeconds * 1000);
  const selectors = [
    ".jobs-description__content",
    ".jobs-box__html-content",
    "#job-details",
    ".description__text",
    "article.jobs-description",
    ".jobs-description",
  ];
  for (const sel of selectors) {
    const loc = page.locator(sel);
    if ((await loc.count()) > 0) {
      try {
        const text = (await loc.first().innerText({ timeout: 3000 })).trim();
        if (text.length > 40) return normalizeWhitespace(text);
      } catch {
        continue;
      }
    }
  }
  try {
    const text = (await page.locator("main").first().innerText({ timeout: 3000 })).trim();
    return normalizeWhitespace(text).slice(0, 12000);
  } catch {
    return "";
  }
}

export async function enrichMissingDescriptions(
  session: LinkedInSession,
  jobs: JobsService,
  opts: { limit?: number; delayMin?: number; delayMax?: number } = {},
): Promise<number> {
  const pending = await jobs.listNeedingDescription(opts.limit ?? 80);
  if (!pending.length || !session.page) return 0;
  const delayMin = opts.delayMin ?? 1.5;
  const delayMax = opts.delayMax ?? 4;
  let filled = 0;
  console.log(`Fetching descriptions for ${pending.length} unscored job(s)…`);
  for (const job of pending) {
    await sleep((delayMin + Math.random() * (delayMax - delayMin)) * 1000);
    const desc = await fetchJobDescription(session.page, job.url);
    if (desc && desc.length > 40) {
      await jobs.updateDescription(job.id, desc);
      filled += 1;
      console.log(`  JD ok: ${job.title} @ ${job.company}`);
    } else {
      console.log(`  JD missing: ${job.title} @ ${job.company}`);
    }
  }
  return filled;
}

export type { Job };
```

### `apps/api/src/linkedin/search.ts`

```typescript
import { writeFileSync, mkdirSync } from "fs";
import { Page } from "playwright";
import { PreferencesConfig, RolesConfig, getPreferences, getRolesConfig, searchLocations } from "../common/config";
import { JobStatus } from "../common/job-status";
import { DATA_DIR } from "../common/paths";
import { JobsService } from "../jobs/jobs.service";
import { SearchOptions, defaultSearchOptions, summarizeOptions } from "../pipeline/search-options";
import { extractJobIdFromUrl, fetchJobDescription } from "./job-detail";
import { LinkedInSession } from "./session";

export type DiscoveredJob = {
  linkedin_job_id: string;
  title: string;
  company: string;
  location: string;
  url: string;
  posted_text: string;
  is_easy_apply: boolean;
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function sleepRange(lo: number, hi: number): Promise<void> {
  return sleep((lo + Math.random() * (hi - lo)) * 1000);
}

function shouldExclude(title: string, company: string, prefs: PreferencesConfig): boolean {
  const hay = `${title} ${company}`.toLowerCase();
  return prefs.exclude_keywords.some((kw) => hay.includes(kw.toLowerCase()));
}

function keywordQueries(roles: RolesConfig): string[] {
  const queries = [...roles.titles];
  if (roles.skills?.length) {
    queries.push(roles.skills.slice(0, 6).join(" OR "));
  }
  return queries;
}

function persistOptions(options: SearchOptions): void {
  try {
    mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(
      `${DATA_DIR}/last_search_filters.json`,
      JSON.stringify(options, null, 2),
      "utf8",
    );
  } catch (exc) {
    console.log(`  Warning: could not save last_search_filters.json (${exc})`);
  }
}

function urlHasFilter(url: string, key: string, value?: string): boolean {
  const hay = (url || "").toLowerCase();
  const needle = key.toLowerCase();
  if (!hay.includes(needle)) return false;
  if (!value) return true;
  return hay.includes(`${needle}=${value.toLowerCase()}`);
}

async function gotoWithFilters(
  page: Page,
  url: string,
  easyApply: boolean,
  under10: boolean,
): Promise<void> {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  const current = page.url() || "";
  const missing: string[] = [];
  if (easyApply && !urlHasFilter(current, "f_AL", "true")) missing.push("f_AL");
  if (under10 && !urlHasFilter(current, "f_EA", "true")) missing.push("f_EA");
  if (!easyApply && urlHasFilter(current, "f_AL", "true")) missing.push("clear_f_AL");
  if (missing.length) {
    console.log(`  LinkedIn filter mismatch (${missing}); re-applying URL`);
    await page.goto(url, { waitUntil: "domcontentloaded" });
  }
  console.log(`  Active page: ${page.url()}`);
}

async function cardHasEasyApply(card: ReturnType<Page["locator"]>): Promise<boolean> {
  try {
    const text = ((await card.innerText({ timeout: 1500 })) || "").toLowerCase();
    if (text.includes("easy apply")) return true;
  } catch {
    /* ignore */
  }
  for (const sel of [
    "li:has-text('Easy Apply')",
    ".job-card-container__footer-item:has-text('Easy Apply')",
    "span:has-text('Easy Apply')",
  ]) {
    try {
      if ((await card.locator(sel).count()) > 0) return true;
    } catch {
      continue;
    }
  }
  return false;
}

async function parseJobCards(
  page: Page,
  baseUrl: string,
  assumeEasyApply?: boolean | null,
): Promise<DiscoveredJob[]> {
  const jobs: DiscoveredJob[] = [];
  const seen = new Set<string>();
  const cards = page.locator(
    "li.jobs-search-results__list-item, div.job-card-container, li.scaffold-layout__list-item, div.base-card",
  );
  const count = await cards.count();
  for (let i = 0; i < Math.min(count, 40); i++) {
    const card = cards.nth(i);
    try {
      let jobId: string | null = null;
      for (const attr of ["data-job-id", "data-occludable-job-id"]) {
        const raw = await card.getAttribute(attr);
        const m = raw?.match(/\d+/);
        if (m) {
          jobId = m[0];
          break;
        }
      }
      if (!jobId) {
        const link = card.locator("a[href*='/jobs/view/'], a[href*='currentJobId=']").first();
        if ((await link.count()) > 0) {
          const href = await link.getAttribute("href");
          if (href) jobId = extractJobIdFromUrl(href);
        }
      }
      if (!jobId || seen.has(jobId)) continue;
      seen.add(jobId);

      let title = "";
      for (const sel of [
        ".job-card-list__title",
        ".base-search-card__title",
        "a.job-card-container__link",
        "h3",
        "strong",
      ]) {
        const tloc = card.locator(sel);
        if ((await tloc.count()) > 0) {
          title = (await tloc.first().innerText({ timeout: 1500 })).trim();
          if (title) break;
        }
      }
      let company = "";
      for (const sel of [
        ".job-card-container__primary-description",
        ".base-search-card__subtitle",
        ".artdeco-entity-lockup__subtitle",
        "h4",
      ]) {
        const cloc = card.locator(sel);
        if ((await cloc.count()) > 0) {
          company = (await cloc.first().innerText({ timeout: 1500 })).trim();
          if (company) break;
        }
      }
      let location = "";
      for (const sel of [
        ".job-card-container__metadata-item",
        ".job-search-card__location",
        ".artdeco-entity-lockup__caption",
      ]) {
        const lloc = card.locator(sel);
        if ((await lloc.count()) > 0) {
          location = (await lloc.first().innerText({ timeout: 1500 })).trim();
          if (location) break;
        }
      }
      let posted = "";
      for (const sel of ["time", ".job-search-card__listdate", ".job-card-container__listed-time"]) {
        const ploc = card.locator(sel);
        if ((await ploc.count()) > 0) {
          posted = (await ploc.first().innerText({ timeout: 1000 })).trim();
          if (posted) break;
        }
      }
      const isEasy =
        assumeEasyApply == null ? await cardHasEasyApply(card) : assumeEasyApply;
      if (!title) continue;
      jobs.push({
        linkedin_job_id: jobId,
        title: title.split("\n")[0].trim(),
        company: company.split("\n")[0].trim(),
        location: location.split("\n")[0].trim(),
        url: `${baseUrl}/jobs/view/${jobId}/`,
        posted_text: posted,
        is_easy_apply: isEasy,
      });
    } catch {
      continue;
    }
  }
  return jobs;
}

async function runQueryPass(args: {
  session: LinkedInSession;
  jobs: JobsService;
  query: string;
  searchLocation: string;
  roles: RolesConfig;
  prefs: PreferencesConfig;
  options: SearchOptions;
  easyApplyFilter: boolean;
  remoteFilter: boolean;
  assumeEasyApply: boolean | null;
  externalOnly: boolean;
  fetchDetails: boolean;
  dryRun: boolean;
  seenIds: Set<string>;
  budget: number;
  discovered: DiscoveredJob[];
}): Promise<void> {
  const page = args.session.page;
  if (!page) throw new Error("No page");
  const fTpr = args.options.posted_within_hours * 3600;
  const remote = Boolean(args.roles.remote_ok && args.remoteFilter);
  const url = args.session.buildJobsSearchUrl(args.query, args.searchLocation, {
    fTprSeconds: fTpr,
    easyApply: args.easyApplyFilter,
    remote,
    under10Applicants: args.options.under_10_applicants,
    sortBy: args.options.sort_by,
  });
  const applyLabel = args.easyApplyFilter
    ? "Easy Apply only"
    : args.externalOnly
      ? "external apply only"
      : "all apply types";
  const filterBits = [
    `past ${args.options.posted_within_hours}h`,
    `loc=${args.searchLocation}`,
    applyLabel,
    `sort=${args.options.sort_by}`,
  ];
  if (remote) filterBits.push("Remote");
  if (args.options.under_10_applicants) filterBits.push("<10 applicants");
  console.log(`Searching LinkedIn: '${args.query}' [${filterBits.join(", ")}]`);
  console.log(`  Built URL: ${url}`);
  await gotoWithFilters(page, url, args.easyApplyFilter, args.options.under_10_applicants);
  await sleepRange(args.prefs.search_delay_seconds_min, args.prefs.search_delay_seconds_max);
  try {
    const listPanel = page.locator(".jobs-search-results-list, .scaffold-layout__list").first();
    if ((await listPanel.count()) > 0) {
      for (let i = 0; i < 4; i++) {
        await listPanel.evaluate((el) => {
          (el as HTMLElement).scrollBy(0, (el as HTMLElement).scrollHeight);
        });
        await sleep(800);
      }
    }
  } catch {
    await page.mouse.wheel(0, 2000);
    await sleep(800);
  }
  const cards = await parseJobCards(page, args.session.baseUrl, args.assumeEasyApply);
  for (const card of cards) {
    if (args.discovered.length >= args.budget) break;
    if (args.seenIds.has(card.linkedin_job_id)) continue;
    if (shouldExclude(card.title, card.company, args.prefs)) continue;
    if (args.externalOnly && card.is_easy_apply) continue;
    args.seenIds.add(card.linkedin_job_id);
    args.discovered.push(card);
    if (args.dryRun) continue;
    const job = await args.jobs.upsertDiscovered({
      linkedinJobId: card.linkedin_job_id,
      title: card.title,
      company: card.company,
      location: card.location,
      url: card.url,
      postedText: card.posted_text,
      isEasyApply: card.is_easy_apply,
      status: card.is_easy_apply ? JobStatus.NEW : JobStatus.NOT_EASY_APPLY,
    });
    if (args.fetchDetails && !job.description) {
      await sleepRange(args.prefs.detail_delay_seconds_min, args.prefs.detail_delay_seconds_max);
      const desc = await fetchJobDescription(page, card.url);
      if (desc) await args.jobs.updateDescription(job.id, desc);
    }
  }
}

export async function searchJobs(
  session: LinkedInSession,
  jobs: JobsService,
  opts: {
    roles?: RolesConfig;
    prefs?: PreferencesConfig;
    options?: SearchOptions;
    fetchDetails?: boolean;
    dryRun?: boolean;
  } = {},
): Promise<DiscoveredJob[]> {
  const roles = opts.roles || getRolesConfig();
  const prefs = opts.prefs || getPreferences();
  const options =
    opts.options ||
    defaultSearchOptions({
      easy_apply: prefs.search_easy_apply_filter,
      discover_external: prefs.discover_external_apply,
      posted_within_hours: roles.posted_within_hours,
      workplace: prefs.linkedin_remote_filter
        ? "remote_only"
        : prefs.search_remote_pass
          ? "include_remote"
          : "any",
    });
  const fetchDetails = opts.fetchDetails ?? true;
  const dryRun = opts.dryRun ?? false;

  console.log(`\n=== Applying search filters ===\n${summarizeOptions(options)}\n${JSON.stringify(options)}\n`);
  persistOptions(options);

  const queries = keywordQueries(roles);
  const discovered: DiscoveredJob[] = [];
  const seenIds = new Set<string>();
  const daily = await jobs.countToday();
  const remainingToday = Math.max(0, prefs.max_jobs_per_day - daily);
  const budget = Math.min(
    roles.max_jobs_per_run,
    remainingToday || roles.max_jobs_per_run,
  );
  if (budget <= 0) {
    console.log("Daily job discovery budget reached; skipping search.");
    return [];
  }

  const useEaFilter = options.easy_apply;
  const searchLocs = searchLocations(roles);
  let remotePasses: boolean[];
  if (options.workplace === "remote_only") remotePasses = [true];
  else if (options.workplace === "include_remote") {
    remotePasses = roles.remote_ok ? [false, true] : [false];
  } else remotePasses = [false];

  for (const searchLocation of searchLocs) {
    if (discovered.length >= budget) break;
    for (const remoteFilter of remotePasses) {
      if (discovered.length >= budget) break;
      for (const query of queries) {
        if (discovered.length >= budget) break;
        await runQueryPass({
          session,
          jobs,
          query,
          searchLocation,
          roles,
          prefs,
          options,
          easyApplyFilter: useEaFilter,
          remoteFilter,
          assumeEasyApply: useEaFilter ? true : null,
          externalOnly: false,
          fetchDetails,
          dryRun,
          seenIds,
          budget,
          discovered,
        });
        await sleepRange(prefs.search_delay_seconds_min, prefs.search_delay_seconds_max);
      }
    }
  }

  if (options.discover_external && useEaFilter && discovered.length < budget) {
    for (const searchLocation of searchLocs) {
      if (discovered.length >= budget) break;
      for (const remoteFilter of remotePasses) {
        if (discovered.length >= budget) break;
        for (const query of queries) {
          if (discovered.length >= budget) break;
          await runQueryPass({
            session,
            jobs,
            query,
            searchLocation,
            roles,
            prefs,
            options,
            easyApplyFilter: false,
            remoteFilter,
            assumeEasyApply: null,
            externalOnly: true,
            fetchDetails: false,
            dryRun,
            seenIds,
            budget,
            discovered,
          });
          await sleepRange(prefs.search_delay_seconds_min, prefs.search_delay_seconds_max);
        }
      }
    }
  }

  const easyN = discovered.filter((j) => j.is_easy_apply).length;
  console.log(
    `Discovered ${discovered.length} job(s) (Easy Apply: ${easyN}, not Easy Apply: ${discovered.length - easyN})${dryRun ? " [dry-run]" : ""}`,
  );
  return discovered;
}
```

### `apps/api/src/linkedin/session.ts`

```typescript
import { BrowserContext, Page, chromium } from "playwright";
import { join } from "path";
import { getPreferences } from "../common/config";
import { PROJECT_ROOT, ensureDataDirs } from "../common/paths";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export class LinkedInSession {
  profileDir: string;
  headless: boolean;
  baseUrl: string;
  context: BrowserContext | null = null;
  page: Page | null = null;

  constructor(opts?: { profileDir?: string; headless?: boolean }) {
    const prefs = getPreferences();
    ensureDataDirs();
    this.profileDir = opts?.profileDir || join(PROJECT_ROOT, prefs.browser_profile_dir);
    this.headless = opts?.headless ?? prefs.headless;
    this.baseUrl = prefs.linkedin_base_url.replace(/\/$/, "");
  }

  async start(): Promise<Page> {
    this.context = await chromium.launchPersistentContext(this.profileDir, {
      headless: this.headless,
      viewport: { width: 1280, height: 900 },
      locale: "en-US",
      args: ["--disable-blink-features=AutomationControlled"],
    });
    this.page = this.context.pages()[0] || (await this.context.newPage());
    return this.page;
  }

  async close(): Promise<void> {
    if (this.context) {
      await this.context.close();
      this.context = null;
      this.page = null;
    }
  }

  async ensureLoggedIn(timeoutSeconds = 180): Promise<void> {
    if (!this.page) throw new Error("Session not started");
    await this.page.goto(`${this.baseUrl}/feed/`, { waitUntil: "domcontentloaded" });
    await sleep(2000);
    if (await this.isLoggedIn()) return;

    await this.page.goto(`${this.baseUrl}/login`, { waitUntil: "domcontentloaded" });
    console.log(
      `\nLog in to LinkedIn in the opened browser window.\nWaiting until your session is active (up to ${timeoutSeconds}s)...\n`,
    );
    const deadline = Date.now() + timeoutSeconds * 1000;
    while (Date.now() < deadline) {
      if (await this.isLoggedIn()) {
        console.log("LinkedIn login detected.");
        return;
      }
      await sleep(2000);
    }
    throw new Error("LinkedIn login not detected in time. Re-run `pnpm linkedin-login`.");
  }

  async isLoggedIn(): Promise<boolean> {
    if (!this.page) return false;
    const url = this.page.url().toLowerCase();
    if (url.includes("login") || url.includes("checkpoint") || url.includes("authwall")) {
      return false;
    }
    try {
      const nav = this.page.locator("global-nav, #global-nav, .global-nav");
      if ((await nav.count()) > 0 && (await nav.first().isVisible())) return true;
    } catch {
      /* ignore */
    }
    const cookies = this.context ? await this.context.cookies() : [];
    return cookies.some((c) => c.name === "li_at");
  }

  buildJobsSearchUrl(
    keywords: string,
    location: string,
    opts: {
      fTprSeconds?: number | null;
      easyApply?: boolean;
      remote?: boolean;
      under10Applicants?: boolean;
      sortBy?: string | null;
      start?: number;
    } = {},
  ): string {
    const params = new URLSearchParams();
    params.set("keywords", keywords);
    params.set("location", location);
    if (opts.fTprSeconds) params.set("f_TPR", `r${opts.fTprSeconds}`);
    if (opts.easyApply) params.set("f_AL", "true");
    if (opts.remote) params.set("f_WT", "2");
    if (opts.under10Applicants) params.set("f_EA", "true");
    if (opts.sortBy === "DD" || opts.sortBy === "R") params.set("sortBy", opts.sortBy);
    if (opts.start) params.set("start", String(opts.start));
    return `${this.baseUrl}/jobs/search/?${params.toString()}`;
  }
}

export async function withLinkedInSession<T>(
  fn: (session: LinkedInSession) => Promise<T>,
  opts?: { headless?: boolean },
): Promise<T> {
  const session = new LinkedInSession(opts);
  await session.start();
  try {
    return await fn(session);
  } finally {
    await session.close();
  }
}
```

### `apps/api/src/llm/llm.ts`

```typescript
import OpenAI from "openai";
import { getSettings } from "../common/config";

export class LLMError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LLMError";
  }
}

const PROVIDER_DEFAULTS: Record<string, { base_url: string | null; model: string }> = {
  groq: { base_url: "https://api.groq.com/openai/v1", model: "openai/gpt-oss-120b" },
  openai: { base_url: null, model: "gpt-4o-mini" },
  ollama: { base_url: "http://127.0.0.1:11434/v1", model: "llama3.2" },
  gemini: {
    base_url: "https://generativelanguage.googleapis.com/v1beta/openai/",
    model: "gemini-2.5-flash",
  },
};

const RETIRED_MODELS: Record<string, string> = {
  "llama-3.3-70b-versatile": "openai/gpt-oss-120b",
  "llama-3.1-8b-instant": "openai/gpt-oss-20b",
  "gemini-2.0-flash": "gemini-2.5-flash",
  "models/gemini-2.0-flash": "gemini-2.5-flash",
};

/** Free providers only — never auto-failover onto paid OpenAI. */
const FREE_PROVIDER_IDS = ["ollama", "groq", "gemini"] as const;

/** After a rate-limit, skip that provider for this long. */
const COOLDOWN_MS = 12 * 60 * 1000;

export const PROVIDER_CATALOG = [
  {
    id: "groq",
    label: "Groq",
    models: ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.6-27b"],
    default_model: "openai/gpt-oss-120b",
    cost: "Free tier",
    token_score: 85,
    token_note: "High free throughput. Auto-failover switches away when limited.",
    best_for_tokens: true,
  },
  {
    id: "gemini",
    label: "Google Gemini",
    models: ["gemini-2.5-flash", "gemini-3.6-flash", "gemini-2.0-flash"],
    default_model: "gemini-2.5-flash",
    cost: "Free tier",
    token_score: 70,
    token_note: "Free RPM/TPM; used automatically when Groq is limited.",
    best_for_tokens: false,
  },
  {
    id: "ollama",
    label: "Ollama (local)",
    models: ["llama3.2", "llama3.1", "mistral"],
    default_model: "llama3.2",
    cost: "Free / unlimited local",
    token_score: 100,
    token_note: "Unlimited free — install Ollama + pull a model for runs that never hit cloud quotas.",
    best_for_tokens: true,
  },
  {
    id: "openai",
    label: "OpenAI",
    models: ["gpt-4o-mini", "gpt-4o"],
    default_model: "gpt-4o-mini",
    cost: "Paid",
    token_score: 40,
    token_note: "Paid — never used by auto-failover.",
    best_for_tokens: false,
  },
];

type LlmOverride = { provider: string; model?: string | null };

let override: LlmOverride | null = null;
/** Sticky free provider after a successful failover mid-run. */
let stickyFree: LlmOverride | null = null;
const cooldowns = new Map<string, number>();
const failoverLog: string[] = [];

export function setLlmOverride(provider?: string | null, model?: string | null): void {
  stickyFree = null;
  if (!provider) {
    override = null;
    return;
  }
  override = { provider: provider.trim().toLowerCase(), model: model || null };
}

export function clearLlmOverride(): void {
  override = null;
  stickyFree = null;
}

export function getFailoverLog(): string[] {
  return [...failoverLog];
}

export function clearFailoverLog(): void {
  failoverLog.length = 0;
}

function markCooldown(provider: string): void {
  cooldowns.set(provider, Date.now() + COOLDOWN_MS);
}

function isCooling(provider: string): boolean {
  const until = cooldowns.get(provider);
  if (!until) return false;
  if (Date.now() >= until) {
    cooldowns.delete(provider);
    return false;
  }
  return true;
}

function preferredProvider(): string {
  if (override?.provider) return override.provider;
  if (stickyFree?.provider) return stickyFree.provider;
  return (getSettings().llm_provider || "groq").trim().toLowerCase();
}

function providerName(): string {
  return preferredProvider();
}

function defaultModelFor(provider: string): string {
  const settings = getSettings();
  const defaults = PROVIDER_DEFAULTS[provider] || PROVIDER_DEFAULTS.groq;
  const preferred = preferredProvider();

  let model = defaults.model;
  if (preferred === provider) {
    if (override?.model) model = override.model.trim();
    else if (stickyFree?.provider === provider && stickyFree.model) model = stickyFree.model.trim();
    else model = (settings.llm_model || settings.openai_model || defaults.model).trim();
  } else if (stickyFree?.provider === provider && stickyFree.model) {
    model = stickyFree.model.trim();
  }

  return RETIRED_MODELS[model] || model;
}

function resolveCredentials(provider = preferredProvider()): {
  key: string;
  baseUrl: string | null;
  model: string;
  provider: string;
} {
  const settings = getSettings();
  const defaults = PROVIDER_DEFAULTS[provider] || PROVIDER_DEFAULTS.groq;
  const model = defaultModelFor(provider);
  const envProvider = (settings.llm_provider || "groq").trim().toLowerCase();
  const baseUrl =
    provider === envProvider && settings.llm_base_url ? settings.llm_base_url : defaults.base_url;

  if (provider === "groq") {
    const key = (settings.groq_api_key || "").trim();
    if (!key) {
      throw new LLMError(
        "GROQ_API_KEY is missing. Get a free key at https://console.groq.com/keys and add it to .env.",
      );
    }
    return { key, baseUrl, model, provider };
  }
  if (provider === "gemini") {
    const key = (settings.gemini_api_key || "").trim();
    if (!key) {
      throw new LLMError(
        "GEMINI_API_KEY is missing. Get a free key at https://aistudio.google.com/apikey.",
      );
    }
    return { key, baseUrl, model, provider };
  }
  if (provider === "ollama") {
    return { key: "ollama", baseUrl, model, provider };
  }
  const key = (settings.openai_api_key || "").trim();
  if (!key || key === "sk-your-key-here") {
    throw new LLMError("OPENAI_API_KEY is missing. Or switch to Groq in .env.");
  }
  return { key, baseUrl, model, provider };
}

function getClient(provider = preferredProvider()): OpenAI {
  const { key, baseUrl } = resolveCredentials(provider);
  return new OpenAI({ apiKey: key, ...(baseUrl ? { baseURL: baseUrl } : {}) });
}

function getModel(provider = preferredProvider()): string {
  return resolveCredentials(provider).model;
}

async function ollamaReachable(): Promise<boolean> {
  try {
    const res = await fetch("http://127.0.0.1:11434/api/tags", {
      signal: AbortSignal.timeout(600),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function keyConfigured(provider: string): Promise<boolean> {
  const settings = getSettings();
  if (provider === "groq") return Boolean((settings.groq_api_key || "").trim());
  if (provider === "gemini") return Boolean((settings.gemini_api_key || "").trim());
  if (provider === "openai") {
    const key = (settings.openai_api_key || "").trim();
    return Boolean(key) && key !== "sk-your-key-here";
  }
  if (provider === "ollama") return ollamaReachable();
  return false;
}

export async function listLlmProviders() {
  const settings = getSettings();
  const active = (settings.llm_provider || "groq").trim().toLowerCase();
  const providers: Array<(typeof PROVIDER_CATALOG)[number] & {
    configured: boolean;
    available: boolean;
    active_default: boolean;
    recommended_model: string;
    cooling_down: boolean;
  }> = [];
  for (const entry of PROVIDER_CATALOG) {
    const configured = await keyConfigured(entry.id);
    providers.push({
      ...entry,
      configured,
      available: configured && !isCooling(entry.id),
      active_default: entry.id === active,
      recommended_model: entry.default_model,
      cooling_down: isCooling(entry.id),
    });
  }
  providers.sort((a, b) =>
    Number(a.configured) === Number(b.configured)
      ? b.token_score - a.token_score || a.label.localeCompare(b.label)
      : Number(b.configured) - Number(a.configured),
  );
  const ready = providers.filter((p) => p.configured);
  const best = ready.reduce(
    (acc, p) => (!acc || p.token_score > acc.token_score ? p : acc),
    ready[0],
  );
  return {
    active_provider: active,
    active_model: settings.llm_model || PROVIDER_DEFAULTS[active]?.model,
    sticky_provider: stickyFree?.provider ?? null,
    most_tokens: best?.id ?? null,
    most_tokens_label: best ? `${best.label} — ${best.token_note}` : null,
    auto_failover: true,
    providers,
  };
}

function isQuotaError(exc: unknown): boolean {
  const msg = String(exc).toLowerCase();
  return (
    /insufficient_quota|rate_limit|429|resource_exhausted|quota exceeded|too many requests|tpm|rpm/i.test(
      msg,
    )
  );
}

function wrapApiError(exc: unknown, provider = preferredProvider()): LLMError {
  const msg = String(exc);
  if (isQuotaError(exc)) {
    return new LLMError(
      `${provider} free-tier limit hit. Auto-failover will try another free provider (Groq / Gemini / Ollama).`,
    );
  }
  if (msg.includes("404") && provider === "gemini" && msg.includes("2.0-flash")) {
    return new LLMError("gemini-2.0-flash is retired. Pick gemini-2.5-flash in the portal.");
  }
  if (
    msg.includes("404") &&
    provider === "groq" &&
    (msg.includes("llama-3.3") || msg.includes("llama-3.1") || msg.includes("model_not_found"))
  ) {
    return new LLMError(
      "That Groq model is retired. Pick openai/gpt-oss-120b (or gpt-oss-20b) in the portal.",
    );
  }
  return new LLMError(`${provider} API error: ${msg}`);
}

async function freeFailoverChain(start: string): Promise<string[]> {
  const chain: string[] = [];
  const seen = new Set<string>();
  const push = async (id: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    if (id === "openai") return;
    if (!(await keyConfigured(id))) return;
    if (isCooling(id) && id !== start) return;
    chain.push(id);
  };
  await push(start);
  const scored = [...FREE_PROVIDER_IDS].sort((a, b) => {
    const sa = PROVIDER_CATALOG.find((p) => p.id === a)?.token_score ?? 0;
    const sb = PROVIDER_CATALOG.find((p) => p.id === b)?.token_score ?? 0;
    return sb - sa;
  });
  for (const id of scored) await push(id);
  // Allow retrying a cooling start provider last if nothing else works
  if (!chain.includes(start) && (await keyConfigured(start))) chain.push(start);
  return chain;
}

async function withFreeFailover<T>(
  run: (provider: string) => Promise<T>,
): Promise<T> {
  const start = preferredProvider();
  const chain = start === "openai" ? [start] : await freeFailoverChain(start);
  const errors: string[] = [];

  for (const provider of chain) {
    try {
      const result = await run(provider);
      if (provider !== start) {
        stickyFree = { provider, model: PROVIDER_DEFAULTS[provider]?.model || null };
        const note = `LLM auto-failover → ${provider} (free)`;
        if (!failoverLog.includes(note)) failoverLog.push(note);
        console.log(`[llm] ${note}`);
      }
      return result;
    } catch (exc) {
      const wrapped = wrapApiError(exc, provider);
      errors.push(`${provider}: ${wrapped.message}`);
      if (isQuotaError(exc)) {
        markCooldown(provider);
        console.warn(`[llm] ${provider} limited — trying next free provider…`);
        continue;
      }
      // Non-quota: still try next free provider (outages, model 404s)
      if (provider !== chain[chain.length - 1] && FREE_PROVIDER_IDS.includes(provider as (typeof FREE_PROVIDER_IDS)[number])) {
        console.warn(`[llm] ${provider} failed (${wrapped.message}) — trying next free provider…`);
        continue;
      }
      throw wrapped;
    }
  }

  throw new LLMError(
    `All free LLM providers are limited or unavailable.\n` +
      errors.join("\n") +
      `\n\nTo keep running forever for free: install Ollama (https://ollama.com), run \`ollama pull llama3.2\`, then set LLM_PROVIDER=ollama in .env.`,
  );
}

async function createChat(
  provider: string,
  params: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming,
) {
  const client = getClient(provider);
  const model = getModel(provider);
  const kwargs = { ...params, model };
  try {
    return await client.chat.completions.create(kwargs);
  } catch (exc) {
    if (/response_format|json_object/i.test(String(exc)) && kwargs.response_format) {
      delete kwargs.response_format;
      return client.chat.completions.create(kwargs);
    }
    throw exc;
  }
}

export async function chatJson(
  system: string,
  user: string,
  temperature = 0.2,
): Promise<Record<string, unknown>> {
  const systemJson =
    system + "\n\nRespond with a single valid JSON object only. No markdown fences.";
  const messages = [
    { role: "system" as const, content: systemJson },
    { role: "user" as const, content: user },
  ];

  const response = await withFreeFailover(async (provider) => {
    const kwargs: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
      model: getModel(provider),
      temperature,
      messages,
    };
    if (provider !== "ollama") {
      kwargs.response_format = { type: "json_object" };
    }
    return createChat(provider, kwargs);
  });

  let content = (response.choices[0]?.message?.content || "{}").trim();
  if (content.startsWith("```")) {
    content = content.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
  }
  try {
    return JSON.parse(content);
  } catch {
    const m = content.match(/\{[\s\S]*\}/);
    if (!m) throw new LLMError(`Model did not return JSON: ${content.slice(0, 400)}`);
    return JSON.parse(m[0]);
  }
}

export async function chatText(
  system: string,
  user: string,
  temperature = 0.3,
): Promise<string> {
  const response = await withFreeFailover(async (provider) =>
    createChat(provider, {
      model: getModel(provider),
      temperature,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  );
  return (response.choices[0]?.message?.content || "").trim();
}
```

### `apps/api/src/main.ts`

```typescript
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { config as loadDotenv } from "dotenv";
import { join } from "path";
import { AppModule } from "./app.module";
import { PROJECT_ROOT, ensureDataDirs } from "./common/paths";

loadDotenv({ path: join(PROJECT_ROOT, ".env") });
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = `file:${join(PROJECT_ROOT, "data", "app.db")}`;
}

async function bootstrap() {
  ensureDataDirs();
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: ["http://127.0.0.1:3000", "http://localhost:3000"] });
  await app.listen(3001, "127.0.0.1");
  console.log("Nest API listening on http://127.0.0.1:3001");
}

bootstrap();
```

### `apps/api/src/matching/scorer.ts`

```typescript
import { Job } from "@prisma/client";
import { RolesConfig, getRolesConfig } from "../common/config";
import { JobStatus } from "../common/job-status";
import { JobsService } from "../jobs/jobs.service";
import { LLMError, chatJson } from "../llm/llm";

function locationAdjustment(job: Job, roles: RolesConfig): [number, string] {
  const text = `${job.title}\n${job.location}\n${job.description}`.toLowerCase();
  let boost = 0;
  const hits: string[] = [];
  for (const kw of roles.location_prefer_keywords || []) {
    if (text.includes(kw.toLowerCase())) {
      boost += 4;
      hits.push(kw);
    }
  }
  boost = Math.min(boost, 20);
  let penalty = 0;
  const penalties: string[] = [];
  for (const kw of roles.location_avoid_keywords || []) {
    if (text.includes(kw.toLowerCase())) {
      penalty += 8;
      penalties.push(kw);
    }
  }
  penalty = Math.min(penalty, 30);
  const notes: string[] = [];
  if (hits.length) notes.push(`EU/location +${boost} (${hits.slice(0, 4).join(", ")})`);
  if (penalties.length) notes.push(`location −${penalty} (${penalties.slice(0, 3).join(", ")})`);
  return [boost - penalty, notes.join("; ")];
}

export function heuristicScore(job: Job, roles?: RolesConfig): [number, string] {
  const r = roles || getRolesConfig();
  const text = `${job.title}\n${job.location}\n${job.description}`.toLowerCase();
  const titleHits = r.titles.filter((t) => text.includes(t.toLowerCase())).length;
  const skillHits = r.skills.filter((s) => text.includes(s.toLowerCase())).length;
  let score = Math.min(100, 35 + titleHits * 12 + skillHits * 6);
  if (text.includes("remote") && r.remote_ok) score = Math.min(100, score + 5);
  const [locDelta, locNote] = locationAdjustment(job, r);
  score = Math.max(0, Math.min(100, score + locDelta));
  const rationale = `Heuristic: ${titleHits} title hit(s), ${skillHits} skill hit(s).${locNote ? ` ${locNote}` : ""}`;
  return [score, rationale];
}

function relocationNote(roles: RolesConfig): string {
  if (roles.relocation_target.toLowerCase() === "europe") {
    return (
      "Candidate goal: relocate to Europe and work for European employers. " +
      "Strongly favor jobs in EU/UK/EMEA, visa sponsorship, or relocation support. " +
      "Penalize US-only, India-only, or explicit 'no sponsorship' requirements. " +
      "Remote jobs open to candidates outside the EU are still good if EMEA-friendly."
    );
  }
  return `Preferred location: ${roles.location} (remote_ok=${roles.remote_ok})`;
}

export async function scoreJob(
  job: Job,
  roles?: RolesConfig,
  useLlm = true,
): Promise<[number, string]> {
  const r = roles || getRolesConfig();
  const [base, baseReason] = heuristicScore(job, r);
  if (!useLlm) return [base, baseReason];
  const system =
    "You are a hiring match assistant for a frontend / UI-UX developer. " +
    "Score how well the candidate profile fits the job. " +
    "Return JSON with keys: score (0-100 integer), rationale (short string). " +
    "Be strict: penalize backend-heavy, mobile-native-only, or unrelated roles.";
  const user =
    `Target titles: ${r.titles.join(", ")}\n` +
    `Target skills: ${r.skills.join(", ")}\n` +
    `${relocationNote(r)}\n\n` +
    `Job title: ${job.title}\nCompany: ${job.company}\nLocation: ${job.location}\n` +
    `Description:\n${(job.description || "").slice(0, 6000)}\n`;
  try {
    const data = await chatJson(system, user);
    let score = Number(data.score ?? base);
    score = Math.max(0, Math.min(100, score));
    const rationale = String(data.rationale || baseReason).trim();
    const blended = Math.round(0.75 * score + 0.25 * base);
    return [blended, rationale];
  } catch (exc) {
    if (exc instanceof LLMError) {
      console.log(`  LLM unavailable for scoring (${exc.message}); using heuristic.`);
      return [base, `${baseReason} (LLM fallback)`];
    }
    throw exc;
  }
}

export async function scorePendingJobs(
  jobs: JobsService,
  opts: { useLlm?: boolean; limit?: number; roles?: RolesConfig } = {},
): Promise<Job[]> {
  const roles = opts.roles || getRolesConfig();
  const pending = await jobs.listForScoring(opts.limit ?? 50);
  const scored: Job[] = [];
  let llmOk = opts.useLlm ?? true;
  for (const job of pending) {
    const [score, rationale] = await scoreJob(job, roles, llmOk);
    if (llmOk && rationale.includes("LLM fallback")) llmOk = false;
    await jobs.updateScore(job.id, score, rationale, JobStatus.SCORED);
    const updated = await jobs.get(job.id);
    if (updated) scored.push(updated);
    console.log(`Scored [${score}] ${job.title} @ ${job.company}`);
  }
  return scored;
}
```

### `apps/api/src/pipeline/pipeline.controller.ts`

```typescript
import { Body, Controller, Get, HttpException, HttpStatus, Post } from "@nestjs/common";
import { PipelineRunner } from "./runner";
import { parseSearchOptions } from "./search-options";
import { listLlmProviders } from "../llm/llm";

@Controller("api")
export class PipelineController {
  constructor(private readonly runner: PipelineRunner) {}

  @Get("llm/providers")
  providers() {
    return listLlmProviders();
  }

  @Get("run/status")
  status() {
    return this.runner.getState();
  }

  @Post("run")
  start(@Body() body: Record<string, unknown>) {
    const options = parseSearchOptions(body);
    console.log(`Portal run filters: ${JSON.stringify(options)}`);
    const result = this.runner.start(options, true);
    if (!result.ok && result.reason === "already_running") {
      throw new HttpException(
        { detail: "A run is already in progress", state: result.state },
        HttpStatus.CONFLICT,
      );
    }
    return result;
  }
}
```

### `apps/api/src/pipeline/pipeline.module.ts`

```typescript
import { Module } from "@nestjs/common";
import { JobsModule } from "../jobs/jobs.module";
import { PipelineController } from "./pipeline.controller";
import { PipelineRunner } from "./runner";

@Module({
  imports: [JobsModule],
  controllers: [PipelineController],
  providers: [PipelineRunner],
  exports: [PipelineRunner],
})
export class PipelineModule {}
```

### `apps/api/src/pipeline/pipeline.ts`

```typescript
import { getPreferences, getRolesConfig } from "../common/config";
import { JobStatus } from "../common/job-status";
import { JobsService } from "../jobs/jobs.service";
import { enrichMissingDescriptions } from "../linkedin/job-detail";
import { searchJobs } from "../linkedin/search";
import { withLinkedInSession } from "../linkedin/session";
import { scorePendingJobs } from "../matching/scorer";
import { tailorPendingJobs } from "../resume/tailor";
import { SearchOptions, defaultSearchOptions, summarizeOptions } from "./search-options";

export type ProgressFn = (step: string, message: string) => void;

async function queueSummary(jobs: JobsService, threshold: number): Promise<void> {
  const nNew = await jobs.count({ status: JobStatus.NEW });
  const nScored = await jobs.count({ status: JobStatus.SCORED });
  const nReady = await jobs.count({ status: JobStatus.READY });
  const scoredRows = await jobs.list({ status: JobStatus.SCORED }, "newest", 500, 0);
  const above = scoredRows.filter((j) => (j.matchScore || 0) >= threshold).length;
  console.log(`Queue → new=${nNew}, scored=${nScored} (≥${threshold}: ${above}), ready=${nReady}`);
}

export async function runPipeline(
  jobs: JobsService,
  opts: {
    dryRun?: boolean;
    skipSearch?: boolean;
    skipTailor?: boolean;
    useLlm?: boolean;
    fetchDetails?: boolean;
    minScore?: number;
    searchOptions?: SearchOptions;
    onProgress?: ProgressFn;
  } = {},
): Promise<void> {
  const roles = getRolesConfig();
  const threshold = opts.minScore ?? roles.min_match_score;
  let options = opts.searchOptions || defaultSearchOptions({ posted_within_hours: roles.posted_within_hours });
  if (opts.dryRun) options = { ...options, dry_run: true };
  if (opts.skipSearch) options = { ...options, skip_search: true };
  const fetchDetails = opts.fetchDetails ?? true;
  const useLlm = opts.useLlm ?? true;
  const progress = (key: string, message: string) => opts.onProgress?.(key, message);

  let step = 0;
  const total = 3;
  step += 1;
  if (options.skip_search) {
    console.log(`\n=== Step ${step}/${total}: Search (skipped — using existing jobs) ===`);
    progress("search", "Search skipped — using existing jobs");
  } else {
    console.log(`\n=== Step ${step}/${total}: Search LinkedIn (fresh matching jobs) ===`);
    progress("search", `Searching LinkedIn… (${summarizeOptions(options)})`);
    const found = await withLinkedInSession(async (session) => {
      await session.ensureLoggedIn();
      return searchJobs(session, jobs, { options, fetchDetails, dryRun: false });
    });
    console.log(`Search done: ${found.length} job(s) discovered.`);
    progress("search", `Search done: ${found.length} job(s) discovered`);
  }

  const prefs = getPreferences();
  const needing = await jobs.listNeedingDescription(80);
  if (fetchDetails && needing.length) {
    console.log(`\n=== Step ${step}/${total}: Fetch missing job descriptions ===`);
    progress("enrich", `Fetching ${needing.length} missing job description(s)…`);
    const filled = await withLinkedInSession(async (session) => {
      await session.ensureLoggedIn();
      return enrichMissingDescriptions(session, jobs, {
        limit: 80,
        delayMin: prefs.detail_delay_seconds_min,
        delayMax: prefs.detail_delay_seconds_max,
      });
    });
    console.log(`Filled ${filled} description(s).`);
    progress("enrich", `Filled ${filled} description(s)`);
  }

  step += 1;
  console.log(`\n=== Step ${step}/${total}: Score jobs ===`);
  progress("score", "Scoring jobs…");
  const scored = await scorePendingJobs(jobs, { useLlm, limit: 80 });
  console.log(`Scored ${scored.length} job(s). Threshold for tailor: ${threshold}`);
  progress("score", `Scored ${scored.length} job(s)`);
  await queueSummary(jobs, threshold);

  if (opts.dryRun || options.dry_run) {
    console.log("\nDry-run complete (stopped before tailor).");
    progress("done", "Dry-run complete (stopped before tailor)");
    return;
  }

  step += 1;
  if (opts.skipTailor) {
    console.log(`\n=== Step ${step}/${total}: Tailor resumes (skipped) ===`);
    progress("tailor", "Tailor skipped");
  } else {
    console.log(`\n=== Step ${step}/${total}: Tailor resumes + PDFs ===`);
    progress("tailor", "Tailoring European CVs + PDFs…");
    const tailored = await tailorPendingJobs(jobs, { minScore: threshold, limit: 80 });
    console.log(`Tailored ${tailored.length} job(s).`);
    progress("tailor", `Tailored ${tailored.length} job(s)`);
    if (!tailored.length) {
      console.log(
        `Nothing to tailor — need scored jobs with match_score ≥ ${threshold}.`,
      );
    }
    await queueSummary(jobs, threshold);
  }
  console.log("\nDone. Open http://127.0.0.1:3000 to review PDFs, then apply on LinkedIn.");
  progress("done", "Pipeline complete");
}
```

### `apps/api/src/pipeline/runner.ts`

```typescript
import { Injectable } from "@nestjs/common";
import { JobsService } from "../jobs/jobs.service";
import { JobStatus } from "../common/job-status";
import { getRolesConfig, reloadConfigs } from "../common/config";
import { clearFailoverLog, clearLlmOverride, getFailoverLog, setLlmOverride } from "../llm/llm";
import { runPipeline } from "./pipeline";
import { SearchOptions, defaultSearchOptions, summarizeOptions } from "./search-options";

export type RunState = {
  status: "idle" | "running" | "success" | "error";
  message: string;
  step: string;
  started_at: string | null;
  finished_at: string | null;
  error: string | null;
  stats: Record<string, unknown>;
  log: string[];
  filters: Record<string, unknown>;
};

function emptyState(): RunState {
  return {
    status: "idle",
    message: "",
    step: "",
    started_at: null,
    finished_at: null,
    error: null,
    stats: {},
    log: [],
    filters: {},
  };
}

@Injectable()
export class PipelineRunner {
  private state: RunState = emptyState();
  private running = false;

  constructor(private readonly jobs: JobsService) {}

  getState(): RunState {
    return { ...this.state, log: this.state.log.slice(-40) };
  }

  private appendLog(line: string) {
    this.state.log.push(line);
    if (this.state.log.length > 200) this.state.log = this.state.log.slice(-200);
  }

  start(options?: SearchOptions, useLlm = true) {
    const opts = options || defaultSearchOptions();
    if (this.running || this.state.status === "running") {
      return { ok: false, reason: "already_running", state: this.getState() };
    }
    const now = new Date().toISOString();
    this.running = true;
    this.state = {
      status: "running",
      message: `Pipeline started (${summarizeOptions(opts)})`,
      step: "starting",
      started_at: now,
      finished_at: null,
      error: null,
      stats: {},
      filters: { ...opts },
      log: [`[${now}] Run requested from portal`, `Filters: ${summarizeOptions(opts)}`],
    };
    void this.worker(opts, useLlm);
    return { ok: true, state: this.getState() };
  }

  private async worker(options: SearchOptions, useLlm: boolean) {
    try {
      clearFailoverLog();
      if (options.llm_provider) {
        setLlmOverride(options.llm_provider, options.llm_model);
        this.appendLog(`LLM: ${options.llm_provider} / ${options.llm_model || "default"} (free auto-failover on)`);
      } else {
        this.appendLog("LLM: auto free-provider failover enabled (Groq → Gemini → Ollama)");
      }
      reloadConfigs();
      const beforeTotal = await this.jobs.count();
      const beforeNew = await this.jobs.count({ status: JobStatus.NEW });
      const beforeReady = await this.jobs.count({ status: JobStatus.READY });
      this.state.step = "search";
      this.state.message = `Searching LinkedIn… (${summarizeOptions(options)})`;
      this.appendLog("Step 1/3: search");

      await runPipeline(this.jobs, {
        dryRun: options.dry_run,
        skipSearch: options.skip_search,
        skipTailor: false,
        useLlm,
        searchOptions: options,
        onProgress: (step, message) => {
          this.state.step = step;
          this.state.message = message;
          this.appendLog(message);
        },
      });

      const afterTotal = await this.jobs.count();
      const afterNew = await this.jobs.count({ status: JobStatus.NEW });
      const afterReady = await this.jobs.count({ status: JobStatus.READY });
      const afterScored = await this.jobs.count({ status: JobStatus.SCORED });
      const discovered = Math.max(0, afterTotal - beforeTotal);
      const roles = getRolesConfig();
      const stats = {
        before_total: beforeTotal,
        after_total: afterTotal,
        discovered,
        ready: afterReady,
        new: afterNew,
        scored: afterScored,
        ready_delta: afterReady - beforeReady,
        new_delta: afterNew - beforeNew,
        min_match_score: roles.min_match_score,
        filters: { ...options },
      };
      const msg = `Done. Discovered ${discovered} new listing(s). Queue: ${afterTotal} total · ${afterReady} ready · ${afterScored} scored.`;
      for (const line of getFailoverLog()) this.appendLog(line);
      this.appendLog(msg);
      this.state = {
        ...this.state,
        status: "success",
        message: msg,
        step: "done",
        finished_at: new Date().toISOString(),
        error: null,
        stats,
      };
    } catch (exc) {
      const err = `${exc instanceof Error ? exc.constructor.name : "Error"}: ${exc instanceof Error ? exc.message : exc}`;
      this.appendLog(err);
      if (exc instanceof Error && exc.stack) this.appendLog(exc.stack.slice(-1500));
      this.state.status = "error";
      this.state.message = "Pipeline failed. Check the log and LinkedIn login.";
      this.state.step = "error";
      this.state.finished_at = new Date().toISOString();
      this.state.error = err;
    } finally {
      this.running = false;
      clearLlmOverride();
    }
  }
}
```

### `apps/api/src/pipeline/search-options.ts`

```typescript
export type SearchOptions = {
  easy_apply: boolean;
  discover_external: boolean;
  posted_within_hours: number;
  sort_by: "DD" | "R";
  under_10_applicants: boolean;
  workplace: "remote_only" | "include_remote" | "any";
  skip_search: boolean;
  dry_run: boolean;
  llm_provider?: string | null;
  llm_model?: string | null;
};

function asBool(value: unknown, fallback: boolean): boolean {
  if (value == null) return fallback;
  if (typeof value === "boolean") return value;
  const text = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(text)) return true;
  if (["0", "false", "no", "off", ""].includes(text)) return false;
  return fallback;
}

export function defaultSearchOptions(
  extra: Partial<SearchOptions> = {},
): SearchOptions {
  return {
    easy_apply: true,
    discover_external: false,
    posted_within_hours: 24,
    sort_by: "DD",
    under_10_applicants: false,
    workplace: "include_remote",
    skip_search: false,
    dry_run: false,
    llm_provider: null,
    llm_model: null,
    ...extra,
  };
}

export function parseSearchOptions(data?: Record<string, unknown> | null): SearchOptions {
  if (!data) return defaultSearchOptions();
  let hours = Number(data.posted_within_hours ?? 24);
  if (!Number.isFinite(hours)) hours = 24;
  let sortBy = String(data.sort_by || "DD").toUpperCase();
  if (sortBy !== "DD" && sortBy !== "R") sortBy = "DD";
  let workplace = String(data.workplace || "include_remote");
  if (!["remote_only", "include_remote", "any"].includes(workplace)) {
    workplace = "include_remote";
  }
  let provider = data.llm_provider ? String(data.llm_provider).trim().toLowerCase() : null;
  if (provider && !["groq", "gemini", "ollama", "openai"].includes(provider)) {
    provider = null;
  }
  let model = data.llm_model ? String(data.llm_model).trim() : null;
  if (!model) model = null;
  return defaultSearchOptions({
    easy_apply: asBool(data.easy_apply, true),
    discover_external: asBool(data.discover_external, false),
    posted_within_hours: Math.max(1, Math.min(720, hours)),
    sort_by: sortBy as "DD" | "R",
    under_10_applicants: asBool(data.under_10_applicants, false),
    workplace: workplace as SearchOptions["workplace"],
    skip_search: asBool(data.skip_search, false),
    dry_run: asBool(data.dry_run, false),
    llm_provider: provider,
    llm_model: model,
  });
}

export function summarizeOptions(options: SearchOptions): string {
  const bits = [
    `past ${options.posted_within_hours}h`,
    options.easy_apply ? "Easy Apply only" : "all apply types",
    options.sort_by === "DD" ? "sort=date" : "sort=relevance",
  ];
  if (options.under_10_applicants) bits.push("<10 applicants");
  if (options.workplace === "remote_only") bits.push("remote only");
  else if (options.workplace === "include_remote") bits.push("on-site + remote pass");
  if (options.discover_external && options.easy_apply) bits.push("+ external listings");
  if (options.llm_provider) {
    bits.push(`llm=${options.llm_provider}/${options.llm_model || "default"}`);
  }
  return bits.join(", ");
}
```

### `apps/api/src/prisma/prisma.module.ts`

```typescript
import { Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service";

@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

### `apps/api/src/prisma/prisma.service.ts`

```typescript
import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { DB_PATH, ensureDataDirs } from "../common/paths";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    ensureDataDirs();
    const url = process.env.DATABASE_URL || `file:${DB_PATH}`;
    super({ datasources: { db: { url } } });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
```

### `apps/api/src/resume/pdf.ts`

```typescript
import { readFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import Handlebars from "handlebars";
import { chromium } from "playwright";
import { contactItems, contactLine, ResumeData } from "./schema";

const TEMPLATES_DIR = join(__dirname, "templates");

function compile(name: string) {
  const src = readFileSync(join(TEMPLATES_DIR, name), "utf8");
  return Handlebars.compile(src);
}

export function resumeToHtml(resume: ResumeData, template = "european"): string {
  const file = template === "european" ? "european.hbs" : "classic.hbs";
  const tpl = compile(file);
  return tpl({
    ...resume,
    contactItems: contactItems(resume),
    contactLine: contactLine(resume),
  });
}

async function htmlToPdf(
  html: string,
  outputPath: string,
  pageFormat: "A4" | "Letter",
): Promise<string> {
  mkdirSync(dirname(outputPath), { recursive: true });
  const margins =
    pageFormat === "A4"
      ? { top: "16mm", bottom: "14mm", left: "16mm", right: "16mm" }
      : { top: "0.5in", bottom: "0.5in", left: "0.55in", right: "0.55in" };
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    await page.pdf({
      path: outputPath,
      format: pageFormat,
      margin: margins,
      printBackground: true,
    });
  } finally {
    await browser.close();
  }
  return outputPath;
}

export async function resumeToPdf(
  resume: ResumeData,
  outputPath: string,
  opts: { template?: string; pageFormat?: string | null } = {},
): Promise<string> {
  const template = opts.template || "european";
  const fmt = (opts.pageFormat || (template === "european" ? "A4" : "Letter")).toUpperCase() as
    | "A4"
    | "Letter";
  return htmlToPdf(resumeToHtml(resume, template), outputPath, fmt);
}
```

### `apps/api/src/resume/schema.ts`

```typescript
export type EducationEntry = {
  school: string;
  location?: string;
  degree?: string;
  dates?: string;
  details?: string[];
};

export type ExperienceEntry = {
  company: string;
  location?: string;
  title?: string;
  dates?: string;
  bullets?: string[];
};

export type ProjectEntry = {
  name: string;
  location?: string;
  title?: string;
  dates?: string;
  bullets?: string[];
};

export type SkillGroup = { label: string; items?: string };

export type ResumeData = {
  name: string;
  headline?: string;
  profile?: string;
  email?: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  github?: string;
  portfolio?: string;
  education?: EducationEntry[];
  experience?: ExperienceEntry[];
  projects?: ProjectEntry[];
  skill_groups?: SkillGroup[];
  skills?: string;
  languages?: string;
  interests?: string;
};

export function contactItems(resume: ResumeData): { label: string; value: string }[] {
  const items: { label: string; value: string }[] = [];
  if (resume.location) items.push({ label: "Location", value: resume.location });
  if (resume.email) items.push({ label: "Email", value: resume.email });
  if (resume.phone) items.push({ label: "Phone", value: resume.phone });
  if (resume.linkedin) items.push({ label: "LinkedIn", value: resume.linkedin });
  if (resume.github) items.push({ label: "GitHub", value: resume.github });
  if (resume.portfolio) items.push({ label: "Portfolio", value: resume.portfolio });
  return items;
}

export function contactLine(resume: ResumeData): string {
  return [resume.location, resume.linkedin, resume.phone, resume.email, resume.github, resume.portfolio]
    .filter(Boolean)
    .join(" | ");
}

export function resumeToMarkdown(resume: ResumeData): string {
  const lines = [`# ${resume.name}`, "", `**${resume.headline || ""}**`, contactLine(resume), ""];
  if (resume.profile) lines.push("## PROFILE", "", resume.profile, "");
  if (resume.skill_groups?.length) {
    lines.push("## TECHNICAL SKILLS", "");
    for (const g of resume.skill_groups) lines.push(`**${g.label}:** ${g.items || ""}`);
    lines.push("");
  } else if (resume.skills) {
    lines.push("## TECHNICAL SKILLS", "", resume.skills, "");
  }
  lines.push("## PROFESSIONAL EXPERIENCE", "");
  for (const exp of resume.experience || []) {
    lines.push(`**${exp.company}** — ${exp.location || ""}`);
    lines.push(`*${exp.title || ""}* · ${exp.dates || ""}`);
    for (const b of exp.bullets || []) lines.push(`- ${b}`);
    lines.push("");
  }
  if (resume.projects?.length) {
    lines.push("## KEY PROJECTS", "");
    for (const proj of resume.projects) {
      lines.push(`**${proj.name}** — ${proj.location || ""}`);
      const titleDates = [proj.title, proj.dates].filter(Boolean).join(" · ");
      if (titleDates) lines.push(`*${titleDates}*`);
      for (const b of proj.bullets || []) lines.push(`- ${b}`);
      lines.push("");
    }
  }
  lines.push("## EDUCATION", "");
  for (const edu of resume.education || []) {
    lines.push(`**${edu.school}** — ${edu.location || ""}`);
    lines.push(`*${edu.degree || ""}* · ${edu.dates || ""}`.replace(/^ ·|· $/, ""));
    for (const d of edu.details || []) lines.push(`- ${d}`);
    lines.push("");
  }
  if (resume.languages || resume.interests) {
    lines.push("## LANGUAGES & INTERESTS", "");
    if (resume.languages) lines.push(`**Languages:** ${resume.languages}`);
    if (resume.interests) lines.push(`**Interests:** ${resume.interests}`);
    lines.push("");
  }
  return lines.join("\n");
}

export function normalizeResume(data: Partial<ResumeData> & { name?: string }): ResumeData {
  return {
    name: data.name || "",
    headline: data.headline || "",
    profile: data.profile || "",
    email: data.email || "",
    phone: data.phone || "",
    location: data.location || "",
    linkedin: data.linkedin || "",
    github: data.github || "",
    portfolio: data.portfolio || "",
    education: data.education || [],
    experience: data.experience || [],
    projects: data.projects || [],
    skill_groups: data.skill_groups || [],
    skills: data.skills || "",
    languages: data.languages || "",
    interests: data.interests || "",
  };
}
```

### `apps/api/src/resume/tailor.ts`

```typescript
import { readFileSync, existsSync, writeFileSync } from "fs";
import { join } from "path";
import * as yaml from "js-yaml";
import { Job } from "@prisma/client";
import { getPreferences, getRolesConfig } from "../common/config";
import { JobStatus } from "../common/job-status";
import { MASTER_RESUME_YAML, OUTPUTS_DIR, PROJECT_ROOT, ensureDataDirs } from "../common/paths";
import { JobsService } from "../jobs/jobs.service";
import { LLMError, chatJson, chatText } from "../llm/llm";
import { resumeToPdf } from "./pdf";
import { ResumeData, normalizeResume, resumeToMarkdown } from "./schema";

function slug(text: string): string {
  const s = text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
  return s || "job";
}

export function loadMasterResumeData(): ResumeData {
  const prefs = getPreferences();
  let path = join(PROJECT_ROOT, prefs.master_resume_path);
  if (!existsSync(path)) path = MASTER_RESUME_YAML;
  if (!existsSync(path)) {
    throw new Error("Master resume not found. Edit data/master_resume.yaml");
  }
  const data = yaml.load(readFileSync(path, "utf8")) as ResumeData;
  return normalizeResume(data);
}

function fallbackProfile(master: ResumeData, job: Job): string {
  const base =
    master.profile ||
    "Frontend engineer with experience building scalable web applications using React, Vue, and Nuxt.js.";
  if (job.company) {
    return `${base} Seeking to contribute to ${job.company} as ${job.title || "a frontend engineer"}.`;
  }
  return base;
}

function buildTailorSystemPrompt(europeNote: string): string {
  return (
    "You are an expert ATS resume writer and European CV coach for frontend / UI / full-stack roles. " +
    "Produce a highly tailored CV for THIS job that maximises ATS keyword match and HR appeal. " +
    "Return JSON matching this schema exactly: " +
    '{"name","headline","profile","email","phone","location","linkedin","github","portfolio",' +
    '"education":[{"school","location","degree","dates","details":[]}],' +
    '"experience":[{"company","location","title","dates","bullets":[]}],' +
    '"projects":[{"name","location","title","dates","bullets":[]}],' +
    '"skill_groups":[{"label","items"}],' +
    '"skills","languages","interests"}. ' +
    "Goals (do all of these):\n" +
    "1) ATS: Mirror exact keywords, stack names, and role phrases from the JD in headline, profile, skill_groups, and bullets when they are honestly supported by the master CV.\n" +
    "2) Projects: Select, rename, reorder, split, or merge projects for this JD. You MAY create additional project entries that are focused slices of REAL master work " +
    "(e.g. 'RBAC & Mentions Module — Aqueous Digital CRM' derived from Aqueous Digital). Prefer 2–4 projects most relevant to the JD; drop weak ones.\n" +
    "3) Experience: Keep real employers/dates, but rewrite titles slightly if needed for clarity (e.g. emphasise Frontend/UI), rewrite every bullet with JD language, " +
    "lead with impact + tech, and put the most relevant bullets first. Drop weak bullets.\n" +
    "4) Profile & headline: Rewrite completely for this company/role/sector. Sound senior, concise, and confident without US hype words.\n" +
    "5) Skills: Rebuild skill_groups so JD-required skills appear first; only include skills present in the master CV (or clear synonyms of those skills).\n" +
    "6) HR appeal: Strong action verbs, quantified results when present in master, scannable bullets, no fluff, British/European English.\n" +
    "Hard limits (integrity):\n" +
    "- Do NOT invent employers, employment dates, degrees, certifications, languages, or tools the candidate has never used.\n" +
    "- Do NOT invent fake companies or entirely fictional products. New project entries must map to real master experience/projects.\n" +
    "- Do NOT claim EU work authorisation unless stated in master.\n" +
    "- Keep email, phone, linkedin, github, portfolio identical to master.\n" +
    "- One A4 page: 3–4 bullets per recent role, 2–3 bullets per project.\n" +
    europeNote
  );
}

export async function tailorResumeData(master: ResumeData, job: Job): Promise<ResumeData> {
  const roles = getRolesConfig();
  let europeNote = "";
  if (roles.relocation_target.toLowerCase() === "europe") {
    europeNote =
      " Target market: Europe. Use European CV conventions: A4-friendly one page, " +
      "factual tone (avoid US hype words like 'Spearheaded'), no first person in bullets, " +
      "dates as MM/YYYY – Present, separate Languages section. " +
      "Highlight international/EU/UK delivery (Toolstation, Cycling4All, Aqueous Digital, Access Support) when relevant.";
  }
  const system = buildTailorSystemPrompt(europeNote);
  const user =
    `Candidate target titles (preferences): ${roles.titles.join(", ")}\n` +
    `Candidate target skills (preferences): ${roles.skills.join(", ")}\n\n` +
    `TARGET JOB (tailor aggressively for this):\n` +
    `Company: ${job.company}\nTitle: ${job.title}\nLocation: ${job.location}\n` +
    `Job description:\n${(job.description || "").slice(0, 7000)}\n\n` +
    `Master CV JSON (source of truth — only use real facts from here):\n${JSON.stringify(master, null, 2)}\n\n` +
    `Instructions: Extract the top ATS keywords from the JD, then rewrite the CV so those keywords appear naturally. ` +
    `Reshape the projects section for maximum fit. Return only the tailored CV JSON.`;
  let tailored: ResumeData;
  try {
    const data = await chatJson(system, user, 0.45);
    tailored = normalizeResume(data as ResumeData);
  } catch (exc) {
    throw new LLMError(`tailoring failed: ${exc instanceof Error ? exc.message : exc}`);
  }
  tailored.name = master.name;
  tailored.email = master.email;
  tailored.phone = master.phone;
  tailored.location = master.location;
  tailored.linkedin = master.linkedin;
  tailored.github = master.github;
  tailored.portfolio = master.portfolio;
  if (!tailored.languages && master.languages) tailored.languages = master.languages;
  if (!tailored.skill_groups?.length && master.skill_groups) tailored.skill_groups = master.skill_groups;
  if (!tailored.education?.length) tailored.education = master.education;
  if (!tailored.experience?.length) tailored.experience = master.experience;
  if (!tailored.profile) tailored.profile = fallbackProfile(master, job);
  return tailored;
}

export async function generateCoverLetter(master: ResumeData, job: Job): Promise<string> {
  const roles = getRolesConfig();
  let relocation = "";
  if (roles.relocation_target.toLowerCase() === "europe") {
    relocation =
      " Mention genuine openness to relocate to Europe and relevant international " +
      "project experience; do not claim work authorization not in the resume.";
  }
  const system =
    "Write a short European-style cover letter (180–260 words) in plain text. " +
    "Use British/European English. Be professional and factual, not overly salesy. " +
    "Use only facts from the master CV. Do not invent experience. " +
    "Address the company and role directly." +
    relocation;
  const user =
    `Job title: ${job.title}\nCompany: ${job.company}\n` +
    `Description:\n${(job.description || "").slice(0, 5000)}\n\n` +
    `Master resume:\n${resumeToMarkdown(master).slice(0, 5000)}\n`;
  return chatText(system, user, 0.4);
}

export async function tailorJob(
  jobs: JobsService,
  job: Job,
  master?: ResumeData,
): Promise<Job> {
  ensureDataDirs();
  const prefs = getPreferences();
  const masterData = master || loadMasterResumeData();
  const tailored = await tailorResumeData(masterData, job);
  const stamp = new Date().toISOString().slice(0, 10);
  const base = `${slug(job.company)}_${slug(job.title)}_${stamp}_${job.id}`;
  const mdPath = join(OUTPUTS_DIR, `${base}.md`);
  const jsonPath = join(OUTPUTS_DIR, `${base}.json`);
  const pdfPath = join(OUTPUTS_DIR, `${base}.pdf`);
  writeFileSync(mdPath, resumeToMarkdown(tailored), "utf8");
  writeFileSync(jsonPath, JSON.stringify(tailored, null, 2), "utf8");
  await resumeToPdf(tailored, pdfPath, {
    template: prefs.resume_template || "european",
    pageFormat: prefs.resume_page_format,
  });
  let coverPath: string | null = null;
  if (prefs.generate_cover_letter) {
    try {
      const cover = await generateCoverLetter(masterData, job);
      coverPath = join(OUTPUTS_DIR, `${base}_cover.txt`);
      writeFileSync(coverPath, cover, "utf8");
    } catch (exc) {
      console.log(`  Skipping cover letter (${exc instanceof Error ? exc.message : exc})`);
    }
  }
  await jobs.updateTailoredPaths(job.id, mdPath, pdfPath, coverPath, JobStatus.READY);
  const updated = await jobs.get(job.id);
  if (!updated) throw new Error("Job missing after tailor");
  console.log(`Tailored resume ready: ${base}.pdf`);
  return updated;
}

export async function tailorPendingJobs(
  jobs: JobsService,
  opts: { minScore?: number; limit?: number } = {},
): Promise<Job[]> {
  const roles = getRolesConfig();
  const threshold = opts.minScore ?? roles.min_match_score;
  const master = loadMasterResumeData();
  const pending = await jobs.listForTailoring(threshold, opts.limit ?? 20);
  const results: Job[] = [];
  for (const job of pending) {
    try {
      results.push(await tailorJob(jobs, job, master));
    } catch (exc) {
      console.log(`Failed to tailor job ${job.id}: ${exc instanceof Error ? exc.message : exc}`);
    }
  }
  return results;
}
```

### `apps/api/src/resume/templates/classic.hbs`

```handlebars
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <style>
    @page { size: Letter; margin: 0.55in; }
    * { box-sizing: border-box; }
    body {
      font-family: "Times New Roman", Times, Georgia, serif;
      font-size: 11pt;
      line-height: 1.28;
      color: #000;
      margin: 0;
    }
    header {
      text-align: center;
      margin-bottom: 10pt;
    }
    h1 {
      font-size: 18pt;
      font-weight: 700;
      margin: 0 0 4pt 0;
    }
    .contact {
      font-size: 10.5pt;
      margin: 0;
    }
    .section {
      margin-top: 10pt;
    }
    .section h2 {
      font-size: 11.5pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.02em;
      margin: 0 0 6pt 0;
      padding-bottom: 2pt;
      border-bottom: 1px solid #000;
    }
    .entry { margin-bottom: 8pt; }
    .row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 12pt;
    }
    .left { font-weight: 700; }
    .right { font-weight: 700; white-space: nowrap; }
    .row.sub .left,
    .row.sub .right {
      font-weight: 400;
      font-style: italic;
    }
    ul {
      margin: 3pt 0 0 0;
      padding-left: 16pt;
    }
    li { margin: 0 0 2pt 0; }
    .skills p {
      margin: 0 0 4pt 0;
    }
    .skills strong { font-weight: 700; }
  </style>
</head>
<body>
  <header>
    <h1>{{name}}</h1>
    {{#if headline}}<p class="contact">{{headline}}</p>{{/if}}
    <p class="contact">{{contactLine}}</p>
  </header>

  <section class="section">
    <h2>Education</h2>
    {{#each education}}
    <div class="entry">
      <div class="row">
        <span class="left">{{school}}</span>
        <span class="right">{{location}}</span>
      </div>
      <div class="row sub">
        <span class="left">{{degree}}</span>
        <span class="right">{{dates}}</span>
      </div>
      {{#if details}}
      <ul>
        {{#each details}}<li>{{this}}</li>{{/each}}
      </ul>
      {{/if}}
    </div>
    {{/each}}
  </section>

  <section class="section">
    <h2>Work Experience</h2>
    {{#each experience}}
    <div class="entry">
      <div class="row">
        <span class="left">{{company}}</span>
        <span class="right">{{location}}</span>
      </div>
      <div class="row sub">
        <span class="left">{{title}}</span>
        <span class="right">{{dates}}</span>
      </div>
      {{#if bullets}}
      <ul>
        {{#each bullets}}<li>{{this}}</li>{{/each}}
      </ul>
      {{/if}}
    </div>
    {{/each}}
  </section>

  {{#if projects}}
  <section class="section">
    <h2>Projects</h2>
    {{#each projects}}
    <div class="entry">
      <div class="row">
        <span class="left">{{name}}</span>
        <span class="right">{{location}}</span>
      </div>
      <div class="row sub">
        <span class="left">{{title}}</span>
        <span class="right">{{dates}}</span>
      </div>
      {{#if bullets}}
      <ul>
        {{#each bullets}}<li>{{this}}</li>{{/each}}
      </ul>
      {{/if}}
    </div>
    {{/each}}
  </section>
  {{/if}}

  <section class="section skills">
    <h2>Skills &amp; Interests</h2>
    <p><strong>Skills:</strong> {{skills}}</p>
    {{#if interests}}
    <p><strong>Interests:</strong> {{interests}}</p>
    {{/if}}
  </section>
</body>
</html>
```

### `apps/api/src/resume/templates/european.hbs`

```handlebars
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <style>
    @page {
      size: A4;
      margin: 18mm 16mm 16mm 16mm;
    }
    * { box-sizing: border-box; }
    body {
      font-family: "Segoe UI", Calibri, Helvetica, Arial, sans-serif;
      font-size: 10pt;
      line-height: 1.38;
      color: #1f2937;
      margin: 0;
    }
    header {
      border-bottom: 2px solid #0f766e;
      padding-bottom: 8pt;
      margin-bottom: 10pt;
    }
    h1 {
      font-size: 20pt;
      font-weight: 700;
      margin: 0 0 3pt 0;
      letter-spacing: -0.02em;
      color: #111827;
    }
    .headline {
      font-size: 11pt;
      font-weight: 600;
      color: #0f766e;
      margin: 0 0 6pt 0;
    }
    .contact-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 2pt 12pt;
      font-size: 9pt;
      color: #374151;
    }
    .contact-grid span.label {
      font-weight: 600;
      color: #4b5563;
    }
    .section {
      margin-top: 9pt;
    }
    .section h2 {
      font-size: 9.5pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #0f766e;
      margin: 0 0 5pt 0;
      padding-bottom: 2pt;
      border-bottom: 1px solid #d1d5db;
    }
    .profile {
      margin: 0;
      text-align: justify;
      color: #374151;
    }
    .skills-grid {
      display: grid;
      grid-template-columns: 118px 1fr;
      gap: 2pt 8pt;
      font-size: 9.5pt;
    }
    .skills-grid .label {
      font-weight: 600;
      color: #4b5563;
    }
    .entry { margin-bottom: 7pt; }
    .row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 10pt;
    }
    .row .left {
      font-weight: 700;
      color: #111827;
    }
    .row .right {
      font-weight: 600;
      font-size: 9pt;
      color: #6b7280;
      white-space: nowrap;
    }
    .row.sub .left {
      font-weight: 600;
      font-style: normal;
      color: #374151;
    }
    .row.sub .right {
      font-weight: 500;
      font-style: italic;
    }
    ul {
      margin: 3pt 0 0 0;
      padding-left: 14pt;
    }
    li {
      margin: 0 0 2pt 0;
      color: #374151;
    }
    .footer-block p {
      margin: 0 0 3pt 0;
      font-size: 9.5pt;
    }
    .footer-block strong {
      color: #4b5563;
    }
  </style>
</head>
<body>
  <header>
    <h1>{{name}}</h1>
    {{#if headline}}<p class="headline">{{headline}}</p>{{/if}}
    <div class="contact-grid">
      {{#each contactItems}}<div><span class="label">{{label}}:</span> {{value}}</div>{{/each}}
    </div>
  </header>

  {{#if profile}}
  <section class="section">
    <h2>Profile</h2>
    <p class="profile">{{profile}}</p>
  </section>
  {{/if}}

  {{#if skill_groups}}
  <section class="section">
    <h2>Technical Skills</h2>
    <div class="skills-grid">
      {{#each skill_groups}}
      <span class="label">{{label}}</span>
      <span>{{items}}</span>
      {{/each}}
    </div>
  </section>
  {{else}}
  {{#if skills}}
  <section class="section">
    <h2>Technical Skills</h2>
    <p class="profile">{{skills}}</p>
  </section>
  {{/if}}
  {{/if}}

  <section class="section">
    <h2>Professional Experience</h2>
    {{#each experience}}
    <div class="entry">
      <div class="row">
        <span class="left">{{company}}</span>
        <span class="right">{{location}}</span>
      </div>
      <div class="row sub">
        <span class="left">{{title}}</span>
        <span class="right">{{dates}}</span>
      </div>
      {{#if bullets}}
      <ul>
        {{#each bullets}}<li>{{this}}</li>{{/each}}
      </ul>
      {{/if}}
    </div>
    {{/each}}
  </section>

  {{#if projects}}
  <section class="section">
    <h2>Key Projects</h2>
    {{#each projects}}
    <div class="entry">
      <div class="row">
        <span class="left">{{name}}</span>
        <span class="right">{{location}}</span>
      </div>
      {{#if title}}
      <div class="row sub">
        <span class="left">{{title}}</span>
        <span class="right">{{dates}}</span>
      </div>
      {{/if}}
      {{#if bullets}}
      <ul>
        {{#each bullets}}<li>{{this}}</li>{{/each}}
      </ul>
      {{/if}}
    </div>
    {{/each}}
  </section>
  {{/if}}

  <section class="section">
    <h2>Education</h2>
    {{#each education}}
    <div class="entry">
      <div class="row">
        <span class="left">{{school}}</span>
        <span class="right">{{location}}</span>
      </div>
      <div class="row sub">
        <span class="left">{{degree}}</span>
        <span class="right">{{dates}}</span>
      </div>
      {{#if details}}
      <ul>
        {{#each details}}<li>{{this}}</li>{{/each}}
      </ul>
      {{/if}}
    </div>
    {{/each}}
  </section>

  {{#if languages}}
  <section class="section footer-block">
    <h2>Languages &amp; Interests</h2>
    {{#if languages}}
    <p><strong>Languages:</strong> {{languages}}</p>
    {{/if}}
    {{#if interests}}
    <p><strong>Interests:</strong> {{interests}}</p>
    {{/if}}
  </section>
  {{/if}}
</body>
</html>
```

### `apps/api/tsconfig.build.json`

```json
{
  "extends": "./tsconfig.json",
  "exclude": ["node_modules", "dist", "src/cli.ts"]
}
```

### `apps/api/tsconfig.json`

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "target": "ES2022",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strictNullChecks": true,
    "forceConsistentCasingInFileNames": true,
    "noImplicitAny": false,
    "strictBindCallApply": false,
    "noFallthroughCasesInSwitch": false,
    "resolveJsonModule": true,
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src/**/*"]
}
```

### `apps/web/app/globals.css`

```css
@import "tailwindcss";

@theme {
  --color-canvas: #f3f6fb;
  --color-surface: #ffffff;
  --color-ink: #0f172a;
  --color-ink-muted: #64748b;
  --color-line: #e2e8f0;
  --color-brand: #0f766e;
  --color-brand-hover: #115e59;
  --color-brand-soft: #f0fdfa;
  --color-brand-ring: #5eead4;
  --color-cream-50: #ffffff;
  --color-cream-100: #f8fafc;
  --color-cream-200: #f1f5f9;
  --color-cream-300: #e2e8f0;
  --color-cream-400: #cbd5e1;
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
}

html {
  font-family: var(--font-sans);
}

body {
  background:
    radial-gradient(1200px 500px at 10% -10%, rgba(15, 118, 110, 0.09), transparent 50%),
    radial-gradient(900px 400px at 100% 0%, rgba(14, 165, 233, 0.08), transparent 45%),
    var(--color-canvas);
}

input,
select,
textarea,
button {
  font: inherit;
}

input[type="search"]::-webkit-search-cancel-button {
  cursor: pointer;
}

.field {
  @apply w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink shadow-sm outline-none transition placeholder:text-ink-muted/70 focus:border-brand focus:ring-2 focus:ring-brand-ring/60;
}

.btn-primary {
  @apply inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50;
}

.btn-secondary {
  @apply inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink shadow-sm transition hover:border-brand/40 hover:bg-brand-soft hover:text-brand disabled:cursor-not-allowed disabled:opacity-50;
}

.btn-ghost {
  @apply inline-flex items-center justify-center gap-2 rounded-xl border border-transparent px-4 py-2.5 text-sm font-semibold text-ink-muted transition hover:bg-white hover:text-ink disabled:cursor-not-allowed disabled:opacity-50;
}
```

### `apps/web/app/jobs/[id]/page.tsx`

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchJob } from "@/lib/api";
import { AppHeader } from "@/components/AppHeader";
import { ApplyBadge, ScoreBadge, StatusBadge } from "@/components/badges";
import { StatusButtons } from "@/components/StatusButtons";

export default async function JobDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const jobId = Number(id);
  if (!Number.isFinite(jobId)) notFound();
  let job;
  try {
    job = await fetchJob(jobId);
  } catch {
    notFound();
  }

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-screen-2xl px-5 py-6 sm:px-8">
        <p className="mb-5">
          <Link className="text-sm font-medium text-ink-muted no-underline hover:text-brand" href="/">
            ← Back to queue
          </Link>
        </p>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <article>
            <header className="mb-6 rounded-3xl border border-line bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <ScoreBadge score={job.match_score} />
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap gap-2">
                    <StatusBadge status={job.status} />
                    <ApplyBadge easy={job.is_easy_apply} />
                  </div>
                  <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{job.title}</h1>
                  <p className="mt-2 text-sm text-ink-muted">
                    <span className="font-medium text-ink">{job.company}</span>
                    <span className="mx-1.5">·</span>
                    {job.location || "—"}
                    <span className="mx-1.5">·</span>
                    {job.posted_text || "recent"}
                    {job.applied_at ? (
                      <>
                        <span className="mx-1.5">·</span>
                        Applied {job.applied_at}
                      </>
                    ) : null}
                  </p>
                  {job.match_rationale ? (
                    <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm leading-relaxed text-ink/80">{job.match_rationale}</p>
                  ) : null}
                  {job.apply_error ? <p className="mt-3 text-sm text-ink-muted">Note: {job.apply_error}</p> : null}
                </div>
              </div>
            </header>
            {job.cover ? (
              <section className="mb-5 rounded-3xl border border-line bg-white p-5 shadow-sm">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-muted">Cover letter</h2>
                <pre className="m-0 whitespace-pre-wrap font-sans text-sm leading-relaxed text-ink/90">{job.cover}</pre>
              </section>
            ) : null}
            {job.resume_md ? (
              <section className="mb-5 rounded-3xl border border-line bg-white p-5 shadow-sm">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-muted">Tailored resume</h2>
                <pre className="m-0 whitespace-pre-wrap font-sans text-sm leading-relaxed text-ink/90">{job.resume_md}</pre>
              </section>
            ) : null}
            <section className="rounded-3xl border border-line bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-muted">Job description</h2>
              <pre className="m-0 whitespace-pre-wrap font-sans text-sm leading-relaxed text-ink/90">
                {job.description || "No description stored yet."}
              </pre>
            </section>
          </article>
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-3xl border border-line bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold">Next steps</p>
              <p className="mt-1 text-xs text-ink-muted">Open LinkedIn to apply yourself. Mark the outcome here when you are done.</p>
              <div className="mt-4 flex flex-col gap-2">
                <a className="btn-primary no-underline" href={job.url} target="_blank" rel="noopener noreferrer">
                  Open on LinkedIn
                </a>
                {job.tailored_resume_pdf_path ? (
                  <a
                    className="btn-secondary no-underline"
                    href={`/api/jobs/${job.id}/resume.pdf`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Preview resume PDF
                  </a>
                ) : null}
                <StatusButtons jobId={job.id} />
              </div>
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}
```

### `apps/web/app/layout.tsx`

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Job Automator",
  description: "Find jobs · tailor resumes · you apply",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen text-ink antialiased`}>{children}</body>
    </html>
  );
}
```

### `apps/web/app/page.tsx`

```tsx
import Link from "next/link";
import { fetchJobs } from "@/lib/api";
import { AppHeader } from "@/components/AppHeader";
import { ApplyBadge, scoreTone, StatusBadge } from "@/components/badges";
import { JobFilters } from "@/components/JobFilters";
import { JobRowActions } from "@/components/JobRowActions";
import { RunControls } from "@/components/RunControls";

type Search = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] || "";
  return v || "";
}

function qs(filters: Record<string, string>, extra: Record<string, string> = {}): string {
  const params = new URLSearchParams();
  const merged = { ...filters, ...extra };
  for (const [k, v] of Object.entries(merged)) {
    if (v) params.set(k, v);
  }
  const s = params.toString();
  return s ? `/?${s}` : "/";
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const status = first(sp.status);
  const filters = {
    status,
    q: first(sp.q),
    company: first(sp.company),
    location: first(sp.location),
    min_score: first(sp.min_score),
    max_score: first(sp.max_score),
    apply_type: first(sp.apply_type) || "all",
    has_resume: first(sp.has_resume) || "all",
    sort: first(sp.sort) || "newest",
    page: first(sp.page) || "1",
    per_page: first(sp.per_page) || "25",
  };

  let data;
  try {
    data = await fetchJobs(filters);
  } catch {
    data = null;
  }

  const counts = data?.counts || {
    all: 0,
    ready: 0,
    scored: 0,
    applied: 0,
    skipped: 0,
    new: 0,
    not_easy_apply: 0,
  };
  const page = data?.page || 1;
  const totalPages = data?.total_pages || 1;
  const jobs = data?.jobs || [];
  const chipBase = { ...filters, page: "1" };

  const tabs: { key: string; label: string; count: number }[] = [
    { key: "", label: "All", count: counts.all },
    { key: "ready", label: "Ready", count: counts.ready },
    { key: "applied", label: "Applied", count: counts.applied },
    { key: "not_easy_apply", label: "External", count: counts.not_easy_apply },
    { key: "skipped", label: "Skipped", count: counts.skipped },
    { key: "scored", label: "Scored", count: counts.scored },
    { key: "new", label: "New", count: counts.new },
  ];

  const pageNums: (number | "ellipsis")[] = [];
  for (let p = 1; p <= totalPages; p++) {
    if (p === page || p === 1 || p === totalPages || (p >= page - 2 && p <= page + 2)) {
      pageNums.push(p);
    } else if (p === page - 3 || p === page + 3) {
      pageNums.push("ellipsis");
    }
  }

  return (
    <>
      <AppHeader actions={<RunControls />} />
      <main className="mx-auto max-w-screen-2xl px-5 py-6 sm:px-8">
        {!data ? (
          <p className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            Could not reach the API on port 3001. Start it with <code className="rounded bg-white px-1">pnpm api</code> or{" "}
            <code className="rounded bg-white px-1">pnpm dev</code>.
          </p>
        ) : null}

        <JobFilters initial={filters} />

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <nav className="flex gap-1 overflow-x-auto rounded-2xl bg-white p-1 shadow-sm ring-1 ring-line">
            {tabs.map((tab) => {
              const active = tab.key ? status === tab.key : !status;
              return (
                <Link
                  key={tab.key || "all"}
                  href={qs({ ...chipBase, status: tab.key })}
                  className={`whitespace-nowrap rounded-xl px-3 py-2 text-sm no-underline transition ${active ? "bg-brand text-white shadow-sm" : "text-ink-muted hover:bg-slate-50 hover:text-ink"
                    }`}
                >
                  {tab.label}
                  <span className={`ml-1.5 tabular-nums ${active ? "text-white/80" : "text-ink-muted/80"}`}>{tab.count}</span>
                </Link>
              );
            })}
          </nav>
          <p className="px-1 text-sm text-ink-muted">
            {data && data.total ? (
              <>
                Showing <strong className="text-ink">{data.showing_from}–{data.showing_to}</strong> of{" "}
                <strong className="text-ink">{data.total}</strong>
              </>
            ) : (
              "No matching jobs"
            )}
          </p>
        </div>

        {!jobs.length ? (
          <div className="rounded-3xl border border-dashed border-line bg-white/70 px-6 py-16 text-center">
            <p className="text-lg font-semibold">Nothing in this queue</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">
              Clear filters, or use <strong>Find new jobs</strong> to search LinkedIn and fill this list.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-3xl border border-line bg-white shadow-sm">
              <table className="w-full min-w-[1100px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-line bg-slate-50 text-left text-[0.72rem] font-semibold uppercase tracking-wide text-ink-muted">
                    {["Score", "Title", "Company", "Location", "Posted", "Added", "Apply type", "Status", "Match note"].map(
                      (h) => (
                        <th key={h} className="whitespace-nowrap px-3 py-3">
                          {h}
                        </th>
                      ),
                    )}
                    <th className="sticky right-0 z-20 whitespace-nowrap border-l border-line bg-slate-50 px-3 py-3 shadow-[-10px_0_12px_-8px_rgba(15,23,42,0.12)]">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr key={job.id} className="group border-b border-line last:border-b-0 hover:bg-slate-50/80">
                      <td className="px-3 py-3 text-center">
                        <span
                          className={`inline-flex min-w-10 items-center justify-center rounded-xl px-2 py-1 text-base font-bold tabular-nums ${scoreTone(job.match_score)}`}
                        >
                          {job.match_score ?? "—"}
                        </span>
                      </td>
                      <td className="max-w-[16rem] px-3 py-3">
                        <Link className="font-semibold text-ink no-underline hover:text-brand" href={`/jobs/${job.id}`}>
                          {job.title}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">{job.company || "—"}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-ink-muted">{job.location || "—"}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-ink-muted">{job.posted_text || "recent"}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-ink-muted">{job.created_at?.slice(0, 10) || "—"}</td>
                      <td className="whitespace-nowrap px-3 py-3">
                        <ApplyBadge easy={job.is_easy_apply} />
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        <StatusBadge status={job.status} />
                      </td>
                      <td className="max-w-[16rem] px-3 py-3">
                        <span className="line-clamp-2 text-ink-muted">{job.match_rationale || "Not scored yet"}</span>
                      </td>
                      <td className="sticky right-0 z-10 border-l border-line bg-white px-3 py-3 shadow-[-10px_0_12px_-8px_rgba(15,23,42,0.12)] group-hover:bg-slate-50">
                        <JobRowActions
                          jobId={job.id}
                          linkedinUrl={job.url}
                          hasPdf={Boolean(job.tailored_resume_pdf_path)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 ? (
              <nav className="mt-6 flex flex-wrap items-center justify-between gap-3">
                {page > 1 ? (
                  <Link className="btn-secondary no-underline" href={qs(filters, { page: String(page - 1) })}>
                    ← Previous
                  </Link>
                ) : (
                  <span className="btn-secondary opacity-40">← Previous</span>
                )}
                <div className="flex flex-wrap items-center justify-center gap-1">
                  {pageNums.map((p, i) =>
                    p === "ellipsis" ? (
                      <span key={`e${i}`} className="px-1 text-ink-muted">
                        …
                      </span>
                    ) : p === page ? (
                      <span key={p} className="inline-flex h-9 min-w-9 items-center justify-center rounded-xl bg-brand px-2 text-sm font-semibold text-white">
                        {p}
                      </span>
                    ) : (
                      <Link
                        key={p}
                        className="inline-flex h-9 min-w-9 items-center justify-center rounded-xl px-2 text-sm text-ink-muted no-underline hover:bg-white hover:text-ink"
                        href={qs(filters, { page: String(p) })}
                      >
                        {p}
                      </Link>
                    ),
                  )}
                </div>
                {page < totalPages ? (
                  <Link className="btn-secondary no-underline" href={qs(filters, { page: String(page + 1) })}>
                    Next →
                  </Link>
                ) : (
                  <span className="btn-secondary opacity-40">Next →</span>
                )}
              </nav>
            ) : null}
          </>
        )}
      </main>
    </>
  );
}
```

### `apps/web/components/AddJobButton.tsx`

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createManualJob } from "@/lib/api";

type Props = {
  disabled?: boolean;
};

export function AddJobButton({ disabled }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const title = String(fd.get("title") || "").trim();
    const description = String(fd.get("description") || "").trim();
    if (!title) {
      setError("Title is required");
      return;
    }
    if (description.length <= 40) {
      setError("Paste a full job description (more than 40 characters)");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const job = await createManualJob({
        title,
        company: String(fd.get("company") || "").trim() || undefined,
        location: String(fd.get("location") || "").trim() || undefined,
        url: String(fd.get("url") || "").trim() || undefined,
        description,
        is_easy_apply: Boolean(fd.get("is_easy_apply")),
        process: Boolean(fd.get("process")),
      });
      setOpen(false);
      router.push(`/jobs/${job.id}`);
      router.refresh();
    } catch (err) {
      const withJob = err as Error & { job?: { id: number } };
      if (withJob.job?.id) {
        setError(withJob.message);
        setTimeout(() => {
          router.push(`/jobs/${withJob.job!.id}`);
          router.refresh();
        }, 1800);
      } else {
        setError(err instanceof Error ? err.message : "Could not add job");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" disabled={disabled || busy} onClick={() => setOpen(true)} className="btn-secondary">
        Add job
      </button>

      {open ? (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => !busy && setOpen(false)}
          />
          <div className="relative mx-auto flex min-h-full max-w-xl items-center px-4 py-8">
            <div className="max-h-[90vh] w-full overflow-y-auto rounded-3xl border border-line bg-white p-6 shadow-2xl">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight">Add job manually</h2>
                  <p className="mt-1 text-sm text-ink-muted">
                    Paste a JD from LinkedIn or anywhere else. Optionally score and generate a tailored CV right away.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-ghost h-9 w-9 p-0"
                  disabled={busy}
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>

              <form className="flex flex-col gap-4" onSubmit={submit}>
                <label className="grid gap-1.5 text-sm">
                  <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                    Title <span className="text-rose-500">*</span>
                  </span>
                  <input name="title" required className="field" placeholder="e.g. Senior Frontend Engineer" />
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-1.5 text-sm">
                    <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Company</span>
                    <input name="company" className="field" placeholder="Company name" />
                  </label>
                  <label className="grid gap-1.5 text-sm">
                    <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Location</span>
                    <input name="location" className="field" placeholder="e.g. Remote / Berlin" />
                  </label>
                </div>

                <label className="grid gap-1.5 text-sm">
                  <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Job URL</span>
                  <input name="url" type="url" className="field" placeholder="https://www.linkedin.com/jobs/view/…" />
                </label>

                <label className="grid gap-1.5 text-sm">
                  <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                    Job description <span className="text-rose-500">*</span>
                  </span>
                  <textarea
                    name="description"
                    required
                    rows={12}
                    className="field min-h-48 resize-y font-mono text-[0.8rem] leading-relaxed"
                    placeholder="Paste the full job description here…"
                  />
                </label>

                <div className="space-y-2 rounded-2xl bg-slate-50 p-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="is_easy_apply" defaultChecked className="accent-brand" />
                    Easy Apply / I can apply myself on LinkedIn
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="process" defaultChecked className="accent-brand" />
                    Score & tailor CV now
                  </label>
                </div>

                {error ? (
                  <p className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>
                ) : null}

                <div className="flex justify-end gap-2 border-t border-line pt-4">
                  <button type="button" className="btn-secondary" disabled={busy} onClick={() => setOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary min-w-32" disabled={busy}>
                    {busy ? (
                      <>
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                        Working…
                      </>
                    ) : (
                      "Add job"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
```

### `apps/web/components/AppHeader.tsx`

```tsx
import Link from "next/link";
import type { ReactNode } from "react";

export function AppHeader({ actions }: { actions?: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line/80 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-screen-2xl flex-wrap items-center justify-between gap-4 px-5 py-3.5 sm:px-8">
        <Link href="/" className="group flex items-center gap-3 no-underline">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-brand text-white shadow-sm">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <rect x="4" y="7" width="16" height="13" rx="2" />
              <path d="M9 12h6M9 16h3" />
            </svg>
          </span>
          <span>
            <span className="block text-[1.05rem] font-semibold tracking-tight text-ink group-hover:text-brand">
              Job Automator
            </span>
            <span className="block text-xs text-ink-muted">Find · tailor · you apply</span>
          </span>
        </Link>
        {actions}
      </div>
    </header>
  );
}
```

### `apps/web/components/JobFilters.tsx`

```tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const ALLOWED_PER_PAGE = [10, 25, 50, 100];

export type JobFilterValues = {
  status: string;
  q: string;
  company: string;
  location: string;
  min_score: string;
  max_score: string;
  apply_type: string;
  has_resume: string;
  sort: string;
  per_page: string;
};

function hrefFor(values: JobFilterValues): string {
  const params = new URLSearchParams();
  const next = { ...values, page: "1" };
  for (const [k, v] of Object.entries(next)) {
    if (v) params.set(k, v);
  }
  const s = params.toString();
  return s ? `/?${s}` : "/";
}

export function JobFilters({ initial }: { initial: JobFilterValues }) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setValues(initial);
  }, [
    initial.status,
    initial.q,
    initial.company,
    initial.location,
    initial.min_score,
    initial.max_score,
    initial.apply_type,
    initial.has_resume,
    initial.sort,
    initial.per_page,
  ]);

  function commit(next: JobFilterValues, delayMs: number) {
    setValues(next);
    if (timer.current) clearTimeout(timer.current);
    const go = () => router.push(hrefFor(next));
    if (delayMs <= 0) go();
    else timer.current = setTimeout(go, delayMs);
  }

  function patch(partial: Partial<JobFilterValues>, delayMs = 0) {
    commit({ ...values, ...partial }, delayMs);
  }

  return (
    <section className="mb-5 rounded-3xl border border-line bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <label className="relative flex-1">
            <span className="sr-only">Search</span>
            <svg
              viewBox="0 0 24 24"
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3-3" />
            </svg>
            <input
              className="field pl-8!"
              type="search"
              value={values.q}
              onChange={(e) => patch({ q: e.target.value }, 350)}
              placeholder="Search title, company, skills…"
            />
          </label>
          <select
            className="field w-auto flex-1"
            value={values.sort}
            aria-label="Sort by"
            onChange={(e) => patch({ sort: e.target.value })}
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="score_desc">Highest score</option>
            <option value="score_asc">Lowest score</option>
            <option value="updated">Recently updated</option>
          </select>
          <select
            className="field w-auto flex-1"
            value={values.per_page}
            aria-label="Per page"
            onChange={(e) => patch({ per_page: e.target.value })}
          >
            {ALLOWED_PER_PAGE.map((n) => (
              <option key={n} value={n}>
                {n} / page
              </option>
            ))}
          </select>
          <Link className="btn-secondary no-underline" href="/">
            Reset
          </Link>
        </div>
        <details className="rounded-2xl px-1 py-1 open:bg-slate-50 open:px-4 open:py-3">
          <summary className="cursor-pointer text-sm font-medium text-ink-muted hover:text-ink">More filters</summary>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Company
              <input
                className="field font-normal normal-case"
                type="text"
                value={values.company}
                onChange={(e) => patch({ company: e.target.value }, 350)}
                placeholder="e.g. Google"
              />
            </label>
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Location
              <input
                className="field font-normal normal-case"
                type="text"
                value={values.location}
                onChange={(e) => patch({ location: e.target.value }, 350)}
                placeholder="e.g. Berlin, Remote"
              />
            </label>
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Min score
              <input
                className="field font-normal"
                type="number"
                min={0}
                max={100}
                value={values.min_score}
                onChange={(e) => patch({ min_score: e.target.value }, 350)}
                placeholder="0"
              />
            </label>
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Max score
              <input
                className="field font-normal"
                type="number"
                min={0}
                max={100}
                value={values.max_score}
                onChange={(e) => patch({ max_score: e.target.value }, 350)}
                placeholder="100"
              />
            </label>
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Apply type
              <select
                className="field font-normal normal-case"
                value={values.apply_type}
                onChange={(e) => patch({ apply_type: e.target.value })}
              >
                <option value="all">All listings</option>
                <option value="easy">Easy Apply only</option>
                <option value="external">External apply only</option>
              </select>
            </label>
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-ink-muted sm:col-span-2 lg:col-span-2">
              Resume PDF
              <select
                className="field font-normal normal-case"
                value={values.has_resume}
                onChange={(e) => patch({ has_resume: e.target.value })}
              >
                <option value="all">Any</option>
                <option value="yes">Has tailored PDF</option>
                <option value="no">No PDF yet</option>
              </select>
            </label>
          </div>
        </details>
      </div>
    </section>
  );
}
```

### `apps/web/components/JobRowActions.tsx`

```tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { scoreJob, tailorJob } from "@/lib/api";

const iconBtn =
  "relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-slate-50 text-ink shadow-sm transition hover:border-brand/40 hover:bg-brand-soft hover:text-brand disabled:cursor-not-allowed disabled:opacity-40";

function Tooltip({ text, show }: { text: string; show: boolean }) {
  return (
    <span
      role="tooltip"
      className={`pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1 text-[0.7rem] font-medium text-white shadow-lg ${
        show ? "opacity-100" : "opacity-0"
      }`}
    >
      {text}
    </span>
  );
}

function IconButton({
  label,
  busy,
  disabled,
  onClick,
  children,
}: {
  label: string;
  busy?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const [show, setShow] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled || busy}
      onClick={onClick}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
      className={iconBtn}
    >
      <Tooltip text={label} show={show && !busy} />
      {busy ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-line border-t-brand" /> : children}
    </button>
  );
}

function IconLink({
  label,
  href,
  external,
  children,
}: {
  label: string;
  href: string;
  external?: boolean;
  children: React.ReactNode;
}) {
  const [show, setShow] = useState(false);
  const className = `${iconBtn} no-underline`;
  const tip = <Tooltip text={label} show={show} />;
  const events = {
    onMouseEnter: () => setShow(true),
    onMouseLeave: () => setShow(false),
    onFocus: () => setShow(true),
    onBlur: () => setShow(false),
  };
  if (external) {
    return (
      <a href={href} aria-label={label} target="_blank" rel="noopener noreferrer" className={className} {...events}>
        {tip}
        {children}
      </a>
    );
  }
  return (
    <Link href={href} aria-label={label} className={className} {...events}>
      {tip}
      {children}
    </Link>
  );
}

export function JobRowActions({
  jobId,
  linkedinUrl,
  hasPdf,
}: {
  jobId: number;
  linkedinUrl: string;
  hasPdf: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"score" | "tailor" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(kind: "score" | "tailor") {
    setBusy(kind);
    setError(null);
    try {
      if (kind === "score") await scoreJob(jobId);
      else await tailorJob(jobId);
      router.refresh();
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-nowrap items-center gap-1.5">
      <IconButton label="Score" busy={busy === "score"} disabled={busy !== null} onClick={() => run("score")}>
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 19V5M4 19h16" />
          <path d="M8 15l3-4 3 2 5-7" />
        </svg>
      </IconButton>
      <IconButton label="Tailor PDF" busy={busy === "tailor"} disabled={busy !== null} onClick={() => run("tailor")}>
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6" />
          <path d="M8 13h8M8 17h5" />
        </svg>
      </IconButton>
      <IconLink label="Details" href={`/jobs/${jobId}`}>
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v6M12 8h.01" />
        </svg>
      </IconLink>
      {hasPdf ? (
        <IconLink label="Resume PDF" href={`/api/jobs/${jobId}/resume.pdf`} external>
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 2h9l5 5v15H6z" />
            <path d="M15 2v5h5M8 13h8M8 17h5" />
          </svg>
        </IconLink>
      ) : null}
      <IconLink label="Open on LinkedIn" href={linkedinUrl} external>
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
          <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.47-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45zM22.23 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.46c.98 0 1.77-.77 1.77-1.73V1.73C24 .77 23.21 0 22.23 0z" />
        </svg>
      </IconLink>
      {error ? (
        <span className="max-w-32 truncate text-[0.68rem] text-red-700" title={error}>
          {error}
        </span>
      ) : null}
    </div>
  );
}
```

### `apps/web/components/RunControls.tsx`

```tsx
"use client";

import { useEffect, useState } from "react";
import { fetchLlmProviders, fetchRunStatus, startRun } from "@/lib/api";
import { LlmCatalog, RunState } from "@/lib/types";
import { AddJobButton } from "./AddJobButton";

type Props = { initialStatus?: string };

export function RunControls({ initialStatus }: Props) {
  const [banner, setBanner] = useState<RunState | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"search" | "process">("search");
  const [busy, setBusy] = useState(false);
  const [catalog, setCatalog] = useState<LlmCatalog | null>(null);
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const [logOpen, setLogOpen] = useState(true);

  useEffect(() => {
    if (initialStatus === "running") {
      void poll();
    }
  }, [initialStatus]);

  async function loadCatalog() {
    const data = await fetchLlmProviders();
    setCatalog(data);
    const preferred =
      data.most_tokens || data.active_provider || data.providers.find((p) => p.configured)?.id || "groq";
    setProvider(preferred);
    const p = data.providers.find((x) => x.id === preferred);
    setModel(p?.recommended_model || p?.default_model || "");
  }

  function openModal(mode: "search" | "process") {
    setModalMode(mode);
    setModalOpen(true);
    void loadCatalog();
  }

  async function poll() {
    const state = await fetchRunStatus();
    setBanner(state);
    if (state.status === "running") {
      setTimeout(() => void poll(), 2000);
    } else if (state.status === "success") {
      const url = new URL(window.location.href);
      url.searchParams.set("sort", "newest");
      url.searchParams.set("page", "1");
      window.location.href = url.toString();
    }
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const skipSearch = modalMode === "process";
    const filters = {
      posted_within_hours: Number(fd.get("posted_within_hours") || 24),
      sort_by: String(fd.get("sort_by") || "DD"),
      easy_apply: Boolean(fd.get("easy_apply")),
      discover_external: Boolean(fd.get("discover_external")),
      under_10_applicants: Boolean(fd.get("under_10_applicants")),
      workplace: String(fd.get("workplace") || "include_remote"),
      skip_search: skipSearch,
      dry_run: false,
      llm_provider: provider || null,
      llm_model: model || null,
    };
    setBusy(true);
    setModalOpen(false);
    const res = await startRun(filters);
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.status === 409) {
      setBanner(
        data.state || {
          status: "running",
          message: "A run is already in progress",
          step: "",
          started_at: null,
          finished_at: null,
          error: null,
          stats: {},
          log: [],
          filters,
        },
      );
      void poll();
      return;
    }
    if (!res.ok) {
      setBanner({
        status: "error",
        message: String(data.detail || data.message || `HTTP ${res.status}`),
        step: "error",
        started_at: null,
        finished_at: null,
        error: String(data.detail || ""),
        stats: {},
        log: [],
        filters,
      });
      return;
    }
    setBanner(
      data.state || {
        status: "running",
        message: "Pipeline started…",
        step: "starting",
        started_at: null,
        finished_at: null,
        error: null,
        stats: {},
        log: [],
        filters,
      },
    );
    setLogOpen(true);
    void poll();
  }

  const selected = catalog?.providers.find((p) => p.id === provider);
  const running = busy || banner?.status === "running";
  const retired: Record<string, boolean> = {
    "gemini-2.0-flash": true,
    "llama-3.3-70b-versatile": true,
    "llama-3.1-8b-instant": true,
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <AddJobButton disabled={running} />
        <button type="button" disabled={running} onClick={() => openModal("process")} className="btn-secondary">
          Score & tailor
        </button>
        <button type="button" disabled={running} onClick={() => openModal("search")} className="btn-primary min-w-36">
          {running ? (
            <>
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              Running…
            </>
          ) : (
            "Find new jobs"
          )}
        </button>
      </div>

      {banner && banner.status !== "idle" ? (
        <div
          className={`fixed top-5 right-4 z-40 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border bg-white shadow-xl ${
            banner.status === "running"
              ? "border-brand/30"
              : banner.status === "success"
                ? "border-emerald-200"
                : "border-rose-200"
          }`}
        >
          <div className="flex items-start justify-between gap-3 px-4 py-3">
            <div>
              <p className="text-sm font-semibold">
                {banner.status === "running"
                  ? banner.filters?.skip_search
                    ? "Scoring & tailoring"
                    : "Finding jobs"
                  : banner.status === "success"
                    ? "Run complete"
                    : "Run failed"}
              </p>
              <p className="mt-0.5 text-xs text-ink-muted">{banner.message || banner.error}</p>
            </div>
            <button type="button" className="btn-ghost h-8 w-8 p-0 text-lg" onClick={() => setBanner(null)} aria-label="Dismiss">
              ×
            </button>
          </div>
          {banner.status === "running" ? (
            <div className="h-1 overflow-hidden bg-brand-soft">
              <div className="h-full w-1/2 animate-pulse bg-brand" />
            </div>
          ) : null}
          {(banner.log || []).length ? (
            <div className="border-t border-line">
              <button type="button" className="w-full px-4 py-2 text-left text-xs font-medium text-ink-muted" onClick={() => setLogOpen((v) => !v)}>
                {logOpen ? "Hide log" : "Show log"}
              </button>
              {logOpen ? (
                <pre className="max-h-36 overflow-auto whitespace-pre-wrap bg-slate-50 px-4 pb-3 font-mono text-[0.7rem] leading-relaxed text-ink-muted">
                  {(banner.log || []).join("\n")}
                </pre>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {modalOpen ? (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
          <div className="relative mx-auto flex min-h-full max-w-lg items-center px-4 py-8">
            <div className="max-h-[85vh] w-full overflow-y-auto rounded-3xl border border-line bg-white p-6 shadow-2xl">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight">
                    {modalMode === "process" ? "Score & tailor" : "Find new jobs"}
                  </h2>
                  <p className="mt-1 text-sm text-ink-muted">
                    {modalMode === "process"
                      ? "Fetch missing descriptions, score listings, and generate CV PDFs."
                      : "Search LinkedIn with these filters, then score and tailor."}{" "}
                    Free providers auto-switch if one hits a limit (never uses paid OpenAI).
                  </p>
                </div>
                <button type="button" className="btn-ghost h-9 w-9 p-0" onClick={() => setModalOpen(false)} aria-label="Close">
                  ✕
                </button>
              </div>
              <form className="flex flex-col gap-4" onSubmit={submit}>
                <div className={modalMode === "process" ? "hidden" : "grid gap-4"}>
                  <label className="grid gap-1.5 text-sm">
                    <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Date posted</span>
                    <select name="posted_within_hours" defaultValue="24" className="field">
                      <option value="24">Past 24 hours</option>
                      <option value="72">Past 3 days</option>
                      <option value="168">Past week</option>
                      <option value="720">Past month</option>
                    </select>
                  </label>
                  <label className="grid gap-1.5 text-sm">
                    <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Sort results</span>
                    <select name="sort_by" defaultValue="DD" className="field">
                      <option value="DD">Most recent first</option>
                      <option value="R">Most relevant</option>
                    </select>
                  </label>
                  <div className="space-y-2 rounded-2xl bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Apply type</p>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="easy_apply" defaultChecked className="accent-brand" />
                      Easy Apply only
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="discover_external" className="accent-brand" />
                      Also list external-apply jobs
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="under_10_applicants" className="accent-brand" />
                      Under 10 applicants
                    </label>
                  </div>
                  <label className="grid gap-1.5 text-sm">
                    <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Workplace</span>
                    <select name="workplace" defaultValue="include_remote" className="field">
                      <option value="include_remote">On-site / hybrid + remote pass</option>
                      <option value="remote_only">Remote only</option>
                      <option value="any">Any (no remote filter)</option>
                    </select>
                  </label>
                </div>
                <fieldset className="space-y-3 border-t border-line pt-4">
                  <legend className="text-xs font-semibold uppercase tracking-wide text-ink-muted">LLM for score & tailor</legend>
                  {catalog?.most_tokens_label ? (
                    <p className="text-xs text-ink-muted">
                      Most free tokens: <strong className="text-ink">{catalog.most_tokens_label}</strong>
                      {(catalog as { auto_failover?: boolean }).auto_failover !== false
                        ? " · Auto-failover across free providers is on."
                        : null}
                    </p>
                  ) : null}
                  <div className="grid gap-2">
                    {(catalog?.providers || []).map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        disabled={!p.configured}
                        onClick={() => {
                          setProvider(p.id);
                          setModel(p.recommended_model || p.default_model);
                        }}
                        className={`rounded-2xl border px-3 py-2.5 text-left text-sm transition disabled:opacity-45 ${
                          provider === p.id ? "border-brand bg-brand-soft" : "border-line bg-white hover:border-brand/30"
                        }`}
                      >
                        <div className="flex justify-between gap-2">
                          <div>
                            <strong>{p.label}</strong>
                            <span className="text-ink-muted"> · {p.cost}</span>
                            <div className="mt-0.5 text-xs text-ink-muted">{p.token_note}</div>
                          </div>
                          <span className="tabular-nums text-xs text-ink-muted">{p.token_score}/100</span>
                        </div>
                      </button>
                    ))}
                  </div>
                  <label className="grid gap-1.5 text-sm">
                    <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Model</span>
                    <select value={model} onChange={(e) => setModel(e.target.value)} className="field">
                      {(selected?.models || []).map((m) => (
                        <option key={m} value={m} disabled={retired[m]}>
                          {m}
                          {m === selected?.default_model ? " (recommended)" : ""}
                          {retired[m] ? " — retired" : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                </fieldset>
                <div className="mt-1 flex justify-end gap-2 border-t border-line pt-4">
                  <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary">
                    {modalMode === "process" ? "Start score & tailor" : "Start search"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
```

### `apps/web/components/StatusButtons.tsx`

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { setJobStatus } from "@/lib/api";

export function StatusButtons({ jobId }: { jobId: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function mark(status: string) {
    setBusy(true);
    try {
      await setJobStatus(jobId, status);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button className="btn-primary bg-emerald-600 hover:bg-emerald-700" type="button" disabled={busy} onClick={() => mark("applied")}>
        Mark applied
      </button>
      <button className="btn-secondary text-rose-700 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-800" type="button" disabled={busy} onClick={() => mark("skipped")}>
        Skip
      </button>
    </>
  );
}
```

### `apps/web/components/badges.tsx`

```tsx
export function scoreTone(score: number | null) {
  if (score == null) return "bg-slate-100 text-slate-500";
  if (score >= 70) return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
  if (score >= 50) return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
  return "bg-rose-50 text-rose-700 ring-1 ring-rose-200";
}

export function ScoreBadge({ score }: { score: number | null }) {
  return (
    <div
      className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl text-center ${scoreTone(score)}`}
      title={score == null ? "Not scored" : `Match score ${score}`}
    >
      <span className="text-lg font-bold tabular-nums leading-none">{score ?? "—"}</span>
      <span className="mt-0.5 text-[0.62rem] font-medium uppercase tracking-wider opacity-70">match</span>
    </div>
  );
}

const statusStyles: Record<string, string> = {
  ready: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  scored: "bg-sky-50 text-sky-700 ring-sky-200",
  applied: "bg-violet-50 text-violet-700 ring-violet-200",
  skipped: "bg-slate-100 text-slate-600 ring-slate-200",
  new: "bg-amber-50 text-amber-700 ring-amber-200",
  not_easy_apply: "bg-orange-50 text-orange-700 ring-orange-200",
};

export function StatusBadge({ status }: { status: string }) {
  const cls = statusStyles[status] || "bg-slate-100 text-slate-600 ring-slate-200";
  const label = status === "not_easy_apply" ? "external" : status.replaceAll("_", " ");
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide ring-1 ${cls}`}>
      {label}
    </span>
  );
}

export function ApplyBadge({ easy }: { easy: boolean }) {
  return easy ? (
    <span className="inline-flex rounded-full bg-brand-soft px-2.5 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide text-brand ring-1 ring-brand-ring/70">
      Easy Apply
    </span>
  ) : (
    <span className="inline-flex rounded-full bg-orange-50 px-2.5 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide text-orange-700 ring-1 ring-orange-200">
      External
    </span>
  );
}
```

### `apps/web/lib/api.ts`

```typescript
import { JobsResponse, Job, LlmCatalog, RunState } from "./types";

function apiBase(): string {
  if (typeof window === "undefined") {
    return process.env.API_URL || "http://127.0.0.1:3001";
  }
  return "";
}

export async function fetchJobs(params: Record<string, string | undefined>): Promise<JobsResponse> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) qs.set(k, v);
  }
  const res = await fetch(`${apiBase()}/api/jobs?${qs.toString()}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`jobs ${res.status}`);
  return res.json();
}

export async function fetchJob(id: number): Promise<Job> {
  const res = await fetch(`${apiBase()}/api/jobs/${id}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Job not found");
  return res.json();
}

export async function setJobStatus(id: number, status: string): Promise<Job> {
  const res = await fetch(`/api/jobs/${id}/status/${status}`, { method: "POST" });
  if (!res.ok) throw new Error("Could not update status");
  return res.json();
}

async function postJobAction(id: number, action: "score" | "tailor"): Promise<Job> {
  const res = await fetch(`/api/jobs/${id}/${action}`, { method: "POST" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      typeof data.message === "string"
        ? data.message
        : typeof data.detail === "string"
          ? data.detail
          : `Could not ${action} job`;
    throw new Error(msg);
  }
  return data;
}

export function scoreJob(id: number) {
  return postJobAction(id, "score");
}

export function tailorJob(id: number) {
  return postJobAction(id, "tailor");
}

export type CreateManualJobInput = {
  title: string;
  company?: string;
  location?: string;
  url?: string;
  description: string;
  is_easy_apply?: boolean;
  process?: boolean;
};

export async function createManualJob(input: CreateManualJobInput): Promise<Job> {
  const res = await fetch("/api/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(input),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      typeof data.message === "string"
        ? data.message
        : Array.isArray(data.message)
          ? data.message.join(", ")
          : typeof data.detail === "string"
            ? data.detail
            : "Could not add job";
    // Partial success: job saved but tailor failed
    if (data.job?.id) {
      const err = new Error(msg) as Error & { job?: Job };
      err.job = data.job;
      throw err;
    }
    throw new Error(msg);
  }
  return data;
}

export async function fetchRunStatus(): Promise<RunState> {
  const res = await fetch("/api/run/status");
  if (!res.ok) throw new Error("status");
  return res.json();
}

export async function startRun(body: Record<string, unknown>) {
  return fetch("/api/run", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
}

export async function fetchLlmProviders(): Promise<LlmCatalog> {
  const res = await fetch("/api/llm/providers");
  if (!res.ok) throw new Error("llm");
  return res.json();
}
```

### `apps/web/lib/types.ts`

```typescript
export type Job = {
  id: number;
  linkedin_job_id: string;
  title: string;
  company: string;
  location: string;
  url: string;
  posted_text: string;
  description: string;
  match_score: number | null;
  match_rationale: string;
  status: string;
  is_easy_apply: boolean;
  tailored_resume_md_path: string | null;
  tailored_resume_pdf_path: string | null;
  cover_letter_path: string | null;
  apply_error: string;
  applied_at: string | null;
  created_at: string;
  updated_at: string;
  cover?: string;
  resume_md?: string;
};

export type JobsResponse = {
  jobs: Job[];
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
  counts: Record<string, number>;
  showing_from: number;
  showing_to: number;
};

export type RunState = {
  status: "idle" | "running" | "success" | "error";
  message: string;
  step: string;
  started_at: string | null;
  finished_at: string | null;
  error: string | null;
  stats: Record<string, unknown>;
  log: string[];
  filters: Record<string, unknown>;
};

export type LlmCatalog = {
  active_provider: string;
  active_model?: string;
  most_tokens: string | null;
  most_tokens_label: string | null;
  providers: {
    id: string;
    label: string;
    models: string[];
    default_model: string;
    recommended_model: string;
    cost: string;
    token_score: number;
    token_note: string;
    configured: boolean;
    active_default: boolean;
  }[];
};
```

### `apps/web/next-env.d.ts`

```typescript
/// <reference types="next" />
/// <reference types="next/image-types/global" />
/// <reference path="./.next/types/routes.d.ts" />

// NOTE: This file should not be edited
// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.
```

### `apps/web/next.config.ts`

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:3001/api/:path*",
      },
    ];
  },
};

export default nextConfig;
```

### `apps/web/package.json`

```json
{
  "name": "@job-automator/web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --port 3000",
    "start:dev": "next dev --port 3000",
    "build": "next build",
    "start": "next start --port 3000"
  },
  "dependencies": {
    "next": "^15.5.2",
    "react": "^19.1.1",
    "react-dom": "^19.1.1"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4.1.12",
    "@types/node": "^22.17.0",
    "@types/react": "^19.1.12",
    "@types/react-dom": "^19.1.9",
    "tailwindcss": "^4.1.12",
    "typescript": "^5.9.2"
  }
}
```

### `apps/web/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```
