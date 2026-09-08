import { Controller, Get } from "@nestjs/common";
import { isServerlessRuntime, PROJECT_ROOT, DATA_DIR, defaultDatabaseUrl } from "./common/paths";
import { PrismaService } from "./prisma/prisma.service";

@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  private async payload() {
    let jobs = 0;
    try {
      jobs = await this.prisma.job.count();
    } catch {
      jobs = -1;
    }
    return {
      ok: true,
      service: "job-automator-api",
      serverless: isServerlessRuntime(),
      project_root: PROJECT_ROOT,
      data_dir: DATA_DIR,
      database_configured: Boolean(defaultDatabaseUrl()),
      jobs,
      linkedin_search: !isServerlessRuntime(),
      note: isServerlessRuntime()
        ? "Running on serverless: SQLite is ephemeral (/tmp). LinkedIn search is not supported here — use pnpm dev locally, or Railway/Render/Fly for the API."
        : undefined,
    };
  }

  @Get()
  root() {
    return this.payload();
  }

  @Get("health")
  health() {
    return this.payload();
  }

  @Get("api/health")
  apiHealth() {
    return this.payload();
  }
}
