"use client";

import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { fetchApiHealth, fetchLlmProviders, fetchRunStatus, fetchSearchKeywords, startRun } from "@/lib/api";
import { LlmCatalog, RunState } from "@/lib/types";
import { AddJobButton } from "./AddJobButton";
import { KeywordTagInput } from "./KeywordTagInput";
import { LlmProviderFields } from "./LlmProviderFields";
import { Modal } from "./Modal";

type Props = { initialStatus?: string };

export function RunControls({ initialStatus }: Props) {
  const [banner, setBanner] = useState<RunState | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"search" | "process">("search");
  const [busy, setBusy] = useState(false);
  const [catalog, setCatalog] = useState<LlmCatalog | null>(null);
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const [logOpen, setLogOpen] = useState(true);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [maxJobs, setMaxJobs] = useState(20);
  const [serverless, setServerless] = useState(false);

  useEffect(() => {
    if (initialStatus === "running") {
      void poll();
    }
    void fetchApiHealth()
      .then((h) => setServerless(Boolean(h.serverless) || h.linkedin_search === false))
      .catch(() => undefined);
  }, [initialStatus]);

  async function loadCatalog() {
    try {
      const data = await fetchLlmProviders();
      setCatalog(data);
      const preferred =
        data.most_tokens || data.active_provider || data.providers.find((p) => p.configured)?.id || "groq";
      setProvider(preferred);
      const p = data.providers.find((x) => x.id === preferred);
      setModel(p?.recommended_model || p?.default_model || "");
    } catch (exc) {
      toast.error(exc instanceof Error ? exc.message : "Could not load LLM providers");
    }
  }

  async function loadKeywords() {
    try {
      const next = await fetchSearchKeywords();
      setKeywords(next.keywords);
      setMaxJobs(next.default_max_jobs);
    } catch (exc) {
      toast.error(exc instanceof Error ? exc.message : "Could not load search keywords");
    }
  }

  function openModal(mode: "search" | "process") {
    setModalMode(mode);
    setModalOpen(true);
    void loadCatalog();
    if (mode === "search") void loadKeywords();
  }

  async function poll() {
    try {
      const state = await fetchRunStatus();
      setBanner(state);
      if (state.status === "running") {
        if (state.message) toast.info(state.message, { toastId: `run-${state.step || "running"}` });
        setTimeout(() => void poll(), 2000);
      } else if (state.status === "success") {
        toast.success(state.message || "Run complete");
        const url = new URL(window.location.href);
        url.searchParams.set("sort", "newest");
        url.searchParams.set("page", "1");
        window.location.href = url.toString();
      } else if (state.status === "error") {
        toast.error(state.message || state.error || "Run failed");
      }
    } catch (exc) {
      toast.error(exc instanceof Error ? exc.message : "Could not read run status");
    }
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (serverless) {
      toast.error(
        "Find jobs cannot run on Vercel. Use pnpm dev on your laptop, or host the Nest API on Railway, Render, or Fly.",
      );
      return;
    }
    const form = e.currentTarget;
    const fd = new FormData(form);
    const skipSearch = modalMode === "process";
    if (!skipSearch && !keywords.length) {
      toast.error("Add at least one search keyword");
      return;
    }
    const filters = {
      posted_within_hours: Number(fd.get("posted_within_hours") || 24),
      sort_by: String(fd.get("sort_by") || "DD"),
      easy_apply: Boolean(fd.get("easy_apply")),
      discover_external: Boolean(fd.get("discover_external")),
      under_10_applicants: Boolean(fd.get("under_10_applicants")),
      workplace: String(fd.get("workplace") || "include_remote"),
      skip_search: skipSearch,
      dry_run: false,
      max_jobs: skipSearch ? undefined : Math.max(1, Math.min(80, Math.round(Number(maxJobs)) || 20)),
      llm_provider: provider || null,
      llm_model: model || null,
      keywords: skipSearch ? null : keywords,
    };
    setBusy(true);
    setModalOpen(false);
    const res = await startRun(filters);
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.status === 409) {
      toast.info("A run is already in progress");
      setBanner(
        data.state || {
          status: "running",
          message: "A run is already in progress",
          step: "",
          started_at: null,
          finished_at: null,
          error: null,
          stats: {},
          log: [],
          filters,
        },
      );
      void poll();
      return;
    }
    if (!res.ok) {
      const msg = String(data.detail || data.message || `HTTP ${res.status}`);
      toast.error(msg);
      setBanner({
        status: "error",
        message: msg,
        step: "error",
        started_at: null,
        finished_at: null,
        error: String(data.detail || ""),
        stats: {},
        log: [],
        filters,
      });
      return;
    }
    toast.info(skipSearch ? "Scoring & tailoring started" : "Job search started");
    setBanner(
      data.state || {
        status: "running",
        message: "Pipeline started…",
        step: "starting",
        started_at: null,
        finished_at: null,
        error: null,
        stats: {},
        log: [],
        filters,
      },
    );
    setLogOpen(true);
    void poll();
  }

  const running = busy || banner?.status === "running";

  return (
    <>
      <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:justify-end">
        <AddJobButton disabled={running} />
        <button type="button" disabled={running} onClick={() => openModal("process")} className="btn-secondary w-full sm:w-auto">
          Score & tailor
        </button>
        <button
          type="button"
          disabled={running}
          onClick={() => openModal("search")}
          className="btn-primary col-span-2 w-full sm:col-auto sm:min-w-36 sm:w-auto"
        >
          {running ? (
            <>
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              Running…
            </>
          ) : (
            "Find new jobs"
          )}
        </button>
      </div>

      {banner && banner.status !== "idle" ? (
        <div
          className={`fixed top-[4.75rem] right-3 left-3 z-40 w-auto overflow-hidden rounded-2xl border bg-white shadow-xl sm:left-auto sm:right-4 sm:w-[min(24rem,calc(100vw-2rem))] ${banner.status === "running"
              ? "border-brand/30"
              : banner.status === "success"
                ? "border-emerald-200"
                : "border-rose-200"
            }`}
        >
          <div className="flex items-start justify-between gap-3 px-4 py-3">
            <div>
              <p className="text-sm font-semibold">
                {banner.status === "running"
                  ? banner.filters?.skip_search
                    ? "Scoring & tailoring"
                    : "Finding jobs"
                  : banner.status === "success"
                    ? "Run complete"
                    : "Run failed"}
              </p>
              <p className="mt-0.5 text-xs text-ink-muted">{banner.message || banner.error}</p>
            </div>
            <button type="button" className="btn-ghost h-8 w-8 p-0 text-lg" onClick={() => setBanner(null)} aria-label="Dismiss">
              ×
            </button>
          </div>
          {banner.status === "running" ? (
            <div className="h-1 overflow-hidden bg-brand-soft">
              <div className="h-full w-1/2 animate-pulse bg-brand" />
            </div>
          ) : null}
          {(banner.log || []).length ? (
            <div className="border-t border-line">
              <button type="button" className="w-full px-4 py-2 text-left text-xs font-medium text-ink-muted" onClick={() => setLogOpen((v) => !v)}>
                {logOpen ? "Hide log" : "Show log"}
              </button>
              {logOpen ? (
                <pre className="max-h-36 overflow-auto whitespace-pre-wrap bg-slate-50 px-4 pb-3 font-mono text-[0.7rem] leading-relaxed text-ink-muted">
                  {(banner.log || []).join("\n")}
                </pre>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {modalOpen ? (
        <Modal onClose={() => setModalOpen(false)}>
          <div className="max-h-[85vh] w-full overflow-y-auto rounded-3xl border border-line bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">
                  {modalMode === "process" ? "Score & tailor" : "Find new jobs"}
                </h2>
                <p className="mt-1 text-sm text-ink-muted">
                  {modalMode === "process"
                    ? "Fetch missing descriptions, score listings, and generate CV PDFs."
                    : "Search LinkedIn, then keep only titles that match your keywords. Off-target listings like AI Engineer are skipped."}{" "}
                  Free providers auto-switch if one hits a limit (never uses paid OpenAI).
                </p>
                {serverless ? (
                  <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                    This API is on Vercel serverless, which has no Chromium. Find jobs and PDF tailoring only work with{" "}
                    <code className="rounded bg-white/80 px-1">pnpm dev</code> locally, or a always-on Nest host (Railway, Render, Fly).
                  </p>
                ) : null}
              </div>
              <button type="button" className="btn-ghost h-9 w-9 p-0" onClick={() => setModalOpen(false)} aria-label="Close">
                ✕
              </button>
            </div>
            <form className="flex flex-col gap-4" onSubmit={submit}>
              <div className={modalMode === "process" ? "hidden" : "grid gap-4"}>
                <label className="grid gap-1.5 text-sm">
                  <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Search keywords</span>
                  <KeywordTagInput value={keywords} onChange={setKeywords} />
                  <span className="text-xs text-ink-muted">
                    Use the job titles you actually want (e.g. Frontend, React). LinkedIn still returns mixed results; we drop titles that are not a real match.
                  </span>
                </label>
                <label className="grid gap-1.5 text-sm">
                  <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Jobs this run</span>
                  <input
                    type="number"
                    name="max_jobs"
                    min={1}
                    max={80}
                    value={maxJobs}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      setMaxJobs(Number.isFinite(n) ? n : 20);
                    }}
                    className="field"
                  />
                  <span className="text-xs text-ink-muted">
                    Stop after this many on-target listings (1–80). Already-saved jobs are not counted.
                  </span>
                </label>
                <label className="grid gap-1.5 text-sm">
                  <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Date posted</span>
                  <select name="posted_within_hours" defaultValue="24" className="field">
                    <option value="24">Past 24 hours</option>
                    <option value="72">Past 3 days</option>
                    <option value="168">Past week</option>
                    <option value="720">Past month</option>
                  </select>
                </label>
                <label className="grid gap-1.5 text-sm">
                  <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Sort results</span>
                  <select name="sort_by" defaultValue="DD" className="field">
                    <option value="DD">Most recent first</option>
                    <option value="R">Most relevant</option>
                  </select>
                </label>
                <div className="space-y-2 rounded-2xl bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Apply type</p>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="easy_apply" defaultChecked className="accent-brand" />
                    Easy Apply only
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="discover_external" className="accent-brand" />
                    Also list external-apply jobs
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="under_10_applicants" className="accent-brand" />
                    Under 10 applicants
                  </label>
                </div>
                <label className="grid gap-1.5 text-sm">
                  <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Workplace</span>
                  <select name="workplace" defaultValue="include_remote" className="field">
                    <option value="include_remote">On-site / hybrid + remote pass</option>
                    <option value="remote_only">Remote only</option>
                    <option value="any">Any (no remote filter)</option>
                  </select>
                </label>
              </div>
              <div className="border-t border-line pt-4">
                <LlmProviderFields
                  catalog={catalog}
                  provider={provider}
                  model={model}
                  onProvider={setProvider}
                  onModel={setModel}
                />
              </div>
              <div className="mt-1 flex justify-end gap-2 border-t border-line pt-4">
                <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={serverless}>
                  {modalMode === "process" ? "Start score & tailor" : "Start search"}
                </button>
              </div>
            </form>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
