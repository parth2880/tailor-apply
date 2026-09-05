import { existsSync, mkdirSync } from "fs";
import { join, resolve } from "path";

function findProjectRoot(): string {
  const candidates = [
    process.env.PROJECT_ROOT,
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
export const DATA_DIR = join(PROJECT_ROOT, "data");
export const OUTPUTS_DIR = join(DATA_DIR, "outputs");
export const DB_PATH = join(DATA_DIR, "app.db");
export const ROLES_CONFIG = join(CONFIG_DIR, "roles.yaml");
export const PREFERENCES_CONFIG = join(CONFIG_DIR, "preferences.yaml");
export const MASTER_RESUME_YAML = join(DATA_DIR, "master_resume.yaml");
export const BROWSER_PROFILE = join(DATA_DIR, "browser_profile");

export function ensureDataDirs(): void {
  mkdirSync(DATA_DIR, { recursive: true });
  mkdirSync(OUTPUTS_DIR, { recursive: true });
  mkdirSync(BROWSER_PROFILE, { recursive: true });
}
