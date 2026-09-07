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
import { explainScore, scoreJob, statusAfterScore } from "../matching/scorer";
import { contentDisposition, psDownloadName } from "../resume/filename";
import { getCoverLetterPdf } from "../resume/cover-pdf";
import { getScoringResume } from "../resume/scoring-resume";
import { tailorJob } from "../resume/tailor";
import { LLMError } from "../llm/llm";

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
    res.setHeader("Content-Disposition", contentDisposition(psDownloadName(job.title)));
    createReadStream(job.tailoredResumePdfPath).pipe(res);
  }

  @Get(":id/scoring-resume.pdf")
  async scoringResumePdf(
    @Param("id", ParseIntPipe) id: number,
    @Query("download") download: string | undefined,
    @Res() res: Response,
  ) {
    const job = await this.jobs.get(id);
    if (!job) throw new NotFoundException("Job not found");
    try {
      const resume = await getScoringResume(job);
      if (!resume || !existsSync(resume.pdfPath)) {
        throw new NotFoundException("No resume was used for scoring");
      }
      const asDownload = download === "1" || download === "true";
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", contentDisposition(resume.filename, asDownload ? "attachment" : "inline"));
      createReadStream(resume.pdfPath).pipe(res);
    } catch (exc) {
      if (exc instanceof NotFoundException) throw exc;
      const msg = exc instanceof Error ? exc.message : String(exc);
      throw new HttpException(msg, HttpStatus.BAD_GATEWAY);
    }
  }

  @Get(":id/cover.pdf")
  async coverPdf(
    @Param("id", ParseIntPipe) id: number,
    @Query("download") download: string | undefined,
    @Res() res: Response,
  ) {
    const job = await this.jobs.get(id);
    if (!job) throw new NotFoundException("Job not found");
    try {
      const cover = await getCoverLetterPdf(job);
      if (!cover || !existsSync(cover.path)) throw new NotFoundException("Cover letter not found");
      const asDownload = download === "1" || download === "true";
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", contentDisposition(cover.filename, asDownload ? "attachment" : "inline"));
      createReadStream(cover.path).pipe(res);
    } catch (exc) {
      if (exc instanceof NotFoundException) throw exc;
      const msg = exc instanceof Error ? exc.message : String(exc);
      throw new HttpException(msg, HttpStatus.BAD_GATEWAY);
    }
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
