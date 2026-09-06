import type { NextConfig } from "next";

/**
 * Browser /api calls are proxied at runtime by app/api/[...path]/route.ts
 * so Vercel can use API_URL from runtime env (build-time rewrites cannot).
 * SSR still calls Nest via API_URL in lib/api.ts / lib/server-api.ts.
 */
const nextConfig: NextConfig = {};

export default nextConfig;
