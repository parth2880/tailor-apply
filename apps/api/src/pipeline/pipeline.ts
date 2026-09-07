import { getPreferences, getRolesConfig } from "../common/config";
import { JobStatus } from "../common/job-status";
import { JobsService } from "../jobs/jobs.service";
import { enrichMissingDescriptions } from "../linkedin/job-detail";
import { searchJobs } from "../linkedin/search";
import { withLinkedInSession } from "../linkedin/session";
import { scorePendingJobs } from "../matching/scorer";
import { tailorPendingJobs } from "../resume/tailor";
import { skipReasonForCard, skipReasonForJd, targetPhrases } from "../matching/relevance";
import { SearchOptions, defaultSearchOptions, summarizeOptions } from "./search-options";

export type ProgressFn = (step: string, message: string) => void;

async function dropOffTargetJobs(
  jobs: JobsService,
  roles: ReturnType<typeof getRolesConfig>,
  options: SearchOptions,
  titlesOnly: boolean,
): Promise<number> {
  const phrases = targetPhrases(roles, options);
  let dropped = 0;
  for (const status of [JobStatus.NEW, JobStatus.NOT_EASY_APPLY, JobStatus.SCORED, JobStatus.READY]) {
    const pending = await jobs.list({ status }, "newest", 500, 0);
    for (const job of pending) {
      const reason = titlesOnly
        ? skipReasonForCard(job.title, phrases)
        : skipReasonForCard(job.title, phrases) ||
          skipReasonForJd(job.title, job.description || "", phrases, roles.skills || []);
      if (!reason) continue;
      await jobs.markSkipped(job.id, reason);
      dropped += 1;
      console.log(`  Queue skip: ${job.title} @ ${job.company} — ${reason}`);
    }
  }
  return dropped;
}

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
  const titleDropped = await dropOffTargetJobs(jobs, roles, options, true);
  if (titleDropped) {
    console.log(`Removed ${titleDropped} off-target title(s) before fetching descriptions.`);
    progress("enrich", `Removed ${titleDropped} off-target title(s)`);
  }

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

  const dropped = await dropOffTargetJobs(jobs, roles, options, false);
  if (dropped) {
    console.log(`Removed ${dropped} off-target job(s) from the queue.`);
    progress("enrich", `Removed ${dropped} off-target job(s)`);
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
