export function psDownloadName(title: string, opts?: { cover?: boolean }): string {
  const slug =
    title
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "Job";
  return opts?.cover ? `PS-${slug}-cover.pdf` : `PS-${slug}.pdf`;
}

export function tailoredResumeDownloadName(title: string): string {
  return psDownloadName(title);
}

export function coverLetterDownloadName(title: string): string {
  return psDownloadName(title, { cover: true });
}
