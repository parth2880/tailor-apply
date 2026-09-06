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

function keywordQueries(roles: RolesConfig, options?: SearchOptions): string[] {
  const custom = (options?.keywords || []).map((k) => k.trim()).filter(Boolean);
  if (custom.length) return [...new Set(custom)];
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

  const queries = keywordQueries(roles, options);
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
