"use client";

import { useEffect } from "react";
import { toast } from "react-toastify";

export function ApiOfflineToast() {
  useEffect(() => {
    toast.error(
      "Could not reach the API. For local dev run pnpm api or pnpm dev. When deployed, set API_URL on the web service to your public API base URL (and CORS_ORIGIN on the API).",
    );
  }, []);
  return null;
}
