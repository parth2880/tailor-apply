"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import {
  activateResume,
  createResume,
  deleteResume,
  fetchLlmProviders,
  fetchResumes,
  ResumeList,
} from "@/lib/api";
import { LlmCatalog } from "@/lib/types";
import { LlmProviderFields } from "./LlmProviderFields";
import { Modal } from "./Modal";

const FILE_ACCEPT = ".pdf,.txt,.md,.yaml,.yml,application/pdf,text/plain,text/markdown,text/yaml";

function nameFromFile(file: File): string {
  return file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
}

export function ResumeSwitcher() {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [list, setList] = useState<ResumeList | null>(null);
  const [catalog, setCatalog] = useState<LlmCatalog | null>(null);
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const active = list?.profiles.find((p) => p.active);

  async function load() {
    try {
      setList(await fetchResumes());
    } catch (exc) {
      toast.error(exc instanceof Error ? exc.message : "Could not load resumes");
    }
  }

  useEffect(() => {
    void load();
  }, []);

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

  function openDialog() {
    setOpen(true);
    setAdding(false);
    void load();
    void loadCatalog();
  }

  function takeFile(next: File | null) {
    if (!next) {
      setFile(null);
      return;
    }
    const lower = next.name.toLowerCase();
    if (lower.endsWith(".doc") || lower.endsWith(".docx")) {
      toast.error("Word files are not supported. Export a PDF or copy the text, then add it.");
      return;
    }
    const ok = /\.(pdf|txt|md|ya?ml)$/i.test(next.name);
    if (!ok) {
      toast.error("Choose a PDF, .txt, .md, or .yaml file from your computer.");
      return;
    }
    setFile(next);
    setName((prev) => prev.trim() || nameFromFile(next));
  }

  async function useProfile(id: string) {
    setBusy(true);
    try {
      const next = await activateResume(id);
      setList(next);
      toast.success("This resume is now used for score and tailor");
    } catch (exc) {
      toast.error(exc instanceof Error ? exc.message : "Could not switch resume");
    } finally {
      setBusy(false);
    }
  }

  async function removeProfile(id: string) {
    if (!window.confirm("Remove this resume profile?")) return;
    setBusy(true);
    try {
      setList(await deleteResume(id));
      toast.success("Resume removed");
    } catch (exc) {
      toast.error(exc instanceof Error ? exc.message : "Could not delete resume");
    } finally {
      setBusy(false);
    }
  }

  async function submitAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() && !file) {
      toast.error("Choose a file from your computer, or paste the CV text");
      return;
    }
    setBusy(true);
    try {
      const next = await createResume({
        name,
        text,
        file,
        llm_provider: provider || null,
        llm_model: model || null,
      });
      setList(next);
      setAdding(false);
      setName("");
      setText("");
      setFile(null);
      toast.success("Resume added and set as active. New score/tailor runs will use it.");
    } catch (exc) {
      toast.error(exc instanceof Error ? exc.message : "Could not add resume");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className="btn-secondary w-full sm:w-auto" onClick={openDialog}>
        <span className="max-w-40 truncate">{active?.name || "Resumes"}</span>
      </button>
      {open ? (
        <Modal maxWidth="xl" onClose={() => !busy && setOpen(false)}>
          <div className="max-h-[90vh] w-full overflow-y-auto rounded-3xl border border-line bg-white p-4 shadow-2xl sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold tracking-tight sm:text-xl">Resumes</h2>
                <p className="mt-1 text-sm text-ink-muted">
                  Score, tailor, and cover letters use the active profile. Existing job PDFs stay as they are until you re-tailor.
                </p>
              </div>
              <button type="button" className="btn-ghost h-9 w-9 p-0" disabled={busy} onClick={() => setOpen(false)} aria-label="Close">
                ✕
              </button>
            </div>

            {adding ? (
              <form className="grid gap-4" onSubmit={(e) => void submitAdd(e)}>
                <label className="grid gap-1.5 text-sm">
                  <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Profile name</span>
                  <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Backend profile" />
                </label>

                <div className="grid gap-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">From this computer</span>
                  <input
                    ref={fileRef}
                    className="sr-only"
                    type="file"
                    accept={FILE_ACCEPT}
                    onChange={(e) => {
                      takeFile(e.target.files?.[0] || null);
                      e.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => fileRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOver(false);
                      takeFile(e.dataTransfer.files?.[0] || null);
                    }}
                    className={`flex min-h-28 w-full flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed px-4 py-5 text-center transition ${
                      dragOver ? "border-brand bg-brand-soft" : "border-line bg-slate-50 hover:border-brand/50 hover:bg-brand-soft/50"
                    }`}
                  >
                    <span className="text-sm font-semibold text-ink">Choose file from computer</span>
                    <span className="text-xs text-ink-muted">PDF, .txt, .md, or .yaml — or drop it here</span>
                    {file ? (
                      <span className="mt-2 max-w-full truncate text-sm font-medium text-brand">{file.name}</span>
                    ) : null}
                  </button>
                  {file ? (
                    <button
                      type="button"
                      className="justify-self-start text-xs font-medium text-ink-muted underline"
                      onClick={() => setFile(null)}
                    >
                      Clear file
                    </button>
                  ) : null}
                </div>

                <label className="grid gap-1.5 text-sm">
                  <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Or paste CV text</span>
                  <textarea
                    className="field min-h-28"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Optional if you already chose a file. Paste the full resume, or YAML."
                  />
                </label>
                <LlmProviderFields catalog={catalog} provider={provider} model={model} onProvider={setProvider} onModel={setModel} />
                <div className="flex justify-end gap-2 border-t border-line pt-4">
                  <button type="button" className="btn-secondary" disabled={busy} onClick={() => setAdding(false)}>
                    Back
                  </button>
                  <button type="submit" className="btn-primary" disabled={busy}>
                    {busy ? "Saving…" : "Save and use"}
                  </button>
                </div>
              </form>
            ) : (
              <>
                <ul className="grid gap-2">
                  {(list?.profiles || []).map((p) => (
                    <li
                      key={p.id}
                      className={`rounded-2xl border px-3 py-3 ${p.active ? "border-brand/40 bg-brand-soft" : "border-line bg-slate-50"}`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-ink">
                            {p.name}
                            {p.active ? <span className="ml-2 text-xs font-medium uppercase tracking-wide text-brand">Active</span> : null}
                          </p>
                          {p.headline ? <p className="mt-0.5 text-xs text-ink-muted">{p.headline}</p> : null}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {p.active ? null : (
                            <button type="button" className="btn-secondary" disabled={busy} onClick={() => void useProfile(p.id)}>
                              Use this
                            </button>
                          )}
                          {p.source === "imported" ? (
                            <button type="button" className="btn-ghost text-rose-700" disabled={busy} onClick={() => void removeProfile(p.id)}>
                              Delete
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex justify-end border-t border-line pt-4">
                  <button type="button" className="btn-primary" disabled={busy} onClick={() => setAdding(true)}>
                    Add resume
                  </button>
                </div>
              </>
            )}
          </div>
        </Modal>
      ) : null}
    </>
  );
}
