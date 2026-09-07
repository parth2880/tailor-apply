import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Res,
} from "@nestjs/common";
import type { Response } from "express";
import { createReadStream, existsSync, readFileSync } from "fs";
import { JobsService } from "./jobs.service";
import { toJobDto } from "./job.mapper";
import { JOB_STATUSES, JobStatus, JobStatusValue } from "../common/job-status";
import {
  candidateResumeText,
  explainScore,
  RESUME_LABELS,
  scoreJob,
  statusAfterScore,
} from "../matching/scorer";
import { contentDisposition, tailoredResumeDownloadName } from "../resume/filename";
import { tailorJob } from "../resume/tailor";
import { LLMError } from "../llm/llm";

function scoringResumeFilename(title: string, source: "tailored" | "master"): string {
  if (source === "tailored") return tailoredResumeDownloadName(title, "md");
  return "master_resume.md";
}

type CreateManualBody = {
  title?: string;
  company?: string;
  location?: string;
  url?: string;
  description?: string;
  is_easy_apply?: boolean;
  /** If true, score and generate tailored PDF immediately */
  process?: boolean;
};

const DEFAULT_PER_PAGE = 25;
const ALLOWED_PER_PAGE = new Set([10, 25, 50, 100]);

function parseEasyApply(value?: string): boolean | null {
  if (!value || value === "all") return null;
  if (value === "easy") return true;
  if (value === "external") return false;
  return null;
}

function parseHasResume(value?: string): boolean | null {
  if (!value || value === "all") return null;
  if (value === "yes") return true;
  if (value === "no") return false;
  return null;
}

