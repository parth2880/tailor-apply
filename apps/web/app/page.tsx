import Link from "next/link";
import { fetchJobs } from "@/lib/api";
import { AppHeader } from "@/components/AppHeader";
import { ApplyBadge, scoreTone, StatusBadge } from "@/components/badges";
import { JobFilters } from "@/components/JobFilters";
import { JobRowActions } from "@/components/JobRowActions";
import { RunControls } from "@/components/RunControls";
import { ApiOfflineBanner, ApiOfflineToast } from "@/components/ApiOfflineToast";
import { isApiUrlConfigured, isProbablyHosted } from "@/lib/server-api";

type Search = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] || "";
  return v || "";
}

function jobRowTone(status: string) {
  if (status === "applied") {
    return {
      card: "rounded-3xl border border-violet-200 bg-violet-50/90 p-4 shadow-sm ring-1 ring-violet-100",
      row: "group border-b border-violet-100 bg-violet-50/80 last:border-b-0 hover:bg-violet-100/70",
      sticky:
        "sticky right-0 z-10 border-l border-violet-200 bg-violet-50/90 px-3 py-3 shadow-[-10px_0_12px_-8px_rgba(15,23,42,0.12)] group-hover:bg-violet-100/70",
    };
  }
  if (status === "skipped") {
    return {
      card: "rounded-3xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm",
      row: "group border-b border-slate-100 bg-slate-50/70 last:border-b-0 hover:bg-slate-100/80",
      sticky:
        "sticky right-0 z-10 border-l border-slate-200 bg-slate-50/90 px-3 py-3 shadow-[-10px_0_12px_-8px_rgba(15,23,42,0.12)] group-hover:bg-slate-100/80",
    };
  }
  return {
    card: "rounded-3xl border border-line bg-white p-4 shadow-sm",
    row: "group border-b border-line last:border-b-0 hover:bg-slate-50/80",
    sticky:
      "sticky right-0 z-10 border-l border-line bg-white px-3 py-3 shadow-[-10px_0_12px_-8px_rgba(15,23,42,0.12)] group-hover:bg-slate-50",
  };
}

