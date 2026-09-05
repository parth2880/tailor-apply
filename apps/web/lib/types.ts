export type Job = {
  id: number;
  linkedin_job_id: string;
  title: string;
  company: string;
  location: string;
  url: string;
  posted_text: string;
  description: string;
  match_score: number | null;
  match_rationale: string;
  status: string;
  is_easy_apply: boolean;
  tailored_resume_md_path: string | null;
  tailored_resume_pdf_path: string | null;
  cover_letter_path: string | null;
  apply_error: string;
  applied_at: string | null;
  created_at: string;
  updated_at: string;
  cover?: string;
  resume_md?: string;
};

export type JobsResponse = {
  jobs: Job[];
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
  counts: Record<string, number>;
  showing_from: number;
  showing_to: number;
};

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

export type LlmCatalog = {
  active_provider: string;
  active_model?: string;
  most_tokens: string | null;
  most_tokens_label: string | null;
  providers: {
    id: string;
    label: string;
    models: string[];
    default_model: string;
    recommended_model: string;
    cost: string;
    token_score: number;
    token_note: string;
    configured: boolean;
    active_default: boolean;
  }[];
};
