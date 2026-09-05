"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "react-toastify";
import { createManualJob } from "@/lib/api";
import { Modal } from "./Modal";

type Props = {
  disabled?: boolean;
};

export function AddJobButton({ disabled }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const title = String(fd.get("title") || "").trim();
    const description = String(fd.get("description") || "").trim();
    if (!title) {
      toast.error("Title is required");
      return;
    }
    if (description.length <= 40) {
      toast.error("Paste a full job description (more than 40 characters)");
      return;
    }
    setBusy(true);
    try {
      const job = await createManualJob({
        title,
        company: String(fd.get("company") || "").trim() || undefined,
        location: String(fd.get("location") || "").trim() || undefined,
        url: String(fd.get("url") || "").trim() || undefined,
        description,
        is_easy_apply: Boolean(fd.get("is_easy_apply")),
        process: Boolean(fd.get("process")),
      });
      toast.success("Job added");
      setOpen(false);
      router.push(`/jobs/${job.id}`);
      router.refresh();
    } catch (err) {
      const withJob = err as Error & { job?: { id: number } };
      toast.error(withJob.message || "Could not add job");
      if (withJob.job?.id) {
        setTimeout(() => {
          router.push(`/jobs/${withJob.job!.id}`);
          router.refresh();
        }, 1800);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" disabled={disabled || busy} onClick={() => setOpen(true)} className="btn-secondary">
        Add job
      </button>

      {open ? (
        <Modal maxWidth="xl" onClose={() => !busy && setOpen(false)}>
            <div className="max-h-[90vh] w-full overflow-y-auto rounded-3xl border border-line bg-white p-6 shadow-2xl">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight">Add job manually</h2>
                  <p className="mt-1 text-sm text-ink-muted">
                    Paste a JD from LinkedIn or anywhere else. Optionally score and generate a tailored CV right away.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-ghost h-9 w-9 p-0"
                  disabled={busy}
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>

              <form className="flex flex-col gap-4" onSubmit={submit}>
                <label className="grid gap-1.5 text-sm">
                  <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                    Title <span className="text-rose-500">*</span>
                  </span>
                  <input name="title" required className="field" placeholder="e.g. Senior Frontend Engineer" />
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-1.5 text-sm">
                    <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Company</span>
                    <input name="company" className="field" placeholder="Company name" />
                  </label>
                  <label className="grid gap-1.5 text-sm">
                    <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Location</span>
                    <input name="location" className="field" placeholder="e.g. Remote / Berlin" />
                  </label>
                </div>

                <label className="grid gap-1.5 text-sm">
                  <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Job URL</span>
                  <input name="url" type="url" className="field" placeholder="https://www.linkedin.com/jobs/view/…" />
                </label>

                <label className="grid gap-1.5 text-sm">
                  <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                    Job description <span className="text-rose-500">*</span>
                  </span>
                  <textarea
                    name="description"
                    required
                    rows={12}
                    className="field min-h-48 resize-y font-mono text-[0.8rem] leading-relaxed"
                    placeholder="Paste the full job description here…"
                  />
                </label>

                <div className="space-y-2 rounded-2xl bg-slate-50 p-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="is_easy_apply" defaultChecked className="accent-brand" />
                    Easy Apply / I can apply myself on LinkedIn
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="process" defaultChecked className="accent-brand" />
                    Score & tailor CV now
                  </label>
                </div>

                <div className="flex justify-end gap-2 border-t border-line pt-4">
                  <button type="button" className="btn-secondary" disabled={busy} onClick={() => setOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary min-w-32" disabled={busy}>
                    {busy ? (
                      <>
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                        Working…
                      </>
                    ) : (
                      "Add job"
                    )}
                  </button>
                </div>
              </form>
            </div>
        </Modal>
      ) : null}
    </>
  );
}