@Controller("api/jobs")
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Post()
  async createManual(@Body() body: CreateManualBody) {
    try {
      let job = await this.jobs.createManual({
        title: body.title || "",
        company: body.company,
        location: body.location,
        url: body.url,
        description: body.description || "",
        isEasyApply: body.is_easy_apply,
      });
      if (body.process) {
        if (job.matchScore == null) {
          const [score, rationale] = await scoreJob(job, undefined, true);
          await this.jobs.updateScore(job.id, score, rationale, JobStatus.SCORED);
          job = (await this.jobs.get(job.id))!;
        }
        try {
          job = await tailorJob(this.jobs, job);
        } catch (exc) {
          const msg = exc instanceof LLMError || exc instanceof Error ? exc.message : String(exc);
          throw new HttpException(
            {
              message: `Job saved (id ${job.id}) but tailor failed: ${msg}`,
              job: toJobDto(job),
            },
            HttpStatus.BAD_GATEWAY,
          );
        }
      }
      return toJobDto(job);
    } catch (exc) {
      if (exc instanceof HttpException) throw exc;
      const msg = exc instanceof Error ? exc.message : String(exc);
      throw new HttpException(msg, HttpStatus.BAD_REQUEST);
    }
  }

  @Get()
  async list(
    @Query("status") status?: string,
    @Query("min_score") minScore?: string,
    @Query("max_score") maxScore?: string,
    @Query("q") q?: string,
    @Query("company") company?: string,
    @Query("location") location?: string,
    @Query("apply_type") applyType = "all",
    @Query("has_resume") hasResume = "all",
    @Query("sort") sort = "newest",
    @Query("page") page = "1",
    @Query("per_page") perPage = String(DEFAULT_PER_PAGE),
  ) {
    const filters = {
      status: status || null,
      q: q || null,
      company: company || null,
      location: location || null,
      minScore: minScore ? Number(minScore) : null,
      maxScore: maxScore ? Number(maxScore) : null,
      easyApply: parseEasyApply(applyType),
      hasResume: parseHasResume(hasResume),
    };
    const sortVal = ["newest", "oldest", "score_desc", "score_asc", "updated"].includes(sort)
      ? sort
      : "newest";
    const perPageNum = ALLOWED_PER_PAGE.has(Number(perPage)) ? Number(perPage) : DEFAULT_PER_PAGE;
    const total = await this.jobs.count(filters);
    const totalPages = total ? Math.max(1, Math.ceil(total / perPageNum)) : 1;
    const pageVal = Math.min(Math.max(1, Number(page) || 1), totalPages);
    const offset = (pageVal - 1) * perPageNum;
    const rows = await this.jobs.list(filters, sortVal, perPageNum, offset);
    const counts = {
      all: await this.jobs.count(),
      ready: await this.jobs.count({ status: "ready" }),
      scored: await this.jobs.count({ status: "scored" }),
      applied: await this.jobs.count({ status: "applied" }),
      needs_review: await this.jobs.count({ status: "needs_review" }),
      skipped: await this.jobs.count({ status: "skipped" }),
      new: await this.jobs.count({ status: "new" }),
      not_easy_apply: await this.jobs.count({ status: "not_easy_apply" }),
    };
    return {
      jobs: rows.map(toJobDto),
      page: pageVal,
      per_page: perPageNum,
      total,
      total_pages: totalPages,
      counts,
      showing_from: rows.length ? offset + 1 : 0,
      showing_to: offset + rows.length,
    };
  }

  @Post(":id/score")
  async scoreOne(@Param("id", ParseIntPipe) id: number) {
    const job = await this.jobs.get(id);
    if (!job) throw new NotFoundException("Job not found");
    const [score, rationale] = await scoreJob(job, undefined, true);
    await this.jobs.updateScore(id, score, rationale, statusAfterScore(job));
    const updated = await this.jobs.get(id);
    return toJobDto(updated!);
  }

  @Post(":id/tailor")
  async tailorOne(@Param("id", ParseIntPipe) id: number) {
    let job = await this.jobs.get(id);
    if (!job) throw new NotFoundException("Job not found");
    if (job.matchScore == null) {
      const [score, rationale] = await scoreJob(job, undefined, true);
      await this.jobs.updateScore(id, score, rationale, JobStatus.SCORED);
      job = (await this.jobs.get(id))!;
    }
    try {
      const tailored = await tailorJob(this.jobs, job);
      const [score, rationale] = await scoreJob(tailored, undefined, true);
      await this.jobs.updateScore(tailored.id, score, rationale, JobStatus.READY);
      const updated = await this.jobs.get(tailored.id);
      return toJobDto(updated!);
    } catch (exc) {
      const msg = exc instanceof LLMError || exc instanceof Error ? exc.message : String(exc);
      throw new HttpException(msg, HttpStatus.BAD_GATEWAY);
    }
  }

  @Get(":id/resume.pdf")
  async resumePdf(@Param("id", ParseIntPipe) id: number, @Res() res: Response) {
    const job = await this.jobs.get(id);
    if (!job?.tailoredResumePdfPath || !existsSync(job.tailoredResumePdfPath)) {
      throw new NotFoundException("PDF not found");
    }
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", contentDisposition(tailoredResumeDownloadName(job.title)));
    createReadStream(job.tailoredResumePdfPath).pipe(res);
  }

  /** Markdown resume that was (or would be) used when scoring this job. */
  @Get(":id/scoring-resume")
  async scoringResume(@Param("id", ParseIntPipe) id: number) {
    const job = await this.jobs.get(id);
    if (!job) throw new NotFoundException("Job not found");
    const resume = candidateResumeText(job);
    if (resume.source === "none" || !resume.text.trim()) {
      throw new NotFoundException("No resume available for scoring");
    }
    return {
      content: resume.text,
      source: resume.source,
      label: RESUME_LABELS[resume.source],
      filename: scoringResumeFilename(job.title, resume.source),
    };
  }

  @Get(":id/scoring-resume.md")
  async scoringResumeDownload(@Param("id", ParseIntPipe) id: number, @Res() res: Response) {
    const job = await this.jobs.get(id);
    if (!job) throw new NotFoundException("Job not found");
    const resume = candidateResumeText(job);
    if (resume.source === "none" || !resume.text.trim()) {
      throw new NotFoundException("No resume available for scoring");
    }
    const filename = scoringResumeFilename(job.title, resume.source);
    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.setHeader("Content-Disposition", contentDisposition(filename, "attachment"));
    res.send(resume.text);
  }

  @Get(":id")
  async one(@Param("id", ParseIntPipe) id: number) {
    const job = await this.jobs.get(id);
    if (!job) throw new NotFoundException("Job not found");
    let cover = "";
    let resume_md = "";
    if (job.coverLetterPath && existsSync(job.coverLetterPath)) {
      cover = readFileSync(job.coverLetterPath, "utf8");
    }
    if (job.tailoredResumeMdPath && existsSync(job.tailoredResumeMdPath)) {
      resume_md = readFileSync(job.tailoredResumeMdPath, "utf8");
    }
    return { ...toJobDto(job), cover, resume_md, score_breakdown: explainScore(job) };
  }

  @Post(":id/status/:status")
  async setStatus(
    @Param("id", ParseIntPipe) id: number,
    @Param("status") status: string,
  ) {
    const st = status.toLowerCase() as JobStatusValue;
    if (!JOB_STATUSES.includes(st)) {
      throw new HttpException("Invalid status", HttpStatus.BAD_REQUEST);
    }
    try {
      const job = await this.jobs.setStatus(id, st);
      return toJobDto(job);
    } catch {
      throw new NotFoundException("Job not found");
    }
  }
}
