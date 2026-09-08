"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const ALLOWED_PER_PAGE = [10, 25, 50, 100];

export type JobFilterValues = {
  status: string;
  q: string;
  company: string;
  location: string;
  min_score: string;
  max_score: string;
  apply_type: string;
  has_resume: string;
  sort: string;
  per_page: string;
};

function hrefFor(values: JobFilterValues): string {
  const params = new URLSearchParams();
  const next = { ...values, page: "1" };
  for (const [k, v] of Object.entries(next)) {
    if (v) params.set(k, v);
  }
  const s = params.toString();
  return s ? `/?${s}` : "/";
}

export function JobFilters({ initial }: { initial: JobFilterValues }) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setValues(initial);
  }, [
    initial.status,
    initial.q,
    initial.company,
    initial.location,
    initial.min_score,
    initial.max_score,
    initial.apply_type,
    initial.has_resume,
    initial.sort,
    initial.per_page,
  ]);

  function commit(next: JobFilterValues, delayMs: number) {
    setValues(next);
    if (timer.current) clearTimeout(timer.current);
    const go = () => router.push(hrefFor(next));
    if (delayMs <= 0) go();
    else timer.current = setTimeout(go, delayMs);
  }

  function patch(partial: Partial<JobFilterValues>, delayMs = 0) {
    commit({ ...values, ...partial }, delayMs);
  }

  return (
    <section className="mb-5 rounded-3xl border border-line bg-white p-3 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 sm:gap-4">
        <div className="grid gap-2 sm:flex sm:items-center">
          <label className="relative w-full sm:min-w-0 sm:flex-1">
            <span className="sr-only">Search</span>
            <svg
              viewBox="0 0 24 24"
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3-3" />
            </svg>
            <input
              className="field pl-8!"
              type="search"
              value={values.q}
              onChange={(e) => patch({ q: e.target.value }, 350)}
              placeholder="Search title, company, skills…"
            />
          </label>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:w-auto sm:shrink-0">
            <select
              className="field min-w-0 sm:min-w-36"
              value={values.status}
              aria-label="Status"
              onChange={(e) => patch({ status: e.target.value })}
            >
              <option value="">All statuses</option>
              <option value="ready">Ready</option>
              <option value="applied">Applied</option>
              <option value="scored">Scored</option>
              <option value="new">New</option>
              <option value="not_easy_apply">External</option>
              <option value="skipped">Skipped</option>
            </select>
            <select
              className="field min-w-0"
              value={values.sort}
              aria-label="Sort by"
              onChange={(e) => patch({ sort: e.target.value })}
            >
              <option value="newest">Latest search first</option>
              <option value="oldest">Oldest first</option>
              <option value="score_desc">Highest score</option>
              <option value="score_asc">Lowest score</option>
              <option value="updated">Recently updated</option>
            </select>
            <select
              className="field min-w-0"
              value={values.per_page}
              aria-label="Per page"
              onChange={(e) => patch({ per_page: e.target.value })}
            >
              {ALLOWED_PER_PAGE.map((n) => (
                <option key={n} value={n}>
                  {n} / page
                </option>
              ))}
            </select>
          </div>
          <Link className="btn-secondary w-full no-underline sm:w-auto" href="/">
            Reset
          </Link>
        </div>
        <details className="rounded-2xl px-1 py-1 open:bg-slate-50 open:px-4 open:py-3">
          <summary className="cursor-pointer text-sm font-medium text-ink-muted hover:text-ink">More filters</summary>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Company
              <input
                className="field font-normal normal-case"
                type="text"
                value={values.company}
                onChange={(e) => patch({ company: e.target.value }, 350)}
                placeholder="e.g. Google"
              />
            </label>
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Location
              <input
                className="field font-normal normal-case"
                type="text"
                value={values.location}
                onChange={(e) => patch({ location: e.target.value }, 350)}
                placeholder="e.g. Berlin, Remote"
              />
            </label>
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Min score
              <input
                className="field font-normal"
                type="number"
                min={0}
                max={100}
                value={values.min_score}
                onChange={(e) => patch({ min_score: e.target.value }, 350)}
                placeholder="0"
              />
            </label>
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Max score
              <input
                className="field font-normal"
                type="number"
                min={0}
                max={100}
                value={values.max_score}
                onChange={(e) => patch({ max_score: e.target.value }, 350)}
                placeholder="100"
              />
            </label>
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Apply type
              <select
                className="field font-normal normal-case"
                value={values.apply_type}
                onChange={(e) => patch({ apply_type: e.target.value })}
              >
                <option value="all">All listings</option>
                <option value="easy">Easy Apply only</option>
                <option value="external">External apply only</option>
              </select>
            </label>
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-ink-muted sm:col-span-2 lg:col-span-2">
              Resume PDF
              <select
                className="field font-normal normal-case"
                value={values.has_resume}
                onChange={(e) => patch({ has_resume: e.target.value })}
              >
                <option value="all">Any</option>
                <option value="yes">Has tailored PDF</option>
                <option value="no">No PDF yet</option>
              </select>
            </label>
          </div>
        </details>
      </div>
    </section>
  );
}
