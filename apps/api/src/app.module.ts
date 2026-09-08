import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { JobsModule } from "./jobs/jobs.module";
import { PipelineModule } from "./pipeline/pipeline.module";
import { PrismaModule } from "./prisma/prisma.module";
import { ResumesController } from "./resume/resumes.controller";

@Module({
  imports: [PrismaModule, JobsModule, PipelineModule],
  controllers: [HealthController, ResumesController],
})
export class AppModule {}
