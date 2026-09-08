import { isServerlessRuntime } from "./paths";

export const BROWSER_UNAVAILABLE_MESSAGE =
  "Find jobs cannot run on Vercel. LinkedIn search needs a logged-in Chromium window on a real machine. Use `pnpm dev` on your laptop, or deploy the Nest API on Railway, Render, or Fly.";

export class BrowserUnavailableError extends Error {
  constructor(message = BROWSER_UNAVAILABLE_MESSAGE) {
    super(message);
    this.name = "BrowserUnavailableError";
  }
}

export function assertChromiumAvailable(): void {
  if (isServerlessRuntime()) {
    throw new BrowserUnavailableError();
  }
}

export function isPlaywrightMissing(exc: unknown): boolean {
  const msg = exc instanceof Error ? exc.message : String(exc);
  return (
    /executable doesn't exist/i.test(msg) ||
    /browserType\.launch/i.test(msg) ||
    /playwright/i.test(exc instanceof Error ? exc.name : "")
  );
}

export function wrapPlaywrightLaunch(exc: unknown): never {
  if (isServerlessRuntime() || isPlaywrightMissing(exc)) {
    throw new BrowserUnavailableError();
  }
  throw exc;
}
