import { Body, Controller, Get, HttpException, HttpStatus, Post } from "@nestjs/common";
import { BROWSER_UNAVAILABLE_MESSAGE } from "../common/browser";
import { isServerlessRuntime } from "../common/paths";
import { PipelineRunner } from "./runner";
import { parseSearchOptions } from "./search-options";
import { listLlmProviders } from "../llm/llm";
import { getRolesConfig } from "../common/config";

@Controller("api")
export class PipelineController {
  constructor(private readonly runner: PipelineRunner) {}

  @Get("llm/providers")
  providers() {
    return listLlmProviders();
  }

  @Get("search/keywords")
  keywords() {
    const roles = getRolesConfig();
    return {
      keywords: [...(roles.titles || [])],
      default_max_jobs: roles.max_jobs_per_run || 20,
    };
  }

  @Get("run/status")
  status() {
    return this.runner.getState();
  }

  @Post("run")
  start(@Body() body: Record<string, unknown>) {
    if (isServerlessRuntime()) {
      throw new HttpException(
        {
          detail: BROWSER_UNAVAILABLE_MESSAGE,
          message: BROWSER_UNAVAILABLE_MESSAGE,
          code: "BROWSER_UNAVAILABLE",
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    const options = parseSearchOptions(body);
    console.log(`Portal run filters: ${JSON.stringify(options)}`);
    const result = this.runner.start(options, true);
    if (!result.ok && result.reason === "already_running") {
      throw new HttpException(
        { detail: "A run is already in progress", state: result.state },
        HttpStatus.CONFLICT,
      );
    }
    return result;
  }
}
