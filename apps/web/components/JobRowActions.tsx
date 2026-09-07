"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "react-toastify";
import { scoreJob, tailorJob } from "@/lib/api";
import { psDownloadName } from "@/lib/resume-filename";

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
  variant = "icons",
  showDetails = true,
}: {
  jobId: number;
  jobTitle: string;
  linkedinUrl: string;
  hasPdf: boolean;
  variant?: "icons" | "stack" | "header";
  showDetails?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"score" | "tailor" | null>(null);

  async function run(kind: "score" | "tailor") {
    setBusy(kind);
    try {
      if (kind === "score") {
        await scoreJob(jobId);
        toast.success("Job scored");
      } else {
        await tailorJob(jobId);
        toast.success("Tailored PDF ready");
      }
      router.refresh();
    } catch (exc) {
      toast.error(exc instanceof Error ? exc.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  if (variant === "stack" || variant === "header") {
    return (
      <div className={variant === "header" ? "flex flex-wrap items-center gap-2" : "flex flex-col gap-2"}>
        <button
          type="button"
          className="btn-secondary"
          disabled={busy !== null}
          onClick={() => run("score")}
        >
          {busy === "score" ? "Scoring…" : "Score"}
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={busy !== null}
          onClick={() => run("tailor")}
        >
          {busy === "tailor" ? "Tailoring…" : "Tailor PDF"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-nowrap items-center gap-1.5">
      <IconButton label="Score" busy={busy === "score"} disabled={busy !== null} onClick={() => run("score")}>
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 19V5M4 19h16" />
          <path d="M8 15l3-4 3 2 5-7" />
        </svg>
      </IconButton>
      <IconButton label="Tailor PDF" busy={busy === "tailor"} disabled={busy !== null} onClick={() => run("tailor")}>
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
  );
}
