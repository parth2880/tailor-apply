"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "react-toastify";
import { setJobStatus } from "@/lib/api";

function restoreStatus(hasPdf: boolean, matchScore: number | null): string {
  if (hasPdf) return "ready";
  if (matchScore != null) return "scored";
  return "new";
}

export function StatusButtons({
  jobId,
  status,
  hasPdf,
  matchScore,
}: {
  jobId: number;
  status: string;
  hasPdf: boolean;
  matchScore: number | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const applied = status === "applied";
  const skipped = status === "skipped";

  async function mark(next: string, ok: string) {
    setBusy(true);
    try {
      await setJobStatus(jobId, next);
      toast.success(ok);
      router.refresh();
    } catch (exc) {
      toast.error(exc instanceof Error ? exc.message : "Could not update status");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {applied ? null : (
        <button
          className="btn-primary bg-emerald-600 hover:bg-emerald-700"
          type="button"
          disabled={busy}
          onClick={() => void mark("applied", "Marked as applied")}
        >
          Mark applied
        </button>
      )}
      {applied || skipped ? null : (
        <button
          className="btn-secondary text-rose-700 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-800"
          type="button"
          disabled={busy}
          onClick={() => void mark("skipped", "Job skipped")}
        >
          Skip
        </button>
      )}
      {applied || skipped ? (
        <button
          className="btn-secondary"
          type="button"
          disabled={busy}
          onClick={() =>
            void mark(restoreStatus(hasPdf, matchScore), applied ? "Moved back to the queue" : "Restored to the queue")
          }
        >
          {applied ? "Move back to queue" : "Restore to queue"}
        </button>
      ) : null}
    </>
  );
}
