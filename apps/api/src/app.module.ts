import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { JobsModule } from "./jobs/jobs.module";
import { PipelineModule } from "./pipeline/pipeline.module";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [PrismaModule, JobsModule, PipelineModule],
  controllers: [HealthController],
})
export class AppModule {}
