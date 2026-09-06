import { JobsResponse, Job, LlmCatalog, RunState } from "./types";

function apiBase(): string {
  if (typeof window === "undefined") {
    return process.env.API_URL || "http://127.0.0.1:3001";
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

async function postJobAction(id: number, action: "score" | "tailor"): Promise<Job> {
  const res = await fetch(`/api/jobs/${id}/${action}`, { method: "POST" });
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

export function tailorJob(id: number) {
  return postJobAction(id, "tailor");
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

export async function fetchLlmProviders(): Promise<LlmCatalog> {
  const res = await fetch("/api/llm/providers");
  if (!res.ok) throw new Error("llm");
  return res.json();
}

export async function fetchSearchKeywords(): Promise<string[]> {
  const res = await fetch("/api/search/keywords", { cache: "no-store" });
  if (!res.ok) throw new Error("Could not load search keywords");
  const data = (await res.json()) as { keywords?: string[] };
  return Array.isArray(data.keywords) ? data.keywords.filter(Boolean) : [];
}