function formatSearchTime(raw?: string | null): string {
  if (!raw) return "—";
  const trimmed = raw.trim();
  const iso = trimmed.includes("T")
    ? trimmed.endsWith("Z")
      ? trimmed
      : `${trimmed}Z`
    : `${trimmed}T00:00:00Z`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return trimmed.replace("T", " ").slice(0, 16);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function shortPosted(text: string): string {
  const raw = (text || "recent").replace(/\s+/g, " ").trim();
  const first = raw.split(/[·\n]/)[0]?.trim() || raw;
  const cut = first.replace(/\s*within the past\b.*$/i, "").trim();
  const label = cut || "recent";
  if (label.length <= 18) return label;
  return `${label.slice(0, 16).trimEnd()}…`;
}

function qs(filters: Record<string, string>, extra: Record<string, string> = {}): string {
  const params = new URLSearchParams();
  const merged = { ...filters, ...extra };
  for (const [k, v] of Object.entries(merged)) {
    if (v) params.set(k, v);
  }
  const s = params.toString();
  return s ? `/?${s}` : "/";
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const status = first(sp.status);
  const filters = {
    status,
    q: first(sp.q),
    company: first(sp.company),
    location: first(sp.location),
    min_score: first(sp.min_score),
    max_score: first(sp.max_score),
    apply_type: first(sp.apply_type) || "all",
    has_resume: first(sp.has_resume) || "all",
    sort: first(sp.sort) || "newest",
    page: first(sp.page) || "1",
    per_page: first(sp.per_page) || "25",
  };

  let data;
  try {
    data = await fetchJobs(filters);
  } catch {
    data = null;
  }

  const counts = data?.counts || {
    all: 0,
    ready: 0,
    scored: 0,
    applied: 0,
    skipped: 0,
    new: 0,
    not_easy_apply: 0,
  };
  const page = data?.page || 1;
  const totalPages = data?.total_pages || 1;
  const jobs = data?.jobs || [];
  const chipBase = { ...filters, page: "1" };

  const tabs: { key: string; label: string; count: number }[] = [
    { key: "", label: "All", count: counts.all },
    { key: "ready", label: "Ready", count: counts.ready },
    { key: "applied", label: "Applied", count: counts.applied },
    { key: "not_easy_apply", label: "External", count: counts.not_easy_apply },
    { key: "skipped", label: "Skipped", count: counts.skipped },
    { key: "scored", label: "Scored", count: counts.scored },
    { key: "new", label: "New", count: counts.new },
  ];

  const pageNums: (number | "ellipsis")[] = [];
  for (let p = 1; p <= totalPages; p++) {
    if (p === page || p === 1 || p === totalPages || (p >= page - 2 && p <= page + 2)) {
      pageNums.push(p);
    } else if (p === page - 3 || p === page + 3) {
      pageNums.push("ellipsis");
    }
  }

  const apiUrlConfigured = isApiUrlConfigured();
  const hosted = isProbablyHosted();

  return (
    <>
      <AppHeader actions={<RunControls />} />
      <main className="mx-auto max-w-screen-2xl px-4 py-5 sm:px-8 sm:py-6">
        {!data ? (
          <>
            <ApiOfflineToast apiUrlConfigured={apiUrlConfigured} hosted={hosted} />
            <ApiOfflineBanner apiUrlConfigured={apiUrlConfigured} hosted={hosted} />
          </>
        ) : null}

        <JobFilters initial={filters} />

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <nav className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:rounded-2xl sm:bg-white sm:p-1 sm:shadow-sm sm:ring-1 sm:ring-line sm:pb-1">
            {tabs.map((tab) => {
              const active = tab.key ? status === tab.key : !status;
              return (
                <Link
                  key={tab.key || "all"}
                  href={qs({ ...chipBase, status: tab.key })}
                  className={`shrink-0 whitespace-nowrap rounded-xl px-3 py-2 text-sm no-underline transition ${active ? "bg-brand text-white shadow-sm" : "bg-white text-ink-muted ring-1 ring-line sm:bg-transparent sm:ring-0 hover:bg-slate-50 hover:text-ink"
                    }`}
                >
                  {tab.label}
                  <span className={`ml-1.5 tabular-nums ${active ? "text-white/80" : "text-ink-muted/80"}`}>{tab.count}</span>
                </Link>
              );
            })}
          </nav>
          <p className="px-1 text-sm text-ink-muted">
            {data && data.total ? (
              <>
                Showing <strong className="text-ink">{data.showing_from}–{data.showing_to}</strong> of{" "}
                <strong className="text-ink">{data.total}</strong>
              </>
            ) : (
              "No matching jobs"
            )}
          </p>
        </div>

        {!jobs.length ? (
          <div className="rounded-3xl border border-dashed border-line bg-white/70 px-5 py-14 text-center sm:px-6 sm:py-16">
            <p className="text-lg font-semibold">Nothing in this queue</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">
              Clear filters, or use <strong>Find new jobs</strong> to search LinkedIn and fill this list.
            </p>
          </div>
        ) : (
          <>
            {/* Mobile card list */}
            <ul className="grid gap-3 md:hidden">
              {jobs.map((job) => {
                const tone = jobRowTone(job.status);
                const applied = job.status === "applied";
                return (
                  <li key={job.id} className={tone.card}>
                    <div className="flex gap-3">
                      <span
                        className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-base font-bold tabular-nums ${scoreTone(job.match_score)}`}
                      >
                        {job.match_score ?? "—"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="mb-1.5 flex flex-wrap gap-1.5">
                          <StatusBadge status={job.status} />
                          <ApplyBadge easy={job.is_easy_apply} />
                        </div>
                        <Link
                          className={`block text-base font-semibold leading-snug no-underline hover:text-brand ${applied ? "text-violet-950" : "text-ink"}`}
                          href={`/jobs/${job.id}`}
                        >
                          {job.title}
                        </Link>
                        <p className="mt-1 text-sm text-ink-muted">
                          <span className={`font-medium ${applied ? "text-violet-950" : "text-ink"}`}>{job.company || "—"}</span>
                          <span className="mx-1">·</span>
                          {job.location || "—"}
                        </p>
                        <p className="mt-0.5 text-xs text-ink-muted">
                          {shortPosted(job.posted_text)}
                          <span className="mx-1">·</span>
                          added {formatSearchTime(job.last_seen_at || job.created_at)}
                          {applied && job.applied_at ? (
                            <>
                              <span className="mx-1">·</span>
                              applied {job.applied_at.slice(0, 10)}
                            </>
                          ) : null}
                        </p>
                        <p className="mt-2 line-clamp-2 text-sm text-ink-muted">
                          {job.apply_error || job.match_rationale || "Not scored yet"}
                        </p>
                      </div>
                    </div>
                    <div className={`mt-3 border-t pt-3 ${applied ? "border-violet-200" : "border-line"}`}>
                      <JobRowActions
                        jobId={job.id}
                        jobTitle={job.title}
                        linkedinUrl={job.url}
                        hasPdf={Boolean(job.tailored_resume_pdf_path)}
                        status={job.status}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* Desktop table */}
            <div className="hidden overflow-x-auto rounded-3xl border border-line bg-white shadow-sm md:block">
              <table className="w-full min-w-[1100px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-line bg-slate-50 text-left text-[0.72rem] font-semibold uppercase tracking-wide text-ink-muted">
                    {["Score", "Title", "Company", "Location", "Status", "Posted", "Added", "Apply type", "Match note"].map(
                      (h) => (
                        <th key={h} className="whitespace-nowrap px-3 py-3">
                          {h}
                        </th>
                      ),
                    )}
                    <th className="sticky right-0 z-20 whitespace-nowrap border-l border-line bg-slate-50 px-3 py-3 shadow-[-10px_0_12px_-8px_rgba(15,23,42,0.12)]">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => {
                    const tone = jobRowTone(job.status);
                    const applied = job.status === "applied";
                    return (
                      <tr key={job.id} className={tone.row}>
                        <td className={`px-3 py-3 text-center ${applied ? "border-l-4 border-violet-500" : ""}`}>
                          <span
                            className={`inline-flex min-w-10 items-center justify-center rounded-xl px-2 py-1 text-base font-bold tabular-nums ${scoreTone(job.match_score)}`}
                          >
                            {job.match_score ?? "—"}
                          </span>
                        </td>
                        <td className="max-w-[16rem] px-3 py-3">
                          <Link
                            className={`font-semibold no-underline hover:text-brand ${applied ? "text-violet-950" : "text-ink"}`}
                            href={`/jobs/${job.id}`}
                          >
                            {job.title}
                          </Link>
                          {applied && job.applied_at ? (
                            <p className="mt-0.5 text-xs font-medium text-violet-700">Applied {job.applied_at.slice(0, 10)}</p>
                          ) : null}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3">{job.company || "—"}</td>
                        <td className="max-w-[10rem] truncate px-3 py-3 text-ink-muted" title={job.location || undefined}>
                          {job.location || "—"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3">
                          <StatusBadge status={job.status} />
                        </td>
                        <td
                          className="max-w-[7.5rem] truncate px-3 py-3 text-ink-muted"
                          title={job.posted_text || undefined}
                        >
                          {shortPosted(job.posted_text)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-ink-muted">
                          {formatSearchTime(job.last_seen_at || job.created_at)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3">
                          <ApplyBadge easy={job.is_easy_apply} />
                        </td>
                        <td className="max-w-[16rem] px-3 py-3">
                          <span className="line-clamp-2 text-ink-muted">
                            {job.apply_error || job.match_rationale || "Not scored yet"}
                          </span>
                        </td>
                        <td className={tone.sticky}>
                          <JobRowActions
                            jobId={job.id}
                            jobTitle={job.title}
                            linkedinUrl={job.url}
                            hasPdf={Boolean(job.tailored_resume_pdf_path)}
                            status={job.status}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {totalPages > 1 ? (
              <nav className="mt-6 flex flex-wrap items-center justify-between gap-3">
                {page > 1 ? (
                  <Link className="btn-secondary no-underline" href={qs(filters, { page: String(page - 1) })}>
                    ← Previous
                  </Link>
                ) : (
                  <span className="btn-secondary opacity-40">← Previous</span>
                )}
                <div className="flex flex-wrap items-center justify-center gap-1">
                  {pageNums.map((p, i) =>
                    p === "ellipsis" ? (
                      <span key={`e${i}`} className="px-1 text-ink-muted">
                        …
                      </span>
                    ) : p === page ? (
                      <span key={p} className="inline-flex h-9 min-w-9 items-center justify-center rounded-xl bg-brand px-2 text-sm font-semibold text-white">
                        {p}
                      </span>
                    ) : (
                      <Link
                        key={p}
                        className="inline-flex h-9 min-w-9 items-center justify-center rounded-xl px-2 text-sm text-ink-muted no-underline hover:bg-white hover:text-ink"
                        href={qs(filters, { page: String(p) })}
                      >
                        {p}
                      </Link>
                    ),
                  )}
                </div>
                {page < totalPages ? (
                  <Link className="btn-secondary no-underline" href={qs(filters, { page: String(page + 1) })}>
                    Next →
                  </Link>
                ) : (
                  <span className="btn-secondary opacity-40">Next →</span>
                )}
              </nav>
            ) : null}
          </>
        )}
      </main>
    </>
  );
}
