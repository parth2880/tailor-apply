import { BrowserContext, Page, chromium } from "playwright";
import { assertChromiumAvailable, wrapPlaywrightLaunch } from "../common/browser";
import { getPreferences } from "../common/config";
import { BROWSER_PROFILE, ensureDataDirs } from "../common/paths";

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
    this.profileDir = opts?.profileDir || BROWSER_PROFILE;
    this.headless = opts?.headless ?? prefs.headless;
    this.baseUrl = prefs.linkedin_base_url.replace(/\/$/, "");
  }

  async start(): Promise<Page> {
    assertChromiumAvailable();
    try {
      this.context = await chromium.launchPersistentContext(this.profileDir, {
        headless: this.headless,
        viewport: { width: 1280, height: 900 },
        locale: "en-US",
        args: ["--disable-blink-features=AutomationControlled"],
      });
    } catch (exc) {
      wrapPlaywrightLaunch(exc);
    }
    this.page = this.context!.pages()[0] || (await this.context!.newPage());
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
