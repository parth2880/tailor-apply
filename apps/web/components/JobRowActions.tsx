"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "react-toastify";
import { fetchLlmProviders, scoreJob, tailorJob } from "@/lib/api";
import { psDownloadName } from "@/lib/resume-filename";
import { LlmCatalog } from "@/lib/types";
import { LlmProviderFields } from "./LlmProviderFields";
import { Modal } from "./Modal";

const iconBtn =
  "relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-slate-50 text-ink shadow-sm transition hover:border-brand/40 hover:bg-brand-soft hover:text-brand disabled:cursor-not-allowed disabled:opacity-40";

function Tooltip({ text, show }: { text: string; show: boolean }) {
  return (
    <span
      role="tooltip"
      className={`pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1 text-[0.7rem] font-medium text-white shadow-lg ${show ? "opacity-100" : "opacity-0"
        }`}
    >
      {text}
    </span>
  );
}

function IconButton({
  label,
  busy,
  disabled,
  onClick,
  children,
}: {
  label: string;
  busy?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const [show, setShow] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled || busy}
      onClick={onClick}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
      className={iconBtn}
    >
      <Tooltip text={label} show={show && !busy} />
      {busy ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-line border-t-brand" /> : children}
    </button>
  );
}

function IconLink({
  label,
  href,
  external,
  download,
  children,
}: {
  label: string;
  href: string;
  external?: boolean;
  download?: string;
  children: React.ReactNode;
}) {
  const [show, setShow] = useState(false);
  const className = `${iconBtn} no-underline`;
  const tip = <Tooltip text={label} show={show} />;
  const events = {
    onMouseEnter: () => setShow(true),
    onMouseLeave: () => setShow(false),
    onFocus: () => setShow(true),
    onBlur: () => setShow(false),
  };
  if (external) {
    return (
      <a
        href={href}
        aria-label={label}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        download={download}
        {...events}
      >
        {tip}
        {children}
      </a>
    );
  }
  return (
    <Link href={href} aria-label={label} className={className} {...events}>
      {tip}
      {children}
    </Link>
  );
}

export function JobRowActions({
  jobId,
  jobTitle,
  linkedinUrl,
  hasPdf,
  status,
  variant = "icons",
  showDetails = true,
}: {
  jobId: number;
  jobTitle: string;
  linkedinUrl: string;
  hasPdf: boolean;
  status?: string;
  variant?: "icons" | "stack" | "header";
  showDetails?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"score" | "tailor" | null>(null);
  const [tailorOpen, setTailorOpen] = useState(false);
  const [catalog, setCatalog] = useState<LlmCatalog | null>(null);
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");

  const applied = status === "applied";
  const skipped = status === "skipped";
  const hideScore = applied || skipped;
  const tailorLabel = hasPdf ? "Re-tailor PDF" : "Tailor PDF";

  async function openTailor() {
    setTailorOpen(true);
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

  async function run(kind: "score" | "tailor") {
    if (kind === "tailor") {
      await openTailor();
      return;
    }
    setBusy(kind);
    try {
      await scoreJob(jobId);
      toast.success("Job scored");
      router.refresh();
    } catch (exc) {
      toast.error(exc instanceof Error ? exc.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function confirmTailor() {
    if (!provider) {
      toast.error("Select an LLM provider");
      return;
    }
    setBusy("tailor");
    try {
      await tailorJob(jobId, { llm_provider: provider, llm_model: model || null });
      toast.success("Tailored PDF ready");
      setTailorOpen(false);
      router.refresh();
    } catch (exc) {
      toast.error(exc instanceof Error ? exc.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  const tailorModal = tailorOpen ? (
    <Modal onClose={() => busy !== "tailor" && setTailorOpen(false)}>
      <div className="max-h-[85vh] w-full overflow-y-auto rounded-3xl border border-line bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">{hasPdf ? "Re-tailor PDF" : "Tailor PDF"}</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Pick the model that will rewrite the CV for this job, then generate the PDF.
            </p>
          </div>
          <button
            type="button"
            className="btn-ghost h-9 w-9 p-0"
            disabled={busy === "tailor"}
            onClick={() => setTailorOpen(false)}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <LlmProviderFields
          catalog={catalog}
          provider={provider}
          model={model}
          onProvider={setProvider}
          onModel={setModel}
        />
        <div className="mt-5 flex justify-end gap-2 border-t border-line pt-4">
          <button type="button" className="btn-secondary" disabled={busy === "tailor"} onClick={() => setTailorOpen(false)}>
            Cancel
          </button>
          <button type="button" className="btn-primary" disabled={busy === "tailor" || !provider} onClick={() => void confirmTailor()}>
            {busy === "tailor" ? "Tailoring…" : "Generate PDF"}
          </button>
        </div>
      </div>
    </Modal>
  ) : null;

  if (variant === "stack" || variant === "header") {
    return (
      <>
        <div className={variant === "header" ? "flex flex-wrap items-center gap-2" : "flex flex-col gap-2"}>
          {hideScore ? null : (
            <button
              type="button"
              className="btn-secondary"
              disabled={busy !== null}
              onClick={() => run("score")}
            >
              {busy === "score" ? "Scoring…" : "Score"}
            </button>
          )}
          <button
            type="button"
            className="btn-secondary"
            disabled={busy !== null}
            onClick={() => run("tailor")}
          >
            {busy === "tailor" ? "Tailoring…" : tailorLabel}
          </button>
        </div>
        {tailorModal}
      </>
    );
  }

  return (
    <>
      <div className="flex flex-nowrap items-center gap-1.5">
      {hideScore ? null : (
      <IconButton label="Score" busy={busy === "score"} disabled={busy !== null} onClick={() => run("score")}>
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 19V5M4 19h16" />
          <path d="M8 15l3-4 3 2 5-7" />
        </svg>
      </IconButton>
      )}
      <IconButton label={tailorLabel} busy={busy === "tailor"} disabled={busy !== null} onClick={() => run("tailor")}>
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6" />
          <path d="M8 13h8M8 17h5" />
        </svg>
      </IconButton>
      {showDetails ? (
        <IconLink label="Details" href={`/jobs/${jobId}`}>
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v6M12 8h.01" />
          </svg>
        </IconLink>
      ) : null}
      {hasPdf ? (
        <IconLink
          label="Resume PDF"
          href={`/api/jobs/${jobId}/resume.pdf`}
          download={psDownloadName(jobTitle)}
          external
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 2h9l5 5v15H6z" />
            <path d="M15 2v5h5M8 13h8M8 17h5" />
          </svg>
        </IconLink>
      ) : null}
      <IconLink label="Open on LinkedIn" href={linkedinUrl} external>
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
          <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.47-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45zM22.23 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.46c.98 0 1.77-.77 1.77-1.73V1.73C24 .77 23.21 0 22.23 0z" />
        </svg>
      </IconLink>
    </div>
      {tailorModal}
    </>
  );
}
