/** Nest API origin (no trailing slash). Used by SSR and the /api proxy. */
export function getApiBaseUrl(): string {
  return (process.env.API_URL || "http://127.0.0.1:3001").replace(/\/$/, "");
}

export function isApiUrlConfigured(): boolean {
  return Boolean(process.env.API_URL?.trim());
}

/** True on Vercel / production hosts where localhost Nest is never reachable. */
export function isProbablyHosted(): boolean {
  return Boolean(process.env.VERCEL || process.env.NODE_ENV === "production");
}
