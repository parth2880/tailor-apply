import { JobsResponse, Job, LlmCatalog, RunState } from "./types";

/** Server-side calls hit Nest directly; browser calls use same-origin /api (Next rewrite). */
function apiBase(): string {
  if (typeof window === "undefined") {
    return (process.env.API_URL || "http://127.0.0.1:3001").replace(/\/$/, "");
  }
  return "";
}

export async function fetchJobs(params: Record<string, string | undefined>): Promise<JobsResponse> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) qs.set(k, v);
  }
  const res = await fetch(`${apiBase()}/api/jobs?${qs.toString()}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`jobs ${res.status}`);
  return res.json();
}

export async function fetchJob(id: number): Promise<Job> {
  const res = await fetch(`${apiBase()}/api/jobs/${id}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Job not found");
  return res.json();
}

export async function setJobStatus(id: number, status: string): Promise<Job> {
  const res = await fetch(`/api/jobs/${id}/status/${status}`, { method: "POST" });
  if (!res.ok) throw new Error("Could not update status");
  return res.json();
}

async function postJobAction(
  id: number,
  action: "score" | "tailor",
  body?: Record<string, unknown>,
): Promise<Job> {
  const res = await fetch(`/api/jobs/${id}/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      typeof data.message === "string"
        ? data.message
        : typeof data.detail === "string"
          ? data.detail
          : `Could not ${action} job`;
    throw new Error(msg);
  }
  return data;
}

export function scoreJob(id: number) {
  return postJobAction(id, "score");
}

export function tailorJob(
  id: number,
  opts?: { llm_provider?: string | null; llm_model?: string | null },
) {
  return postJobAction(id, "tailor", opts);
}

export type CreateManualJobInput = {
  title: string;
  company?: string;
  location?: string;
  url?: string;
  description: string;
  is_easy_apply?: boolean;
  process?: boolean;
};

export async function createManualJob(input: CreateManualJobInput): Promise<Job> {
  const res = await fetch("/api/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(input),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      typeof data.message === "string"
        ? data.message
        : Array.isArray(data.message)
          ? data.message.join(", ")
          : typeof data.detail === "string"
            ? data.detail
            : "Could not add job";
    // Partial success: job saved but tailor failed
    if (data.job?.id) {
      const err = new Error(msg) as Error & { job?: Job };
      err.job = data.job;
      throw err;
    }
    throw new Error(msg);
  }
  return data;
}

export async function fetchRunStatus(): Promise<RunState> {
  const res = await fetch("/api/run/status");
  if (!res.ok) throw new Error("status");
  return res.json();
}

export async function startRun(body: Record<string, unknown>) {
  return fetch("/api/run", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
}

export async function fetchApiHealth(): Promise<{ serverless?: boolean; linkedin_search?: boolean; note?: string }> {
  const res = await fetch("/api/health", { cache: "no-store" });
  if (!res.ok) throw new Error("health");
  return res.json();
}

export async function fetchLlmProviders(): Promise<LlmCatalog> {
  const res = await fetch("/api/llm/providers");
  if (!res.ok) throw new Error("llm");
  return res.json();
}

export async function fetchSearchKeywords(): Promise<{ keywords: string[]; default_max_jobs: number }> {
  const res = await fetch("/api/search/keywords", { cache: "no-store" });
  if (!res.ok) throw new Error("Could not load search keywords");
  const data = (await res.json()) as { keywords?: string[]; default_max_jobs?: number };
  return {
    keywords: Array.isArray(data.keywords) ? data.keywords.filter(Boolean) : [],
    default_max_jobs: Number(data.default_max_jobs) > 0 ? Number(data.default_max_jobs) : 20,
  };
}

export type ResumeProfile = {
  id: string;
  name: string;
  headline: string;
  source: "seed" | "imported";
  active: boolean;
};

export type ResumeList = {
  active_id: string;
  profiles: ResumeProfile[];
};

async function parseResumeResponse(res: Response): Promise<ResumeList> {
  const data = (await res.json().catch(() => ({}))) as ResumeList & { message?: string; detail?: string };
  if (!res.ok) {
    throw new Error(typeof data.message === "string" ? data.message : typeof data.detail === "string" ? data.detail : "Resume request failed");
  }
  return data;
}

export async function fetchResumes(): Promise<ResumeList> {
  const res = await fetch("/api/resumes", { cache: "no-store" });
  return parseResumeResponse(res);
}

export async function createResume(input: {
  name: string;
  text?: string;
  file?: File | null;
  llm_provider?: string | null;
  llm_model?: string | null;
}): Promise<ResumeList> {
  const fd = new FormData();
  if (input.name) fd.set("name", input.name);
  if (input.text) fd.set("text", input.text);
  if (input.llm_provider) fd.set("llm_provider", input.llm_provider);
  if (input.llm_model) fd.set("llm_model", input.llm_model);
  if (input.file) fd.set("file", input.file);
  const res = await fetch("/api/resumes", { method: "POST", body: fd });
  return parseResumeResponse(res);
}

export async function activateResume(id: string): Promise<ResumeList> {
  const res = await fetch(`/api/resumes/${encodeURIComponent(id)}/activate`, { method: "POST" });
  return parseResumeResponse(res);
}

export async function deleteResume(id: string): Promise<ResumeList> {
  const res = await fetch(`/api/resumes/${encodeURIComponent(id)}`, { method: "DELETE" });
  return parseResumeResponse(res);
}
