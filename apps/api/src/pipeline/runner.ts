import { Injectable } from "@nestjs/common";
import { BrowserUnavailableError, BROWSER_UNAVAILABLE_MESSAGE, isPlaywrightMissing } from "../common/browser";
import { JobsService } from "../jobs/jobs.service";
import { JobStatus } from "../common/job-status";
import { getRolesConfig, reloadConfigs } from "../common/config";
import { clearFailoverLog, clearLlmOverride, getFailoverLog, setLlmOverride } from "../llm/llm";
import { runPipeline } from "./pipeline";
import { SearchOptions, defaultSearchOptions, summarizeOptions } from "./search-options";

export type RunState = {
  status: "idle" | "running" | "success" | "error";
  message: string;
  step: string;
  started_at: string | null;
  finished_at: string | null;
  error: string | null;
  stats: Record<string, unknown>;
  log: string[];
  filters: Record<string, unknown>;
};

function emptyState(): RunState {
  return {
    status: "idle",
    message: "",
    step: "",
    started_at: null,
    finished_at: null,
    error: null,
    stats: {},
    log: [],
    filters: {},
  };
}

@Injectable()
export class PipelineRunner {
  private state: RunState = emptyState();
  private running = false;

  constructor(private readonly jobs: JobsService) {}

  getState(): RunState {
    return { ...this.state, log: this.state.log.slice(-40) };
  }

  private appendLog(line: string) {
    this.state.log.push(line);
    if (this.state.log.length > 200) this.state.log = this.state.log.slice(-200);
  }

  start(options?: SearchOptions, useLlm = true) {
    const opts = options || defaultSearchOptions();
    if (this.running || this.state.status === "running") {
      return { ok: false, reason: "already_running", state: this.getState() };
    }
    const now = new Date().toISOString();
    this.running = true;
    this.state = {
      status: "running",
      message: `Pipeline started (${summarizeOptions(opts)})`,
      step: "starting",
      started_at: now,
      finished_at: null,
      error: null,
      stats: {},
      filters: { ...opts },
      log: [`[${now}] Run requested from portal`, `Filters: ${summarizeOptions(opts)}`],
    };
    void this.worker(opts, useLlm);
    return { ok: true, state: this.getState() };
  }

  private async worker(options: SearchOptions, useLlm: boolean) {
    try {
      clearFailoverLog();
      if (options.llm_provider) {
        setLlmOverride(options.llm_provider, options.llm_model);
        this.appendLog(`LLM: ${options.llm_provider} / ${options.llm_model || "default"} (free auto-failover on)`);
      } else {
        this.appendLog("LLM: auto free-provider failover enabled (Groq → Gemini → Ollama)");
      }
      reloadConfigs();
      const beforeTotal = await this.jobs.count();
      const beforeNew = await this.jobs.count({ status: JobStatus.NEW });
      const beforeReady = await this.jobs.count({ status: JobStatus.READY });
      this.state.step = "search";
      this.state.message = `Searching LinkedIn… (${summarizeOptions(options)})`;
      this.appendLog("Step 1/3: search");

      await runPipeline(this.jobs, {
        dryRun: options.dry_run,
        skipSearch: options.skip_search,
        skipTailor: false,
        useLlm,
        searchOptions: options,
        onProgress: (step, message) => {
          this.state.step = step;
          this.state.message = message;
          this.appendLog(message);
        },
      });

      const afterTotal = await this.jobs.count();
      const afterNew = await this.jobs.count({ status: JobStatus.NEW });
      const afterReady = await this.jobs.count({ status: JobStatus.READY });
      const afterScored = await this.jobs.count({ status: JobStatus.SCORED });
      const discovered = Math.max(0, afterTotal - beforeTotal);
      const roles = getRolesConfig();
      const stats = {
        before_total: beforeTotal,
        after_total: afterTotal,
        discovered,
        ready: afterReady,
        new: afterNew,
        scored: afterScored,
        ready_delta: afterReady - beforeReady,
        new_delta: afterNew - beforeNew,
        min_match_score: roles.min_match_score,
        filters: { ...options },
      };
      const msg = `Done. Discovered ${discovered} new listing(s). Queue: ${afterTotal} total · ${afterReady} ready · ${afterScored} scored.`;
      for (const line of getFailoverLog()) this.appendLog(line);
      this.appendLog(msg);
      this.state = {
        ...this.state,
        status: "success",
        message: msg,
        step: "done",
        finished_at: new Date().toISOString(),
        error: null,
        stats,
      };
    } catch (exc) {
      const err = `${exc instanceof Error ? exc.constructor.name : "Error"}: ${exc instanceof Error ? exc.message : exc}`;
      this.appendLog(err);
      if (exc instanceof Error && exc.stack) this.appendLog(exc.stack.slice(-1500));
      const friendly =
        exc instanceof BrowserUnavailableError
          ? exc.message
          : isPlaywrightMissing(exc)
            ? BROWSER_UNAVAILABLE_MESSAGE
            : "Pipeline failed. Check the log and LinkedIn login.";
      this.state.status = "error";
      this.state.message = friendly;
      this.state.step = "error";
      this.state.finished_at = new Date().toISOString();
      this.state.error = err;
    } finally {
      this.running = false;
      clearLlmOverride();
    }
  }
}
