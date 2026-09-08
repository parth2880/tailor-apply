export type SearchOptions = {
  easy_apply: boolean;
  discover_external: boolean;
  posted_within_hours: number;
  sort_by: "DD" | "R";
  under_10_applicants: boolean;
  workplace: "remote_only" | "include_remote" | "any";
  skip_search: boolean;
  dry_run: boolean;
  max_jobs: number;
  llm_provider?: string | null;
  llm_model?: string | null;
  keywords?: string[] | null;
};

function asBool(value: unknown, fallback: boolean): boolean {
  if (value == null) return fallback;
  if (typeof value === "boolean") return value;
  const text = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(text)) return true;
  if (["0", "false", "no", "off", ""].includes(text)) return false;
  return fallback;
}

export function defaultSearchOptions(
  extra: Partial<SearchOptions> = {},
): SearchOptions {
  return {
    easy_apply: true,
    discover_external: false,
    posted_within_hours: 24,
    sort_by: "DD",
    under_10_applicants: false,
    workplace: "include_remote",
    skip_search: false,
    dry_run: false,
    max_jobs: extra.max_jobs ?? 20,
    llm_provider: null,
    llm_model: null,
    keywords: extra.keywords ?? null,
    ...extra,
  };
}

export function parseSearchOptions(data?: Record<string, unknown> | null): SearchOptions {
  if (!data) return defaultSearchOptions();
  let hours = Number(data.posted_within_hours ?? 24);
  if (!Number.isFinite(hours)) hours = 24;
  let sortBy = String(data.sort_by || "DD").toUpperCase();
  if (sortBy !== "DD" && sortBy !== "R") sortBy = "DD";
  let workplace = String(data.workplace || "include_remote");
  if (!["remote_only", "include_remote", "any"].includes(workplace)) {
    workplace = "include_remote";
  }
  let provider = data.llm_provider ? String(data.llm_provider).trim().toLowerCase() : null;
  if (provider && !["groq", "gemini", "ollama", "openai"].includes(provider)) {
    provider = null;
  }
  let model = data.llm_model ? String(data.llm_model).trim() : null;
  if (!model) model = null;
  let maxJobs = Number(data.max_jobs ?? 20);
  if (!Number.isFinite(maxJobs)) maxJobs = 20;
  const rawKeywords = Array.isArray(data.keywords) ? data.keywords : [];
  const keywords = [
    ...new Set(
      rawKeywords
        .map((k) => String(k || "").trim())
        .filter((k) => k.length > 0 && k.length <= 80),
    ),
  ];
  return defaultSearchOptions({
    easy_apply: asBool(data.easy_apply, true),
    discover_external: asBool(data.discover_external, false),
    posted_within_hours: Math.max(1, Math.min(720, hours)),
    sort_by: sortBy as "DD" | "R",
    under_10_applicants: asBool(data.under_10_applicants, false),
    workplace: workplace as SearchOptions["workplace"],
    skip_search: asBool(data.skip_search, false),
    dry_run: asBool(data.dry_run, false),
    max_jobs: Math.max(1, Math.min(80, Math.round(maxJobs))),
    llm_provider: provider,
    llm_model: model,
    keywords: keywords.length ? keywords : null,
  });
}

export function summarizeOptions(options: SearchOptions): string {
  const bits = [
    `up to ${options.max_jobs} jobs`,
    `past ${options.posted_within_hours}h`,
    options.easy_apply ? "Easy Apply only" : "all apply types",
    options.sort_by === "DD" ? "sort=date" : "sort=relevance",
  ];
  if (options.under_10_applicants) bits.push("<10 applicants");
  if (options.workplace === "remote_only") bits.push("remote only");
  else if (options.workplace === "include_remote") bits.push("on-site + remote pass");
  if (options.discover_external && options.easy_apply) bits.push("+ external listings");
  if (options.llm_provider) {
    bits.push(`llm=${options.llm_provider}/${options.llm_model || "default"}`);
  }
  if (options.keywords?.length) bits.push(`${options.keywords.length} keyword(s)`);
  return bits.join(", ");
}
