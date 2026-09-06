"use client";

import { useEffect } from "react";
import { toast } from "react-toastify";

type Props = {
  /** True when API_URL is set on the web service. */
  apiUrlConfigured?: boolean;
  /** True on Vercel / production hosts. */
  hosted?: boolean;
};

export function ApiOfflineToast({ apiUrlConfigured = false, hosted = false }: Props) {
  useEffect(() => {
    if (hosted && !apiUrlConfigured) {
      toast.error(
        "API_URL is missing on this web deploy. In Vercel → Settings → Environment Variables, set API_URL to your public Nest URL (no trailing slash), enable Production + Preview, then Redeploy.",
        { autoClose: 14000 },
      );
      return;
    }
    toast.error(
      apiUrlConfigured
        ? "Could not reach Nest at API_URL. Confirm the API is running and CORS_ORIGIN includes this site’s origin."
        : "Could not reach the API. Locally run pnpm api or pnpm dev. When web is on Vercel, set API_URL to your public Nest base URL.",
      { autoClose: 10000 },
    );
  }, [apiUrlConfigured, hosted]);
  return null;
}

export function ApiOfflineBanner({ apiUrlConfigured = false, hosted = false }: Props) {
  return (
    <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 sm:px-5">
      <p className="font-semibold">API offline</p>
      {hosted && !apiUrlConfigured ? (
        <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-amber-900/90">
          <li>
            Deploy the Nest API somewhere public (Railway, Render, Fly, etc.) — Vercel alone only hosts this Next.js UI.
          </li>
          <li>
            In Vercel → Settings → Environment Variables, set{" "}
            <code className="rounded bg-white/80 px-1">API_URL</code> to that API origin (example:{" "}
            <code className="rounded bg-white/80 px-1">https://your-api.up.railway.app</code>), no trailing slash.
          </li>
          <li>
            On the API service set <code className="rounded bg-white/80 px-1">CORS_ORIGIN</code> to this Vercel URL.
          </li>
          <li>Redeploy the web project so the new env is applied.</li>
        </ol>
      ) : (
        <p className="mt-1 text-amber-900/90">
          {apiUrlConfigured
            ? "The web app could not reach Nest at API_URL. Check that the API is up and CORS_ORIGIN includes this site."
            : "Start Nest with pnpm api / pnpm dev, or set API_URL when web and API are separate services."}
        </p>
      )}
    </div>
  );
}
