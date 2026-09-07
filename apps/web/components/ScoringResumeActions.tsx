"use client";

import { useState } from "react";
import { toast } from "react-toastify";
import { Modal } from "@/components/Modal";

type ScoringResumePayload = {
  content: string;
  source: "tailored" | "master";
  label: string;
  filename: string;
};

const actionBtn =
  "inline-flex items-center justify-center rounded-xl border border-line bg-white px-3 py-1.5 text-xs font-medium text-ink shadow-sm transition hover:border-brand/40 hover:bg-brand-soft hover:text-brand disabled:cursor-not-allowed disabled:opacity-40";

export function ScoringResumeActions({
  jobId,
  resumeSource,
  resumeLabel,
}: {
  jobId: number;
  resumeSource: "tailored" | "master" | "none";
  resumeLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [payload, setPayload] = useState<ScoringResumePayload | null>(null);

  const canOpen = resumeSource !== "none";

  async function viewResume() {
    if (!canOpen) return;
    setOpen(true);
    if (payload) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/scoring-resume`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.message === "string" ? data.message : "Could not load resume");
      }
      setPayload(data as ScoringResumePayload);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load resume");
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium text-ink">{resumeLabel}</p>
        {canOpen ? (
          <div className="flex shrink-0 gap-2">
            <button type="button" className={actionBtn} onClick={viewResume}>
              View
            </button>
            <a className={actionBtn} href={`/api/jobs/${jobId}/scoring-resume.md`} download>
              Download
            </a>
          </div>
        ) : null}
      </div>

      {open ? (
        <Modal onClose={() => setOpen(false)} maxWidth="3xl">
          <div
            className="flex max-h-[85vh] w-full flex-col overflow-hidden rounded-3xl border border-line bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
              <div className="min-w-0">
                <p className="text-[0.68rem] font-semibold uppercase tracking-wider text-ink-muted">
                  Resume used for scoring
                </p>
                <p className="mt-0.5 truncate text-sm font-medium text-ink">
                  {payload?.label || resumeLabel}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {payload ? (
                  <a className={actionBtn} href={`/api/jobs/${jobId}/scoring-resume.md`} download>
                    Download
                  </a>
                ) : null}
                <button type="button" className={actionBtn} onClick={() => setOpen(false)}>
                  Close
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto px-4 py-4 sm:px-5">
              {loading ? (
                <p className="text-sm text-ink-muted">Loading resume…</p>
              ) : (
                <pre className="m-0 whitespace-pre-wrap font-sans text-sm leading-relaxed text-ink/90">
                  {payload?.content || ""}
                </pre>
              )}
            </div>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
