import { copyFileSync, existsSync, mkdirSync } from "fs";
import { join, resolve } from "path";

/** True on Vercel (and similar read-only serverless hosts). */
export function isServerlessRuntime(): boolean {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
}

function walkParents(start: string, depth = 8): string[] {
  const out: string[] = [];
  let dir = resolve(start);
  for (let i = 0; i < depth; i++) {
    out.push(dir);
    const parent = resolve(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  return out;
}

/**
 * Prefer the monorepo root (`pnpm-workspace.yaml` + `config/roles.yaml`) so local
 * data always lives in `<repo>/data`. `apps/api` also has a copied `config/` for
 * Vercel — do not treat that as the root when the workspace is present, or jobs
 * and the LinkedIn profile split across two folders and look like they vanished.
 */
function findProjectRoot(): string {
  if (process.env.PROJECT_ROOT) return resolve(process.env.PROJECT_ROOT);

  const starts = [
    process.cwd(),
    join(__dirname, "..", "..", "..", ".."),
    join(__dirname, "..", ".."),
  ];
  const seen = new Set<string>();
  const dirs: string[] = [];
  for (const start of starts) {
    for (const dir of walkParents(start)) {
      if (seen.has(dir)) continue;
      seen.add(dir);
      dirs.push(dir);
    }
  }

  const monorepo = dirs.find(
    (d) => existsSync(join(d, "pnpm-workspace.yaml")) && existsSync(join(d, "config", "roles.yaml")),
  );
  if (monorepo) return monorepo;

  const packaged = dirs.find((d) => existsSync(join(d, "config", "roles.yaml")));
  if (packaged) return packaged;

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
  const raw = (process.env.DATABASE_URL || "").trim();
  if (!raw) return `file:${DB_PATH}`;
  const relativeSqlite =
    raw.startsWith("file:") && !raw.startsWith("file:/") && !/^file:[A-Za-z]:/.test(raw);
  if (relativeSqlite) return `file:${DB_PATH}`;
  return raw;
}
