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
