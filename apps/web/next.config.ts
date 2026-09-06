import type { NextConfig } from "next";

/** Nest API base URL used by Next rewrites (and SSR via API_URL). No trailing slash. */
const apiUrl = (process.env.API_URL || "http://127.0.0.1:3001").replace(/\/$/, "");

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
