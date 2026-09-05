import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Command } from "commander";
import { config as loadDotenv } from "dotenv";
import { join } from "path";
import { AppModule } from "./app.module";
import { PROJECT_ROOT, ensureDataDirs } from "./common/paths";
import { JobsService } from "./jobs/jobs.service";
import { LinkedInSession } from "./linkedin/session";
import { runPipeline } from "./pipeline/pipeline";
import { defaultSearchOptions } from "./pipeline/search-options";
import { getRolesConfig } from "./common/config";

loadDotenv({ path: join(PROJECT_ROOT, ".env") });
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = `file:${join(PROJECT_ROOT, "data", "app.db")}`;
}

async function withApp<T>(fn: (jobs: JobsService) => Promise<T>): Promise<T> {
  ensureDataDirs();
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ["error", "warn"] });
  try {
    const jobs = app.get(JobsService);
    return await fn(jobs);
  } finally {
    await app.close();
  }
}

const program = new Command();
program.name("job-automator").description("NestJS LinkedIn job finder (search → score → tailor)");

program
  .command("login")
  .option("--timeout <seconds>", "Wait for manual LinkedIn login", "180")
  .action(async (opts) => {
    const session = new LinkedInSession({ headless: false });
    await session.start();
    try {
      await session.ensureLoggedIn(Number(opts.timeout) || 180);
      console.log("Login session saved to data/browser_profile");
    } finally {
      await session.close();
    }
  });

program
  .command("run")
  .option("--min-score <n>", "Override min match score")
  .option("--dry-run", "Search + score only", false)
  .action(async (opts) => {
    await withApp((jobs) =>
      runPipeline(jobs, {
        dryRun: Boolean(opts.dryRun),
        minScore: opts.minScore ? Number(opts.minScore) : undefined,
        searchOptions: defaultSearchOptions({
          posted_within_hours: getRolesConfig().posted_within_hours,
        }),
      }),
    );
  });

program
  .command("process")
  .option("--min-score <n>", "Override min match score")
  .action(async (opts) => {
    await withApp((jobs) =>
      runPipeline(jobs, {
        skipSearch: true,
        minScore: opts.minScore ? Number(opts.minScore) : undefined,
      }),
    );
  });

program.parseAsync(process.argv);
