import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchJob } from "@/lib/api";
import { coverLetterDownloadName, psDownloadName } from "@/lib/resume-filename";
import { AppHeader } from "@/components/AppHeader";
import { ApplyBadge, ScoreBadge, StatusBadge } from "@/components/badges";
import { JobMatchTabs } from "@/components/JobMatchTabs";
import { StatusButtons } from "@/components/StatusButtons";

export default async function JobDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const jobId = Number(id);
  if (!Number.isFinite(jobId)) notFound();
  let job;
  try {
    job = await fetchJob(jobId);
  } catch {
    notFound();
  }

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-screen-2xl px-4 py-5 sm:px-8 sm:py-6">
        <p className="mb-5">
          <Link className="text-sm font-medium text-ink-muted no-underline hover:text-brand" href="/">
            ← Back to queue
          </Link>
        </p>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <article>
            <header className="mb-6 rounded-3xl border border-line bg-white p-4 shadow-sm sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <ScoreBadge score={job.match_score} />
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap gap-2">
                    <StatusBadge status={job.status} />
                    <ApplyBadge easy={job.is_easy_apply} />
                  </div>
                  <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{job.title}</h1>
                  <p className="mt-2 text-sm text-ink-muted">
                    <span className="font-medium text-ink">{job.company}</span>
                    <span className="mx-1.5">·</span>
                    {job.location || "—"}
                    <span className="mx-1.5">·</span>
                    {job.posted_text || "recent"}
                    {job.applied_at ? (
                      <>
                        <span className="mx-1.5">·</span>
                        Applied {job.applied_at}
                      </>
                    ) : null}
                  </p>
                  {job.apply_error ? <p className="mt-3 text-sm text-ink-muted">Note: {job.apply_error}</p> : null}
                </div>
              </div>
            </header>
            <JobMatchTabs job={job} />
            <section className="rounded-3xl border border-line bg-white p-4 shadow-sm sm:p-5">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-muted">Job description</h2>
              <pre className="m-0 whitespace-pre-wrap font-sans text-sm leading-relaxed text-ink/90">
                {job.description || "No description stored yet."}
              </pre>
            </section>
          </article>
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-3xl border border-line bg-white p-4 shadow-sm sm:p-5">
              <p className="text-sm font-semibold">Next steps</p>
              <p className="mt-1 text-xs text-ink-muted">Open LinkedIn to apply yourself. Mark the outcome here when you are done.</p>
              <div className="mt-4 flex flex-col gap-2">
                <a className="btn-primary no-underline" href={job.url} target="_blank" rel="noopener noreferrer">
                  Open on LinkedIn
                </a>
                {job.tailored_resume_pdf_path ? (
                  <a
                    className="btn-secondary no-underline"
                    href={`/api/jobs/${job.id}/resume.pdf`}
                    download={psDownloadName(job.title)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Save resume PDF
                  </a>
                ) : null}
                {job.cover ? (
                  <a
                    className="btn-secondary no-underline"
                    href={`/api/jobs/${job.id}/cover.pdf?download=1`}
                    download={coverLetterDownloadName(job.title)}
                  >
                    Save cover letter PDF
                  </a>
                ) : null}
                <StatusButtons jobId={job.id} />
              </div>
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}
