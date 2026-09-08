import { Job, Prisma } from "@prisma/client";
import { JobDto, JobStatus, JobStatusValue, nowIso } from "../common/job-status";

export function toJobDto(job: Job): JobDto {
  return {
    id: job.id,
    linkedin_job_id: job.linkedinJobId,
    title: job.title,
    company: job.company,
    location: job.location,
    url: job.url,
    posted_text: job.postedText,
    description: job.description,
    match_score: job.matchScore,
    match_rationale: job.matchRationale,
    status: job.status,
    is_easy_apply: Boolean(job.isEasyApply),
    tailored_resume_md_path: job.tailoredResumeMdPath,
    tailored_resume_pdf_path: job.tailoredResumePdfPath,
    cover_letter_path: job.coverLetterPath,
    apply_error: job.applyError,
    applied_at: job.appliedAt,
    created_at: job.createdAt,
    updated_at: job.updatedAt,
    last_seen_at: job.lastSeenAt || job.createdAt,
  };
}

export type JobFilters = {
  status?: string | null;
  minScore?: number | null;
  maxScore?: number | null;
  q?: string | null;
  company?: string | null;
  location?: string | null;
  easyApply?: boolean | null;
  hasResume?: boolean | null;
};

export function buildWhere(filters: JobFilters): Prisma.JobWhereInput {
  const where: Prisma.JobWhereInput = {};
  if (filters.status) where.status = filters.status;
  else where.status = { not: JobStatus.SKIPPED };
  if (filters.minScore != null || filters.maxScore != null) {
    where.matchScore = {};
    if (filters.minScore != null) where.matchScore.gte = filters.minScore;
    if (filters.maxScore != null) where.matchScore.lte = filters.maxScore;
  }
  if (filters.q?.trim()) {
    const q = filters.q.trim();
    where.OR = [
      { title: { contains: q } },
      { company: { contains: q } },
      { location: { contains: q } },
      { description: { contains: q } },
      { matchRationale: { contains: q } },
      { postedText: { contains: q } },
    ];
  }
  if (filters.company?.trim()) {
    where.company = { contains: filters.company.trim() };
  }
  if (filters.location?.trim()) {
    where.location = { contains: filters.location.trim() };
  }
  if (filters.easyApply === true) where.isEasyApply = 1;
  if (filters.easyApply === false) where.isEasyApply = 0;
  if (filters.hasResume === true) where.tailoredResumePdfPath = { not: null };
  if (filters.hasResume === false) where.tailoredResumePdfPath = null;
  return where;
}

export function orderByFor(sort: string): Prisma.JobOrderByWithRelationInput[] {
  switch (sort) {
    case "oldest":
      return [{ createdAt: "asc" }, { id: "asc" }];
    case "score_desc":
      return [{ matchScore: "desc" }, { createdAt: "desc" }];
    case "score_asc":
      return [{ matchScore: "asc" }, { createdAt: "desc" }];
    case "updated":
      return [{ updatedAt: "desc" }, { id: "desc" }];
    default:
      return [{ lastSeenAt: "desc" }, { createdAt: "desc" }, { id: "desc" }];
  }
}

export { nowIso, JobStatus };
export type { JobStatusValue };
