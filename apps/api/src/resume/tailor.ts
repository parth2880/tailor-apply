import { readFileSync, existsSync, writeFileSync } from "fs";
import { join } from "path";
import * as yaml from "js-yaml";
import { Job } from "@prisma/client";
import { getPreferences, getRolesConfig } from "../common/config";
import { JobStatus } from "../common/job-status";
import { MASTER_RESUME_YAML, OUTPUTS_DIR, PROJECT_ROOT, ensureDataDirs } from "../common/paths";
import { JobsService } from "../jobs/jobs.service";
import { LLMError, chatJson, chatText } from "../llm/llm";
import { tailoredResumeStem } from "./filename";
import { coverLetterToPdf, resumeToPdf } from "./pdf";
import { ResumeData, normalizeResume, resumeToMarkdown } from "./schema";

export function masterResumeFilePath(): string {
  const prefs = getPreferences();
  let path = join(PROJECT_ROOT, prefs.master_resume_path);
  if (!existsSync(path)) path = MASTER_RESUME_YAML;
  if (!existsSync(path)) {
    throw new Error("Master resume not found. Edit data/master_resume.yaml");
  }
  return path;
}

export function loadMasterResumeData(): ResumeData {
  const path = masterResumeFilePath();
  const data = yaml.load(readFileSync(path, "utf8")) as ResumeData;
  return normalizeResume(data);
}

function fallbackProfile(master: ResumeData, job: Job): string {
  const base =
    master.profile ||
    "Frontend engineer with experience building scalable web applications using React, Vue, and Nuxt.js.";
  if (job.company) {
    return `${base} Seeking to contribute to ${job.company} as ${job.title || "a frontend engineer"}.`;
  }
  return base;
}

function buildTailorSystemPrompt(europeNote: string): string {
  return (
    "You are an expert ATS resume writer and European CV coach for frontend / UI / full-stack roles. " +
    "Produce a highly tailored CV for THIS job that maximises ATS keyword match and HR appeal. " +
    "Return JSON matching this schema exactly: " +
    '{"name","headline","profile","email","phone","location","linkedin","github","portfolio",' +
    '"education":[{"school","location","degree","dates","details":[]}],' +
    '"experience":[{"company","location","title","dates","bullets":[]}],' +
    '"projects":[{"name","location","title","dates","bullets":[]}],' +
    '"skill_groups":[{"label","items"}],' +
    '"skills","languages","interests"}. ' +
    "Goals (do all of these):\n" +
    "1) ATS: Mirror exact keywords, stack names, and role phrases from the JD in headline, profile, skill_groups, and bullets when they are honestly supported by the master CV.\n" +
    "2) Projects: Select, rename, reorder, split, or merge projects for this JD. You MAY create additional project entries that are focused slices of REAL master work " +
    "(e.g. 'RBAC & Mentions Module — Aqueous Digital CRM' derived from Aqueous Digital). Prefer 2–4 projects most relevant to the JD; drop weak ones.\n" +
    "3) Experience: Keep real employers/dates, but rewrite titles slightly if needed for clarity (e.g. emphasise Frontend/UI), rewrite every bullet with JD language, " +
    "lead with impact + tech, and put the most relevant bullets first. Drop weak bullets.\n" +
    "4) Profile & headline: Rewrite completely for this company/role/sector. Sound senior, concise, and confident without US hype words.\n" +
    "5) Skills: Rebuild skill_groups so JD-required skills appear first; only include skills present in the master CV (or clear synonyms of those skills).\n" +
    "6) HR appeal: Strong action verbs, quantified results when present in master, scannable bullets, no fluff, British/European English.\n" +
    "Hard limits (integrity):\n" +
    "- Do NOT invent employers, employment dates, degrees, certifications, languages, or tools the candidate has never used.\n" +
    "- Do NOT invent fake companies or entirely fictional products. New project entries must map to real master experience/projects.\n" +
    "- Do NOT claim EU work authorisation unless stated in master.\n" +
    "- Keep email, phone, linkedin, github, portfolio identical to master.\n" +
    "- One A4 page: 3–4 bullets per recent role, 2–3 bullets per project.\n" +
    europeNote
  );
}

