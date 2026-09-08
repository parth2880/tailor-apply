import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import { join } from "path";
import * as yaml from "js-yaml";
import { MASTER_RESUME_YAML, RESUME_INDEX, RESUMES_DIR, ensureDataDirs } from "../common/paths";
import { chatJson } from "../llm/llm";
import { ResumeData, normalizeResume } from "./schema";

export const SEED_RESUME_ID = "master";

export type ResumeProfileMeta = {
  id: string;
  name: string;
  source: "seed" | "imported";
  file: string;
};

export type ResumeIndex = {
  activeId: string;
  profiles: ResumeProfileMeta[];
};

export type ResumeProfileDto = ResumeProfileMeta & {
  headline: string;
  active: boolean;
};

function emptyIndex(): ResumeIndex {
  return { activeId: SEED_RESUME_ID, profiles: [] };
}

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return base || `resume-${Date.now().toString(36)}`;
}

function uniqueId(index: ResumeIndex, name: string): string {
  const base = slugify(name);
  if (base === SEED_RESUME_ID) {
    let n = 2;
    while (index.profiles.some((p) => p.id === `${base}-${n}`)) n += 1;
    return `${base}-${n}`;
  }
  if (!index.profiles.some((p) => p.id === base)) return base;
  let n = 2;
  while (index.profiles.some((p) => p.id === `${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

function readYamlResume(path: string): ResumeData {
  if (!existsSync(path)) {
    throw new Error("Master resume not found. Add a resume in the Resumes dialog.");
  }
  const data = yaml.load(readFileSync(path, "utf8")) as ResumeData;
  return normalizeResume(data);
}

function seedName(): string {
  try {
    const data = readYamlResume(MASTER_RESUME_YAML);
    return data.name || "Master resume";
  } catch {
    return "Master resume";
  }
}

function ensureIndex(): ResumeIndex {
  ensureDataDirs();
  mkdirSync(RESUMES_DIR, { recursive: true });
  let index = emptyIndex();
  if (existsSync(RESUME_INDEX)) {
    try {
      index = JSON.parse(readFileSync(RESUME_INDEX, "utf8")) as ResumeIndex;
    } catch {
      index = emptyIndex();
    }
  }
  if (!Array.isArray(index.profiles)) index.profiles = [];
  if (!index.profiles.some((p) => p.id === SEED_RESUME_ID) && existsSync(MASTER_RESUME_YAML)) {
    index.profiles.unshift({
      id: SEED_RESUME_ID,
      name: seedName(),
      source: "seed",
      file: "master_resume.yaml",
    });
  }
  if (!index.profiles.length) {
    throw new Error("Master resume not found. Add a resume in the Resumes dialog.");
  }
  if (!index.profiles.some((p) => p.id === index.activeId)) {
    index.activeId = index.profiles[0].id;
  }
  writeIndex(index);
  return index;
}

function writeIndex(index: ResumeIndex): void {
  mkdirSync(RESUMES_DIR, { recursive: true });
  writeFileSync(RESUME_INDEX, JSON.stringify(index, null, 2), "utf8");
}

export function profileFilePath(profile: ResumeProfileMeta): string {
  if (profile.source === "seed" || profile.id === SEED_RESUME_ID) return MASTER_RESUME_YAML;
  return join(RESUMES_DIR, profile.file || `${profile.id}.yaml`);
}

export function getActiveProfile(): ResumeProfileMeta {
  const index = ensureIndex();
  const profile = index.profiles.find((p) => p.id === index.activeId) || index.profiles[0];
  return profile;
}

export function masterResumeFilePath(): string {
  return profileFilePath(getActiveProfile());
}

export function loadMasterResumeData(): ResumeData {
  return readYamlResume(masterResumeFilePath());
}

export function activeResumeLabel(): string {
  try {
    const profile = getActiveProfile();
    return `Active resume: ${profile.name}`;
  } catch {
    return "Master resume";
  }
}

export function listResumeProfiles(): { active_id: string; profiles: ResumeProfileDto[] } {
  const index = ensureIndex();
  const profiles = index.profiles.map((p) => {
    let headline = "";
    let name = p.name;
    try {
      const data = readYamlResume(profileFilePath(p));
      headline = data.headline || "";
      if (data.name) name = data.name;
    } catch {
      /* ignore unreadable files */
    }
    return {
      ...p,
      name,
      headline,
      active: p.id === index.activeId,
    };
  });
  return { active_id: index.activeId, profiles };
}

export function setActiveResume(id: string): { active_id: string; profiles: ResumeProfileDto[] } {
  const index = ensureIndex();
  if (!index.profiles.some((p) => p.id === id)) {
    throw new Error("Resume profile not found");
  }
  index.activeId = id;
  writeIndex(index);
  return listResumeProfiles();
}

export function looksLikeStructuredResume(raw: string): ResumeData | null {
  const text = raw.trim();
  if (!text) return null;
  let parsed: unknown;
  try {
    if (text.startsWith("{")) parsed = JSON.parse(text);
    else parsed = yaml.load(text);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const data = parsed as Partial<ResumeData>;
  if (!data.name || typeof data.name !== "string") return null;
  const hasBody =
    (Array.isArray(data.experience) && data.experience.length > 0) ||
    (Array.isArray(data.education) && data.education.length > 0) ||
    (Array.isArray(data.skill_groups) && data.skill_groups.length > 0) ||
    Boolean(data.profile);
  if (!hasBody) return null;
  return normalizeResume(data);
}

export async function importResumeFromText(opts: {
  name?: string;
  text: string;
}): Promise<{ active_id: string; profiles: ResumeProfileDto[] }> {
  const text = opts.text.trim();
  if (text.length < 40) {
    throw new Error("Paste a full resume (at least 40 characters), or upload a .txt / .md / .yaml / .pdf file.");
  }
  let data = looksLikeStructuredResume(text);
  if (!data) {
    const system =
      "You convert a CV into structured JSON for an ATS resume system. " +
      "Return JSON matching this schema exactly: " +
      '{"name","headline","profile","email","phone","location","linkedin","github","portfolio",' +
      '"education":[{"school","location","degree","dates","details":[]}],' +
      '"experience":[{"company","location","title","dates","bullets":[]}],' +
      '"projects":[{"name","location","title","dates","bullets":[]}],' +
      '"skill_groups":[{"label","items"}],' +
      '"skills","languages","interests"}. ' +
      "Hard limits: copy only facts present in the source. Do NOT invent employers, dates, degrees, tools, or projects. " +
      "Keep contact links identical. Use empty strings or empty arrays when unknown. British/European English.";
    const parsed = await chatJson(system, `Convert this CV:\n\n${text.slice(0, 24000)}`, 0.1);
    data = normalizeResume(parsed as Partial<ResumeData>);
    if (!data.name) {
      throw new Error("Could not read a name from that resume. Check the text and try again.");
    }
  }
  const displayName = (opts.name || "").trim() || data.name;
  const index = ensureIndex();
  const id = uniqueId(index, displayName);
  const file = `${id}.yaml`;
  const path = join(RESUMES_DIR, file);
  writeFileSync(path, yaml.dump(data, { lineWidth: 88, noRefs: true }), "utf8");
  index.profiles.push({
    id,
    name: displayName,
    source: "imported",
    file,
  });
  index.activeId = id;
  writeIndex(index);
  return listResumeProfiles();
}

export function deleteResumeProfile(id: string): { active_id: string; profiles: ResumeProfileDto[] } {
  const index = ensureIndex();
  const profile = index.profiles.find((p) => p.id === id);
  if (!profile) throw new Error("Resume profile not found");
  if (index.profiles.length <= 1) {
    throw new Error("Keep at least one resume profile.");
  }
  if (profile.source === "seed" || profile.id === SEED_RESUME_ID) {
    throw new Error("The original master resume cannot be deleted.");
  }
  const path = profileFilePath(profile);
  if (existsSync(path) && path !== MASTER_RESUME_YAML) {
    unlinkSync(path);
  }
  index.profiles = index.profiles.filter((p) => p.id !== id);
  if (index.activeId === id) index.activeId = index.profiles[0].id;
  writeIndex(index);
  return listResumeProfiles();
}
