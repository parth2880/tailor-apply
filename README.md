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

## Public URL (access from anywhere)

Keep the **website** on Vercel. Put the **API** on [Railway](https://railway.app) (or Render / Fly). Find jobs needs Chromium and a disk for LinkedIn cookies — Vercel cannot do that.

### 1. Deploy the API on Railway

1. New Railway project from this GitHub repo (uses `apps/api/Dockerfile`).
2. Add a **volume** mounted at `/data`.
3. Set variables:

```
HEADLESS=true
DATA_DIR=/data
DATABASE_URL=file:/data/app.db
CORS_ORIGIN=https://YOUR-VERCEL-APP.vercel.app
GROQ_API_KEY=...
LLM_PROVIDER=groq
LLM_MODEL=openai/gpt-oss-120b
```

4. Give the API a public domain. Open `/health` — you want `"linkedin_search": true`.

### 2. Point Vercel at that API

Vercel → Settings → Environment Variables (Production + Preview):

```
API_URL=https://your-api.up.railway.app
```

No trailing slash, then **Redeploy**. Use the Vercel URL from any device; search runs on Railway.

### 3. Copy LinkedIn login once

On your Mac:

```bash
pnpm linkedin-login
```

Copy `data/browser_profile` onto the volume at `/data/browser_profile` (Railway SSH / Render shell / `scp`). Without it, Find jobs cannot see a LinkedIn session.

If LinkedIn expires the session, login locally again and recopy.

Local `pnpm dev` still works without these vars.

## Free LLM options

Groq (`openai/gpt-oss-120b`), Gemini (`gemini-2.5-flash`), local Ollama, or paid OpenAI. Configure in `.env`. The API auto-fails over across free providers when rate-limited. Retired Groq Llama 3.3 IDs are auto-upgraded.

## Config

Edit facts in [`data/master_resume.yaml`](data/master_resume.yaml).  
Adjust roles in [`config/roles.yaml`](config/roles.yaml) and search prefs in [`config/preferences.yaml`](config/preferences.yaml).

## Resume templates

PDFs use the **European CV** layout by default (`resume_template: european` in `config/preferences.yaml`): A4, company-tailored profile/headline/bullets. Classic US Letter is still available.
