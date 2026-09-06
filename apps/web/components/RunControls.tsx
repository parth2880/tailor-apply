"use client";

import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { fetchLlmProviders, fetchRunStatus, startRun } from "@/lib/api";
import { LlmCatalog, RunState } from "@/lib/types";
import { AddJobButton } from "./AddJobButton";
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

  useEffect(() => {
    if (initialStatus === "running") {
      void poll();
    }
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

  function openModal(mode: "search" | "process") {
    setModalMode(mode);
    setModalOpen(true);
    void loadCatalog();
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
    const form = e.currentTarget;
    const fd = new FormData(form);
    const skipSearch = modalMode === "process";
    const filters = {
      posted_within_hours: Number(fd.get("posted_within_hours") || 24),
      sort_by: String(fd.get("sort_by") || "DD"),
      easy_apply: Boolean(fd.get("easy_apply")),
      discover_external: Boolean(fd.get("discover_external")),
      under_10_applicants: Boolean(fd.get("under_10_applicants")),
      workplace: String(fd.get("workplace") || "include_remote"),
      skip_search: skipSearch,
      dry_run: false,
      llm_provider: provider || null,
      llm_model: model || null,
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

  const selected = catalog?.providers.find((p) => p.id === provider);
  const running = busy || banner?.status === "running";
  const retired: Record<string, boolean> = {
    "gemini-2.0-flash": true,
    "llama-3.3-70b-versatile": true,
    "llama-3.1-8b-instant": true,
  };

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
                    : "Search LinkedIn with these filters, then score and tailor."}{" "}
                  Free providers auto-switch if one hits a limit (never uses paid OpenAI).
                </p>
              </div>
              <button type="button" className="btn-ghost h-9 w-9 p-0" onClick={() => setModalOpen(false)} aria-label="Close">
                ✕
              </button>
            </div>
            <form className="flex flex-col gap-4" onSubmit={submit}>
              <div className={modalMode === "process" ? "hidden" : "grid gap-4"}>
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
              <fieldset className="space-y-3 border-t border-line pt-4">
                <legend className="text-xs font-semibold uppercase tracking-wide text-ink-muted">LLM for score & tailor</legend>
                {catalog?.most_tokens_label ? (
                  <p className="text-xs text-ink-muted">
                    Most free tokens: <strong className="text-ink">{catalog.most_tokens_label}</strong>
                    {(catalog as { auto_failover?: boolean }).auto_failover !== false
                      ? " · Auto-failover across free providers is on."
                      : null}
                  </p>
                ) : null}
                <div className="grid gap-2">
                  {(catalog?.providers || []).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      disabled={!p.configured}
                      onClick={() => {
                        setProvider(p.id);
                        setModel(p.recommended_model || p.default_model);
                      }}
                      className={`rounded-2xl border px-3 py-2.5 text-left text-sm transition disabled:opacity-45 ${provider === p.id ? "border-brand bg-brand-soft" : "border-line bg-white hover:border-brand/30"
                        }`}
                    >
                      <div className="flex justify-between gap-2">
                        <div>
                          <strong>{p.label}</strong>
                          <span className="text-ink-muted"> · {p.cost}</span>
                          <div className="mt-0.5 text-xs text-ink-muted">{p.token_note}</div>
                        </div>
                        <span className="tabular-nums text-xs text-ink-muted">{p.token_score}/100</span>
                      </div>
                    </button>
                  ))}
                </div>
                <label className="grid gap-1.5 text-sm">
                  <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Model</span>
                  <select value={model} onChange={(e) => setModel(e.target.value)} className="field">
                    {(selected?.models || []).map((m) => (
                      <option key={m} value={m} disabled={retired[m]}>
                        {m}
                        {m === selected?.default_model ? " (recommended)" : ""}
                        {retired[m] ? " — retired" : ""}
                      </option>
                    ))}
                  </select>
                </label>
              </fieldset>
              <div className="mt-1 flex justify-end gap-2 border-t border-line pt-4">
                <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
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