export async function tailorResumeData(master: ResumeData, job: Job): Promise<ResumeData> {
  const roles = getRolesConfig();
  let europeNote = "";
  if (roles.relocation_target.toLowerCase() === "europe") {
    europeNote =
      " Target market: Europe. Use European CV conventions: A4-friendly one page, " +
      "factual tone (avoid US hype words like 'Spearheaded'), no first person in bullets, " +
      "dates as MM/YYYY – Present, separate Languages section. " +
      "Highlight international/EU/UK delivery (Toolstation, Cycling4All, Aqueous Digital, Access Support) when relevant.";
  }
  const system = buildTailorSystemPrompt(europeNote);
  const user =
    `Candidate target titles (preferences): ${roles.titles.join(", ")}\n` +
    `Candidate target skills (preferences): ${roles.skills.join(", ")}\n\n` +
    `TARGET JOB (tailor aggressively for this):\n` +
    `Company: ${job.company}\nTitle: ${job.title}\nLocation: ${job.location}\n` +
    `Job description:\n${(job.description || "").slice(0, 7000)}\n\n` +
    `Master CV JSON (source of truth — only use real facts from here):\n${JSON.stringify(master, null, 2)}\n\n` +
    `Instructions: Extract the top ATS keywords from the JD, then rewrite the CV so those keywords appear naturally. ` +
    `Reshape the projects section for maximum fit. Return only the tailored CV JSON.`;
  let tailored: ResumeData;
  try {
    const data = await chatJson(system, user, 0.45);
    tailored = normalizeResume(data as ResumeData);
  } catch (exc) {
    throw new LLMError(`tailoring failed: ${exc instanceof Error ? exc.message : exc}`);
  }
  tailored.name = master.name;
  tailored.email = master.email;
  tailored.phone = master.phone;
  tailored.location = master.location;
  tailored.linkedin = master.linkedin;
  tailored.github = master.github;
  tailored.portfolio = master.portfolio;
  if (!tailored.languages && master.languages) tailored.languages = master.languages;
  if (!tailored.skill_groups?.length && master.skill_groups) tailored.skill_groups = master.skill_groups;
  if (!tailored.education?.length) tailored.education = master.education;
  if (!tailored.experience?.length) tailored.experience = master.experience;
  if (!tailored.profile) tailored.profile = fallbackProfile(master, job);
  return tailored;
}

export async function generateCoverLetter(master: ResumeData, job: Job): Promise<string> {
  const roles = getRolesConfig();
  let relocation = "";
  if (roles.relocation_target.toLowerCase() === "europe") {
    relocation =
      " Mention genuine openness to relocate to Europe and relevant international " +
      "project experience; do not claim work authorization not in the resume.";
  }
  const system =
    "Write a short European-style cover letter (180–260 words) in plain text. " +
    "Use British/European English. Be professional and factual, not overly salesy. " +
    "Use only facts from the master CV. Do not invent experience. " +
    "Address the company and role directly." +
    relocation;
  const user =
    `Job title: ${job.title}\nCompany: ${job.company}\n` +
    `Description:\n${(job.description || "").slice(0, 5000)}\n\n` +
    `Master resume:\n${resumeToMarkdown(master).slice(0, 5000)}\n`;
  return chatText(system, user, 0.4);
}

export async function tailorJob(
  jobs: JobsService,
  job: Job,
  master?: ResumeData,
): Promise<Job> {
  ensureDataDirs();
  const prefs = getPreferences();
  const masterData = master || loadMasterResumeData();
  const tailored = await tailorResumeData(masterData, job);
  const base = tailoredResumeStem(job);
  const mdPath = join(OUTPUTS_DIR, `${base}.md`);
  const jsonPath = join(OUTPUTS_DIR, `${base}.json`);
  const pdfPath = join(OUTPUTS_DIR, `${base}.pdf`);
  writeFileSync(mdPath, resumeToMarkdown(tailored), "utf8");
  writeFileSync(jsonPath, JSON.stringify(tailored, null, 2), "utf8");
  await resumeToPdf(tailored, pdfPath, {
    template: prefs.resume_template || "european",
    pageFormat: prefs.resume_page_format,
  });
  let coverPath: string | null = null;
  if (prefs.generate_cover_letter) {
    try {
      const cover = await generateCoverLetter(masterData, job);
      coverPath = join(OUTPUTS_DIR, `${base}_cover.txt`);
      writeFileSync(coverPath, cover, "utf8");
      const coverPdf = join(OUTPUTS_DIR, `${base}_cover.pdf`);
      const fmt = (prefs.resume_page_format || "A4").toUpperCase() === "LETTER" ? "Letter" : "A4";
      await coverLetterToPdf(
        {
          name: masterData.name,
          headline: masterData.headline,
          jobTitle: job.title,
          company: job.company,
          body: cover,
        },
        coverPdf,
        fmt,
      );
    } catch (exc) {
      console.log(`  Skipping cover letter (${exc instanceof Error ? exc.message : exc})`);
    }
  }
  await jobs.updateTailoredPaths(job.id, mdPath, pdfPath, coverPath, JobStatus.READY);
  const updated = await jobs.get(job.id);
  if (!updated) throw new Error("Job missing after tailor");
  console.log(`Tailored resume ready: ${base}.pdf`);
  return updated;
}

export async function tailorPendingJobs(
  jobs: JobsService,
  opts: { minScore?: number; limit?: number } = {},
): Promise<Job[]> {
  const roles = getRolesConfig();
  const threshold = opts.minScore ?? roles.min_match_score;
  const master = loadMasterResumeData();
  const pending = await jobs.listForTailoring(threshold, opts.limit ?? 20);
  const results: Job[] = [];
  for (const job of pending) {
    try {
      results.push(await tailorJob(jobs, job, master));
    } catch (exc) {
      console.log(`Failed to tailor job ${job.id}: ${exc instanceof Error ? exc.message : exc}`);
    }
  }
  return results;
}
