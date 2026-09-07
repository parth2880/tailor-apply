"use client";

import { useState } from "react";
import type { Job, ScoreBreakdown } from "@/lib/types";
import { coverLetterDownloadName, psDownloadName } from "@/lib/resume-filename";
import { PdfActions } from "@/components/PdfActions";
import { ScoreBreakdownContent } from "@/components/ScoreBreakdownCard";

type Tab = "docs" | "score";

export function JobMatchTabs({ job }: { job: Job }) {
  const [tab, setTab] = useState<Tab>("docs");
  const breakdown = job.score_breakdown;
  const hasResumeActions = breakdown && breakdown.resume_source !== "none";

  return (
    <section className="mb-5 overflow-hidden rounded-3xl border border-line bg-white shadow-sm">
      <div className="flex gap-1 border-b border-line bg-slate-50 p-1.5 sm:px-2" role="tablist">
        <TabButton active={tab === "docs"} onClick={() => setTab("docs")}>
          Resume & cover letter
        </TabButton>
        <TabButton active={tab === "score"} onClick={() => setTab("score")}>
          How score is calculated
        </TabButton>
      </div>

      {tab === "docs" ? (
        <div className="space-y-6 p-4 sm:p-6">
          <div>
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="m-0 text-sm font-semibold uppercase tracking-wider text-ink-muted">Resume</h2>
                <p className="mt-1 text-sm text-ink">{breakdown?.resume_label || "No resume used yet"}</p>
              </div>
              {hasResumeActions ? (
                <PdfActions href={`/api/jobs/${job.id}/scoring-resume.pdf`} downloadName={psDownloadName(job.title)} />
              ) : null}
            </div>
            {job.resume_md ? (
              <pre className="m-0 max-h-[28rem] overflow-auto whitespace-pre-wrap rounded-2xl bg-slate-50 p-4 font-sans text-sm leading-relaxed text-ink/90">
                {job.resume_md}
              </pre>
            ) : (
              <p className="m-0 rounded-2xl bg-slate-50 p-4 text-sm text-ink-muted">
                {hasResumeActions
                  ? "Open View to see the PDF used for scoring, or run Tailor to generate a job-specific resume."
                  : "Score or tailor this job to attach a resume."}
              </p>
            )}
          </div>

          <div className="border-t border-line pt-6">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="m-0 text-sm font-semibold uppercase tracking-wider text-ink-muted">Cover letter</h2>
              {job.cover ? (
                <PdfActions href={`/api/jobs/${job.id}/cover.pdf`} downloadName={coverLetterDownloadName(job.title)} />
              ) : null}
            </div>
            {job.cover ? (
              <pre className="m-0 max-h-[28rem] overflow-auto whitespace-pre-wrap rounded-2xl bg-slate-50 p-4 font-sans text-sm leading-relaxed text-ink/90">
                {job.cover}
              </pre>
            ) : (
              <p className="m-0 rounded-2xl bg-slate-50 p-4 text-sm text-ink-muted">
                No cover letter yet. Tailor this job to generate one.
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="p-4 sm:p-6">
          {breakdown ? (
            <ScoreBreakdownContent breakdown={breakdown} />
          ) : (
            <p className="m-0 text-sm text-ink-muted">Score this job to see how the match is calculated.</p>
          )}
        </div>
      )}
    </section>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`rounded-xl px-3 py-2 text-sm font-semibold transition sm:px-4 ${
        active ? "bg-white text-brand shadow-sm ring-1 ring-line" : "text-ink-muted hover:bg-white/70 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
