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

### Web (Vercel) ✅

Deploy `apps/web` (or the monorepo with Root Directory `apps/web`).

- Set **`API_URL=https://your-api-host`** (no trailing slash) for Production + Preview, then redeploy.
- Browser `/api/*` is proxied at runtime; SSR also uses `API_URL`.

### API — prefer Railway / Render / Fly / Docker ⚠️

This Nest API uses **SQLite + Playwright**. That fits a **persistent Node host**, not Vercel’s read-only serverless filesystem.

**Recommended:** deploy with the included [`apps/api/Dockerfile`](apps/api/Dockerfile) on Railway/Render/Fly:

- Start command / Docker image from that Dockerfile (or `pnpm --filter @job-automator/api start:prod` after build).
- Env: `DATABASE_URL`, LLM keys, `CORS_ORIGIN=https://your-web.vercel.app`.
- Bind `0.0.0.0`; port from `PORT` (default `3001`).

**If the API is already on Vercel** (and you see `FUNCTION_INVOCATION_FAILED` / 500):

1. Vercel project **Root Directory** = `apps/api`.
2. Redeploy this branch (API now writes SQLite under `/tmp` and ships `config/` + resume inside the package).
3. Set `CORS_ORIGIN` to your web URL.
4. Open `https://your-api.vercel.app/health` — you should get `{ "ok": true }`.
5. Know the limits: **/tmp DB is wiped on cold starts**; **LinkedIn browser search will not work** on Vercel. Use Railway (or similar) for the full pipeline.

Local monorepo `pnpm dev` still works without deploy env vars.

## Free LLM options

Groq (`openai/gpt-oss-120b`), Gemini (`gemini-2.5-flash`), local Ollama, or paid OpenAI. Configure in `.env`. The API auto-fails over across free providers when rate-limited. Retired Groq Llama 3.3 IDs are auto-upgraded.

## Config

Edit facts in [`data/master_resume.yaml`](data/master_resume.yaml).  
Adjust roles in [`config/roles.yaml`](config/roles.yaml) and search prefs in [`config/preferences.yaml`](config/preferences.yaml).

## Resume templates

PDFs use the **European CV** layout by default (`resume_template: european` in `config/preferences.yaml`): A4, company-tailored profile/headline/bullets. Classic US Letter is still available.
