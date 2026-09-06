const PREFIX = "PS";

function sanitizeName(text: string): string {
  const cleaned = text
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "");
  return cleaned.slice(0, 80) || "Job";
}

/** Download / Save As name, e.g. "PS Senior Frontend Engineer.pdf" */
export function tailoredResumeDownloadName(title: string, ext = "pdf"): string {
  return `${PREFIX} ${sanitizeName(title)}.${ext}`;
}

/** On-disk stem, unique per job: "PS Senior Frontend Engineer 103" */
export function tailoredResumeStem(job: { id: number; title: string }): string {
  return `${PREFIX} ${sanitizeName(job.title)} ${job.id}`;
}

export function contentDisposition(filename: string, type: "inline" | "attachment" = "inline"): string {
  const ascii = filename.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "'");
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
