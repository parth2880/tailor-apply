"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "react-toastify";
import { setJobStatus } from "@/lib/api";

export function StatusButtons({ jobId }: { jobId: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function mark(status: string) {
    setBusy(true);
    try {
      await setJobStatus(jobId, status);
      toast.success(status === "applied" ? "Marked as applied" : "Job skipped");
      router.refresh();
    } catch (exc) {
      toast.error(exc instanceof Error ? exc.message : "Could not update status");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button className="btn-primary bg-emerald-600 hover:bg-emerald-700" type="button" disabled={busy} onClick={() => mark("applied")}>
        Mark applied
      </button>
      <button className="btn-secondary text-rose-700 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-800" type="button" disabled={busy} onClick={() => mark("skipped")}>
        Skip
      </button>
    </>
  );
}
