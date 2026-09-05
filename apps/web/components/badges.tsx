export function scoreTone(score: number | null) {
  if (score == null) return "bg-slate-100 text-slate-500";
  if (score >= 70) return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
  if (score >= 50) return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
  return "bg-rose-50 text-rose-700 ring-1 ring-rose-200";
}

export function ScoreBadge({ score }: { score: number | null }) {
  return (
    <div
      className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl text-center ${scoreTone(score)}`}
      title={score == null ? "Not scored" : `Match score ${score}`}
    >
      <span className="text-lg font-bold tabular-nums leading-none">{score ?? "—"}</span>
      <span className="mt-0.5 text-[0.62rem] font-medium uppercase tracking-wider opacity-70">match</span>
    </div>
  );
}

const statusStyles: Record<string, string> = {
  ready: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  scored: "bg-sky-50 text-sky-700 ring-sky-200",
  applied: "bg-violet-50 text-violet-700 ring-violet-200",
  skipped: "bg-slate-100 text-slate-600 ring-slate-200",
  new: "bg-amber-50 text-amber-700 ring-amber-200",
  not_easy_apply: "bg-orange-50 text-orange-700 ring-orange-200",
};

export function StatusBadge({ status }: { status: string }) {
  const cls = statusStyles[status] || "bg-slate-100 text-slate-600 ring-slate-200";
  const label = status === "not_easy_apply" ? "external" : status.replaceAll("_", " ");
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide ring-1 ${cls}`}>
      {label}
    </span>
  );
}

export function ApplyBadge({ easy }: { easy: boolean }) {
  return easy ? (
    <span className="inline-flex rounded-full bg-brand-soft px-2.5 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide text-brand ring-1 ring-brand-ring/70">
      Easy Apply
    </span>
  ) : (
    <span className="inline-flex rounded-full bg-orange-50 px-2.5 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide text-orange-700 ring-1 ring-orange-200">
      External
    </span>
  );
}
