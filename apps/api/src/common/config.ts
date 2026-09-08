import { readFileSync } from "fs";
import { config as loadDotenv } from "dotenv";
import { join } from "path";
import * as yaml from "js-yaml";
import { PREFERENCES_CONFIG, PROJECT_ROOT, ROLES_CONFIG, ensureDataDirs } from "./paths";

loadDotenv({ path: join(PROJECT_ROOT, ".env") });

export type RolesConfig = {
  titles: string[];
  skills: string[];
  location: string;
  locations: string[];
  remote_ok: boolean;
  relocation_target: string;
  location_prefer_keywords: string[];
  location_avoid_keywords: string[];
  posted_within_hours: number;
  min_match_score: number;
  max_jobs_per_run: number;
};

export type PreferencesConfig = {
  exclude_keywords: string[];
  seniority_prefer: string[];
  search_delay_seconds_min: number;
  search_delay_seconds_max: number;
  detail_delay_seconds_min: number;
  detail_delay_seconds_max: number;
  generate_cover_letter: boolean;
  master_resume_path: string;
  resume_template: string;
  resume_page_format: string;
  linkedin_base_url: string;
  browser_profile_dir: string;
  headless: boolean;
  search_easy_apply_filter: boolean;
  discover_external_apply: boolean;
  linkedin_remote_filter: boolean;
  search_remote_pass: boolean;
};

export type AppSettings = {
  llm_provider: string;
  llm_model?: string;
  llm_base_url?: string;
  groq_api_key?: string;
  gemini_api_key?: string;
  openai_api_key?: string;
  openai_model: string;
};

const rolesDefaults: RolesConfig = {
  titles: [],
  skills: [],
  location: "Europe",
  locations: [],
  remote_ok: true,
  relocation_target: "any",
  location_prefer_keywords: [],
  location_avoid_keywords: [],
  posted_within_hours: 24,
  min_match_score: 55,
  max_jobs_per_run: 20,
};

const prefsDefaults: PreferencesConfig = {
  exclude_keywords: [],
  seniority_prefer: [],
  search_delay_seconds_min: 2,
  search_delay_seconds_max: 5,
  detail_delay_seconds_min: 1.5,
  detail_delay_seconds_max: 4,
  generate_cover_letter: true,
  master_resume_path: "data/master_resume.yaml",
  resume_template: "european",
  resume_page_format: "A4",
  linkedin_base_url: "https://www.linkedin.com",
  browser_profile_dir: "data/browser_profile",
  headless: false,
  search_easy_apply_filter: true,
  discover_external_apply: true,
  linkedin_remote_filter: false,
  search_remote_pass: true,
};

function loadYaml(path: string): Record<string, unknown> {
  try {
    const data = yaml.load(readFileSync(path, "utf8"));
    return data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

let rolesCache: RolesConfig | null = null;
let prefsCache: PreferencesConfig | null = null;

export function getRolesConfig(): RolesConfig {
  ensureDataDirs();
  if (!rolesCache) {
    rolesCache = { ...rolesDefaults, ...loadYaml(ROLES_CONFIG) } as RolesConfig;
  }
  return rolesCache;
}

function parseEnvBool(raw?: string): boolean | undefined {
  if (raw == null || raw.trim() === "") return undefined;
  const text = raw.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(text)) return true;
  if (["0", "false", "no", "off"].includes(text)) return false;
  return undefined;
}

export function getPreferences(): PreferencesConfig {
  ensureDataDirs();
  if (!prefsCache) {
    prefsCache = { ...prefsDefaults, ...loadYaml(PREFERENCES_CONFIG) } as PreferencesConfig;
    const headlessEnv = parseEnvBool(process.env.HEADLESS ?? process.env.PLAYWRIGHT_HEADLESS);
    if (headlessEnv !== undefined) prefsCache.headless = headlessEnv;
  }
  return prefsCache;
}

export function getSettings(): AppSettings {
  return {
    llm_provider: (process.env.LLM_PROVIDER || "groq").trim().toLowerCase(),
    llm_model: process.env.LLM_MODEL || undefined,
    llm_base_url: process.env.LLM_BASE_URL || undefined,
    groq_api_key: process.env.GROQ_API_KEY || undefined,
    gemini_api_key: process.env.GEMINI_API_KEY || undefined,
    openai_api_key: process.env.OPENAI_API_KEY || undefined,
    openai_model: process.env.OPENAI_MODEL || "gpt-4o-mini",
  };
}

export function reloadConfigs(): void {
  rolesCache = null;
  prefsCache = null;
}

export function searchLocations(roles: RolesConfig): string[] {
  if (roles.locations?.length) return roles.locations;
  return roles.location ? [roles.location] : ["Europe"];
}
