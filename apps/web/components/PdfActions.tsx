export function PdfActions({
  href,
  downloadName,
}: {
  href: string;
  downloadName: string;
}) {
  const downloadHref = href.includes("?") ? `${href}&download=1` : `${href}?download=1`;
  return (
    <div className="flex shrink-0 flex-wrap gap-2">
      <a
        className="btn-secondary no-underline px-3 py-1.5 text-xs"
        href={href}
        target="_blank"
        rel="noopener noreferrer"
      >
        View
      </a>
      <a className="btn-secondary no-underline px-3 py-1.5 text-xs" href={downloadHref} download={downloadName}>
        Download
      </a>
    </div>
  );
}
