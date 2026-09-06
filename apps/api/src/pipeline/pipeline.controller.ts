import { Body, Controller, Get, HttpException, HttpStatus, Post } from "@nestjs/common";
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
    return { keywords: [...(roles.titles || [])] };
  }

  @Get("run/status")
  status() {
    return this.runner.getState();
  }

  @Post("run")
  start(@Body() body: Record<string, unknown>) {
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
