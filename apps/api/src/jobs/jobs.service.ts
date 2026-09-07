import { Injectable } from "@nestjs/common";
import { Job, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { JobStatus, JobStatusValue, nowIso } from "../common/job-status";
import { JobFilters, buildWhere, orderByFor } from "./job.mapper";

function fromSqliteRow(row: Record<string, unknown>): Job {
  return {
    id: Number(row.id),
    linkedinJobId: String(row.linkedin_job_id),
    title: String(row.title ?? ""),
    company: String(row.company ?? ""),
    location: String(row.location ?? ""),
    url: String(row.url ?? ""),
    postedText: String(row.posted_text ?? ""),
    description: String(row.description ?? ""),
    matchScore: row.match_score == null ? null : Number(row.match_score),
    matchRationale: String(row.match_rationale ?? ""),
    status: String(row.status),
    isEasyApply: Number(row.is_easy_apply ?? 1),
    tailoredResumeMdPath: (row.tailored_resume_md_path as string) ?? null,
    tailoredResumePdfPath: (row.tailored_resume_pdf_path as string) ?? null,
    coverLetterPath: (row.cover_letter_path as string) ?? null,
    applyError: String(row.apply_error ?? ""),
    appliedAt: (row.applied_at as string) ?? null,
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

@Injectable()
export class JobsService {
  constructor(private readonly prisma: PrismaService) {}

  get(id: number) {
    return this.prisma.job.findUnique({ where: { id } });
  }

  list(filters: JobFilters, sort = "newest", limit = 100, offset = 0) {
    return this.prisma.job.findMany({
      where: buildWhere(filters),
      orderBy: orderByFor(sort),
      take: Math.max(0, limit),
      skip: Math.max(0, offset),
    });
  }

  count(filters: JobFilters = {}) {
    return this.prisma.job.count({ where: buildWhere(filters) });
  }

  async createManual(input: {
    title: string;
    company?: string;
    location?: string;
    url?: string;
    description: string;
    isEasyApply?: boolean;
  }): Promise<Job> {
    const title = input.title.trim();
    const description = input.description.trim();
    if (!title) throw new Error("Title is required");
    if (description.length <= 40) {
      throw new Error("Job description must be longer than 40 characters");
    }
    const linkedinJobId = `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const url = (input.url || "").trim() || `manual://local/${linkedinJobId}`;
    const easy = input.isEasyApply === false ? false : true;
    return this.upsertDiscovered({
      linkedinJobId,
      title,
      company: (input.company || "").trim(),
      location: (input.location || "").trim(),
      url,
      postedText: "Manual",
      description,
      isEasyApply: easy,
      status: easy ? JobStatus.NEW : JobStatus.NOT_EASY_APPLY,
    });
  }

  async upsertDiscovered(input: {
    linkedinJobId: string;
    title: string;
    company: string;
    location: string;
    url: string;
    postedText?: string;
    description?: string;
    isEasyApply?: boolean;
    status?: JobStatusValue;
  }): Promise<Job> {
    const now = nowIso();
    const easy = input.isEasyApply === false ? 0 : 1;
    const initialStatus =
      input.status ||
      (easy ? JobStatus.NEW : JobStatus.NOT_EASY_APPLY);
    const existing = await this.prisma.job.findUnique({
      where: { linkedinJobId: input.linkedinJobId },
    });
    if (existing) {
      let newStatus = existing.status;
      if (
        !existing.isEasyApply &&
        easy &&
        existing.status === JobStatus.NOT_EASY_APPLY
      ) {
        newStatus = JobStatus.NEW;
      } else if (
        input.status &&
        (existing.status === JobStatus.NEW ||
          existing.status === JobStatus.NOT_EASY_APPLY)
      ) {
        newStatus = input.status;
      }
      const desc = input.description || "";
      return this.prisma.job.update({
        where: { linkedinJobId: input.linkedinJobId },
        data: {
          title: input.title,
          company: input.company,
          location: input.location,
          url: input.url,
          postedText: input.postedText || existing.postedText,
          description:
            desc.length > (existing.description || "").length
              ? desc
              : existing.description,
          isEasyApply: easy ? 1 : existing.isEasyApply,
          status: newStatus,
          updatedAt: now,
        },
      });
    }
    return this.prisma.job.create({
      data: {
        linkedinJobId: input.linkedinJobId,
        title: input.title,
        company: input.company,
        location: input.location,
        url: input.url,
        postedText: input.postedText || "",
        description: input.description || "",
        status: initialStatus,
        isEasyApply: easy,
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  markSkipped(id: number, reason: string) {
    return this.prisma.job.update({
      where: { id },
      data: {
        status: JobStatus.SKIPPED,
        applyError: reason,
        updatedAt: nowIso(),
      },
    });
  }

  updateDescription(id: number, description: string) {
    return this.prisma.job.update({
      where: { id },
      data: { description, updatedAt: nowIso() },
    });
  }

  updateScore(
    id: number,
    score: number,
    rationale: string,
    status: JobStatusValue = JobStatus.SCORED,
  ) {
    return this.prisma.job.update({
      where: { id },
      data: {
        matchScore: score,
        matchRationale: rationale,
        status,
        updatedAt: nowIso(),
      },
    });
  }

  updateTailoredPaths(
    id: number,
    mdPath: string,
    pdfPath: string,
    coverLetterPath: string | null,
    status: JobStatusValue = JobStatus.READY,
  ) {
    return this.prisma.job.update({
      where: { id },
      data: {
        tailoredResumeMdPath: mdPath,
        tailoredResumePdfPath: pdfPath,
        coverLetterPath,
        status,
        updatedAt: nowIso(),
      },
    });
  }

  async setStatus(id: number, status: JobStatusValue) {
    const now = nowIso();
    const data: Prisma.JobUpdateInput = { status, updatedAt: now };
    if (status === JobStatus.APPLIED) {
      data.appliedAt = now;
    }
    return this.prisma.job.update({ where: { id }, data });
  }

  async listNeedingDescription(limit = 50): Promise<Job[]> {
    const rows = await this.prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT * FROM jobs
      WHERE status IN (${JobStatus.NEW}, ${JobStatus.NOT_EASY_APPLY})
        AND (description IS NULL OR length(trim(description)) <= 40)
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
    return rows.map(fromSqliteRow);
  }

  async listForScoring(limit = 50): Promise<Job[]> {
    const rows = await this.prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT * FROM jobs
      WHERE status IN (${JobStatus.NEW}, ${JobStatus.NOT_EASY_APPLY})
        AND length(description) > 40
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
    return rows.map(fromSqliteRow);
  }

  async listForTailoring(minScore: number, limit = 50): Promise<Job[]> {
    const rows = await this.prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT * FROM jobs
      WHERE status = ${JobStatus.SCORED} AND match_score >= ${minScore}
      ORDER BY match_score DESC
      LIMIT ${limit}
    `;
    return rows.map(fromSqliteRow);
  }

  countToday() {
    return this.prisma.$queryRaw<{ c: number }[]>`
      SELECT COUNT(*) AS c FROM jobs
      WHERE date(created_at) = date('now')
        AND status != ${JobStatus.SKIPPED}
    `.then((rows) => Number(rows[0]?.c ?? 0));
  }
}
