const PREFIX = "PS";

function slugTitle(text: string): string {
  const cleaned = text
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return cleaned || "Job";
}

/** Download name, e.g. "PS-Senior-Frontend-Engineer.pdf" */
export function psDownloadName(title: string, opts?: { cover?: boolean; ext?: string }): string {
  const extra = opts?.cover ? "-cover" : "";
  return `${PREFIX}-${slugTitle(title)}${extra}.${opts?.ext || "pdf"}`;
}

/** @deprecated use psDownloadName */
export function tailoredResumeDownloadName(title: string, ext = "pdf"): string {
  return psDownloadName(title, { ext });
}

export function coverLetterDownloadName(title: string): string {
  return psDownloadName(title, { cover: true });
}

/** On-disk stem, unique per job */
export function tailoredResumeStem(job: { id: number; title: string }): string {
  return `${PREFIX}-${slugTitle(job.title)}-${job.id}`;
}

export function contentDisposition(filename: string, type: "inline" | "attachment" = "inline"): string {
  const ascii = filename.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "'");
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
