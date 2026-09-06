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

## Deploying web + API separately

The UI talks to Nest via `API_URL` (SSR) and Next rewrites of `/api/*`. If you only deploy the web app without pointing it at a reachable API, you get: *Could not reach the API…*

On the **API** service:

- Start with `pnpm --filter @job-automator/api start:prod` (after `build`), or your platform’s Node start command on `apps/api`.
- Set `DATABASE_URL`, LLM keys, and `CORS_ORIGIN=https://your-web-host` (comma-separated origins, or `*`).
- Listen address defaults to `0.0.0.0`; port from `PORT` / `API_PORT` (default `3001`).

On the **web** service:

- Set **`API_URL=https://your-api-host`** (no trailing slash) at **build and runtime** so rewrites and server fetches hit Nest, not `127.0.0.1:3001`.
- Rebuild/redeploy the web app after changing `API_URL`.

Local monorepo `pnpm dev` still works without these vars.

## Free LLM options

Groq (`openai/gpt-oss-120b`), Gemini (`gemini-2.5-flash`), local Ollama, or paid OpenAI. Configure in `.env`. The API auto-fails over across free providers when rate-limited. Retired Groq Llama 3.3 IDs are auto-upgraded.

## Config

Edit facts in [`data/master_resume.yaml`](data/master_resume.yaml).  
Adjust roles in [`config/roles.yaml`](config/roles.yaml) and search prefs in [`config/preferences.yaml`](config/preferences.yaml).

## Resume templates

PDFs use the **European CV** layout by default (`resume_template: european` in `config/preferences.yaml`): A4, company-tailored profile/headline/bullets. Classic US Letter is still available.
