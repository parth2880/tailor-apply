import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { defaultDatabaseUrl, ensureDataDirs } from "../common/paths";

const CREATE_JOBS_SQL = `
CREATE TABLE IF NOT EXISTS "jobs" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "linkedin_job_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "company" TEXT NOT NULL DEFAULT '',
  "location" TEXT NOT NULL DEFAULT '',
  "url" TEXT NOT NULL,
  "posted_text" TEXT NOT NULL DEFAULT '',
  "description" TEXT NOT NULL DEFAULT '',
  "match_score" INTEGER,
  "match_rationale" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'new',
  "is_easy_apply" INTEGER NOT NULL DEFAULT 1,
  "tailored_resume_md_path" TEXT,
  "tailored_resume_pdf_path" TEXT,
  "cover_letter_path" TEXT,
  "apply_error" TEXT NOT NULL DEFAULT '',
  "applied_at" TEXT,
  "created_at" TEXT NOT NULL DEFAULT '',
  "updated_at" TEXT NOT NULL DEFAULT ''
);
CREATE UNIQUE INDEX IF NOT EXISTS "jobs_linkedin_job_id_key" ON "jobs"("linkedin_job_id");
CREATE INDEX IF NOT EXISTS "idx_jobs_status" ON "jobs"("status");
CREATE INDEX IF NOT EXISTS "idx_jobs_score" ON "jobs"("match_score");
CREATE INDEX IF NOT EXISTS "idx_jobs_easy_apply" ON "jobs"("is_easy_apply");
`;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    ensureDataDirs();
    const url = defaultDatabaseUrl();
    process.env.DATABASE_URL = url;
    super({ datasources: { db: { url } } });
  }

  async onModuleInit(): Promise<void> {
    // Serverless /tmp SQLite starts empty — ensure schema exists without needing prisma CLI.
    for (const stmt of CREATE_JOBS_SQL.split(";").map((s) => s.trim()).filter(Boolean)) {
      await this.$executeRawUnsafe(stmt);
    }
    this.logger.log("Database ready");
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
