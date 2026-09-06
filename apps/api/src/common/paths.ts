import { copyFileSync, existsSync, mkdirSync } from "fs";
import { join, resolve } from "path";

/** True on Vercel (and similar read-only serverless hosts). */
export function isServerlessRuntime(): boolean {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
}

function findProjectRoot(): string {
  const candidates = [
    process.env.PROJECT_ROOT,
    // Self-contained API package (config copied under apps/api for Vercel root=apps/api)
    join(__dirname, "..", ".."),
    process.cwd(),
    join(process.cwd(), "..", ".."),
    join(__dirname, "..", "..", "..", ".."),
    join(__dirname, "..", "..", ".."),
  ].filter(Boolean) as string[];

  for (const dir of candidates) {
    const root = resolve(dir);
    if (existsSync(join(root, "config", "roles.yaml"))) {
      return root;
    }
  }
  return resolve(process.cwd());
}

export const PROJECT_ROOT = findProjectRoot();
export const CONFIG_DIR = join(PROJECT_ROOT, "config");

/**
 * Writable data directory. On Vercel the deployment FS is read-only except /tmp,
 * so we keep SQLite + outputs under /tmp while still reading config from the bundle.
 */
function resolveDataDir(): string {
  if (process.env.DATA_DIR) return resolve(process.env.DATA_DIR);
  if (isServerlessRuntime()) return resolve("/tmp/job-automator/data");
  return join(PROJECT_ROOT, "data");
}

export const DATA_DIR = resolveDataDir();
export const OUTPUTS_DIR = join(DATA_DIR, "outputs");
export const DB_PATH = join(DATA_DIR, "app.db");
export const ROLES_CONFIG = join(CONFIG_DIR, "roles.yaml");
export const PREFERENCES_CONFIG = join(CONFIG_DIR, "preferences.yaml");
export const MASTER_RESUME_YAML = join(DATA_DIR, "master_resume.yaml");
export const BROWSER_PROFILE = join(DATA_DIR, "browser_profile");

/** Seed resume YAML shipped with the API package (read-only on Vercel). */
const BUNDLED_MASTER_RESUME = join(PROJECT_ROOT, "data", "master_resume.yaml");

export function ensureDataDirs(): void {
  mkdirSync(DATA_DIR, { recursive: true });
  mkdirSync(OUTPUTS_DIR, { recursive: true });
  mkdirSync(BROWSER_PROFILE, { recursive: true });

  // Seed master resume into the writable data dir when missing (serverless /tmp).
  if (!existsSync(MASTER_RESUME_YAML) && existsSync(BUNDLED_MASTER_RESUME)) {
    copyFileSync(BUNDLED_MASTER_RESUME, MASTER_RESUME_YAML);
  }
}

export function defaultDatabaseUrl(): string {
  return process.env.DATABASE_URL || `file:${DB_PATH}`;
}
