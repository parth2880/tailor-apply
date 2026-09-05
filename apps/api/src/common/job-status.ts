export const JobStatus = {
  NEW: "new",
  SCORED: "scored",
  READY: "ready",
  APPLIED: "applied",
  SKIPPED: "skipped",
  NEEDS_REVIEW: "needs_review",
  NOT_EASY_APPLY: "not_easy_apply",
} as const;

export type JobStatusValue = (typeof JobStatus)[keyof typeof JobStatus];

export const JOB_STATUSES = Object.values(JobStatus);

export type JobDto = {
  id: number;
  linkedin_job_id: string;
  title: string;
  company: string;
  location: string;
  url: string;
  posted_text: string;
  description: string;
  match_score: number | null;
  match_rationale: string;
  status: string;
  is_easy_apply: boolean;
  tailored_resume_md_path: string | null;
  tailored_resume_pdf_path: string | null;
  cover_letter_path: string | null;
  apply_error: string;
  applied_at: string | null;
  created_at: string;
  updated_at: string;
};

export function nowIso(): string {
  return new Date().toISOString().slice(0, 19);
}
