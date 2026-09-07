import type { ScoreBreakdown } from "@/lib/types";
import { ScoringResumeActions } from "@/components/ScoringResumeActions";

function signed(n: number) {
  if (n > 0) return `+${n}`;
  return String(n);
}

function TagList({ items, empty }: { items: string[]; empty: string }) {
  if (!items.length) {
    return <p className="text-sm text-ink-muted">{empty}</p>;
  }
  return (
    <ul className="m-0 flex flex-wrap gap-1.5 p-0">
      {items.map((item) => (
        <li
          key={item}
          className="inline-flex rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-medium text-brand ring-1 ring-brand-ring/40"
        >
          {item}
        </li>
      ))}
    </ul>
  );
}

export function ScoreBreakdownCard({
  breakdown,
  jobId,
}: {
  breakdown: ScoreBreakdown;
  jobId: number;
}) {
  const llmPct = Math.round(breakdown.weights.llm * 100);
  const heurPct = Math.round(breakdown.weights.heuristic * 100);
  const scored = breakdown.final_score != null;

  return (
    <section className="mb-5 rounded-3xl border border-line bg-white p-5 shadow-sm sm:p-6">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-ink-muted">
        How this score was calculated
      </h2>
      <p className="mb-5 text-sm text-ink-muted">
        {scored
          ? breakdown.blended
            ? `This listing is scored against your resume: ${llmPct}% LLM judgment + ${heurPct}% keyword heuristic.`
            : "This listing used the keyword heuristic only (LLM was skipped or unavailable)."
          : "Not scored yet. The preview below is the keyword heuristic for this job. Click Score to run the LLM blend."}
        {scored && !breakdown.blended && breakdown.final_score !== breakdown.heuristic_score
          ? ` The saved score is ${breakdown.final_score}; the live heuristic for the current resume is ${breakdown.heuristic_score}. Re-score to refresh.`
          : ""}
      </p>

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-slate-50 px-4 py-3">
          <p className="text-[0.68rem] font-semibold uppercase tracking-wider text-ink-muted">Final</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">{breakdown.final_score ?? "—"}</p>
          <p className="mt-0.5 text-xs text-ink-muted">
            {breakdown.blended ? `${llmPct}% LLM + ${heurPct}% heuristic` : "Heuristic only"}
          </p>
        </div>
        <div className="rounded-2xl bg-slate-50 px-4 py-3">
          <p className="text-[0.68rem] font-semibold uppercase tracking-wider text-ink-muted">LLM</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">{breakdown.llm_score ?? "—"}</p>
          <p className="mt-0.5 text-xs text-ink-muted">Resume vs this JD</p>
        </div>
        <div className="rounded-2xl bg-slate-50 px-4 py-3">
          <p className="text-[0.68rem] font-semibold uppercase tracking-wider text-ink-muted">Heuristic</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">{breakdown.heuristic_score}</p>
          <p className="mt-0.5 text-xs text-ink-muted">Titles, skills, location</p>
        </div>
      </div>

      <div className="mb-5 rounded-2xl border border-line/80 bg-cream-100/60 px-4 py-3">
        <p className="mb-1 text-[0.68rem] font-semibold uppercase tracking-wider text-ink-muted">Resume used</p>
        <ScoringResumeActions
          jobId={jobId}
          resumeSource={breakdown.resume_source}
          resumeLabel={breakdown.resume_label}
        />
      </div>

      {breakdown.rationale ? (
        <blockquote className="mb-5 rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-relaxed text-ink/85">
          {breakdown.rationale}
        </blockquote>
      ) : null}

      <div className="mb-5">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">Heuristic formula</h3>
        <div className="overflow-hidden rounded-2xl border border-line">
          <table className="w-full text-left text-sm">
            <tbody>
              {breakdown.formula.map((row) => (
                <tr key={row.label} className="border-b border-line last:border-b-0">
                  <th className="w-40 px-3 py-2.5 align-top font-medium text-ink">{row.label}</th>
                  <td className="px-3 py-2.5 text-ink-muted">{row.detail}</td>
                  <td className="w-16 px-3 py-2.5 text-right font-semibold tabular-nums text-ink">{signed(row.points)}</td>
                </tr>
              ))}
              <tr className="bg-brand-soft/70">
                <th className="px-3 py-2.5 font-semibold text-ink">Heuristic total</th>
                <td className="px-3 py-2.5 text-xs text-ink-muted">Capped at 0–100</td>
                <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-brand">{breakdown.heuristic_score}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="mb-5 grid gap-4 sm:grid-cols-2">
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">Target titles in this JD</h3>
          <TagList items={breakdown.title_hits} empty="None of your target titles appear in this listing." />
        </div>
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">Skills in both resume and JD</h3>
          <TagList items={breakdown.resume_overlap} empty="No shared target skills between the resume and this JD." />
        </div>
      </div>

      <div className="mb-5">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">Target skills found in the JD</h3>
        <TagList items={breakdown.skill_hits} empty="None of your target skills appear in this listing." />
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">LLM score bands</h3>
        <ul className="m-0 space-y-1.5 p-0 text-sm">
          {breakdown.bands.map((band) => (
            <li key={band.range} className="flex gap-3">
              <span className="w-14 shrink-0 font-semibold tabular-nums text-ink">{band.range}</span>
              <span className="text-ink-muted">{band.meaning}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
