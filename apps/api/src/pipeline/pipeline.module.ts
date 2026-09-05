import { Module } from "@nestjs/common";
import { JobsModule } from "../jobs/jobs.module";
import { PipelineController } from "./pipeline.controller";
import { PipelineRunner } from "./runner";

@Module({
  imports: [JobsModule],
  controllers: [PipelineController],
  providers: [PipelineRunner],
  exports: [PipelineRunner],
})
export class PipelineModule {}
