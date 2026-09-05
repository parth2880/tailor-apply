"use client";

import { useEffect } from "react";
import { toast } from "react-toastify";

export function ApiOfflineToast() {
  useEffect(() => {
    toast.error("Could not reach the API on port 3001. Start it with pnpm api or pnpm dev.");
  }, []);
  return null;
}
