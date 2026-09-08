import { existsSync, readFileSync } from "fs";
import { Job } from "@prisma/client";
import { RolesConfig, getRolesConfig } from "../common/config";
import { JobStatus } from "../common/job-status";
import { JobsService } from "../jobs/jobs.service";
import { LLMError, chatJson } from "../llm/llm";
import { loadMasterResumeData, activeResumeLabel } from "../resume/profiles";
import { resumeToMarkdown } from "../resume/schema";

function norm(text: string): string {
  return text.toLowerCase().replace(/[./_+-]+/g, " ").replace(/\s+/g, " ").trim();
}

function compact(text: string): string {
  return norm(text).replace(/ /g, "");
}

function matches(haystack: string, needle: string): boolean {
  const n = norm(needle);
  if (n.length < 2) return false;
  const h = norm(haystack);
  if (h.includes(n)) return true;
  const nc = compact(needle);
  return nc.length >= 4 && compact(haystack).includes(nc);
}

export function candidateResumeText(job: Job): { text: string; source: "tailored" | "master" | "none" } {
  if (job.tailoredResumeMdPath && existsSync(job.tailoredResumeMdPath)) {
    return { text: readFileSync(job.tailoredResumeMdPath, "utf8"), source: "tailored" };
  }
  try {
    return { text: resumeToMarkdown(loadMasterResumeData()), source: "master" };
  } catch {
    return { text: "", source: "none" };
  }
}

function locationAdjustment(job: Job, roles: RolesConfig): [number, string] {
  const text = `${job.title}\n${job.location}\n${job.description}`.toLowerCase();
  let boost = 0;
  const hits: string[] = [];
  for (const kw of roles.location_prefer_keywords || []) {
    if (text.includes(kw.toLowerCase())) {
      boost += 4;
      hits.push(kw);
    }
  }
  boost = Math.min(boost, 20);
  let penalty = 0;
  const penalties: string[] = [];
  for (const kw of roles.location_avoid_keywords || []) {
    if (text.includes(kw.toLowerCase())) {
      penalty += 8;
      penalties.push(kw);
    }
  }
  penalty = Math.min(penalty, 30);
  const notes: string[] = [];
  if (hits.length) notes.push(`EU/location +${boost} (${hits.slice(0, 4).join(", ")})`);
  if (penalties.length) notes.push(`location −${penalty} (${penalties.slice(0, 3).join(", ")})`);
  return [boost - penalty, notes.join("; ")];
}

export type ScoreFormulaLine = {
  label: string;
  points: number;
  detail: string;
};

export type ScoreBreakdown = {
  final_score: number | null;
  heuristic_score: number;
  llm_score: number | null;
  blended: boolean;
  weights: { llm: number; heuristic: number };
  resume_source: "tailored" | "master" | "none";
  resume_label: string;
  title_hits: string[];
  skill_hits: string[];
  resume_overlap: string[];
  remote_bonus: boolean;
  location_delta: number;
  location_note: string;
  rationale: string;
  steps: string[];
  formula: ScoreFormulaLine[];
  bands: { range: string; meaning: string }[];
};

const LLM_WEIGHT = 0.7;
const HEURISTIC_WEIGHT = 0.3;

function collectHits(job: Job, roles: RolesConfig, resumeText: string) {
  const jd = `${job.title}\n${job.location}\n${job.description}`;
  const titleHits = roles.titles.filter((t) => matches(jd, t));
  const skillHits = roles.skills.filter((s) => matches(jd, s));
  const resumeOverlap = resumeText
    ? roles.skills.filter((s) => matches(jd, s) && matches(resumeText, s))
    : [];
  const remoteBonus = matches(jd, "remote") && roles.remote_ok;
  const [locDelta, locNote] = locationAdjustment(job, roles);
  let score = Math.min(100, 40 + titleHits.length * 12 + skillHits.length * 5 + resumeOverlap.length * 4);
  if (remoteBonus) score = Math.min(100, score + 5);
  score = Math.max(0, Math.min(100, score + locDelta));
  const rationale = `Heuristic: ${titleHits.length} title hit(s), ${skillHits.length} skill hit(s), ${resumeOverlap.length} resume/JD skill overlap.${locNote ? ` ${locNote}` : ""}`;
  return { titleHits, skillHits, resumeOverlap, remoteBonus, locDelta, locNote, score, rationale };
}

export function heuristicScore(job: Job, roles?: RolesConfig, resumeText = ""): [number, string] {
  const r = roles || getRolesConfig();
  const h = collectHits(job, r, resumeText);
  return [h.score, h.rationale];
}

const RESUME_LABELS: Record<"tailored" | "master" | "none", string> = {
  tailored: "Tailored resume written for this job",
  master: "Master resume (data/master_resume.yaml)",
  none: "No resume available — titles and skills only",
};

export function explainScore(job: Job): ScoreBreakdown {
  const roles = getRolesConfig();
  const resume = candidateResumeText(job);
  const h = collectHits(job, roles, resume.text);
  const fallback = /LLM fallback/i.test(job.matchRationale || "");
  const stored = job.matchScore;
  let llmScore: number | null = null;
  let blended = false;
  if (stored != null && !fallback) {
    llmScore = Math.round((stored - HEURISTIC_WEIGHT * h.score) / LLM_WEIGHT);
    llmScore = Math.max(0, Math.min(100, llmScore));
    blended = true;
  }
  const titlePts = h.titleHits.length * 12;
  const skillPts = h.skillHits.length * 5;
  const overlapPts = h.resumeOverlap.length * 4;
  const remotePts = h.remoteBonus ? 5 : 0;
  const steps = [
    `Resume used: ${resume.source === "master" ? activeResumeLabel() : RESUME_LABELS[resume.source]}.`,
    `Heuristic starts at 40, then +12 per matching target title, +5 per matching target skill, +4 per skill that appears in both the JD and the resume.`,
    h.remoteBonus ? "Remote bonus: +5 because the listing is remote and remote roles are allowed." : "No remote bonus.",
    h.locNote ? `Location adjustment: ${h.locNote}.` : "No location boost or penalty.",
    fallback || stored == null
      ? "Final score is the heuristic (LLM was skipped or not run yet)."
      : `Final score is ${Math.round(LLM_WEIGHT * 100)}% LLM judgment + ${Math.round(HEURISTIC_WEIGHT * 100)}% heuristic.`,
  ];
  return {
    final_score: stored,
    heuristic_score: h.score,
    llm_score: llmScore,
    blended,
    weights: { llm: LLM_WEIGHT, heuristic: HEURISTIC_WEIGHT },
    resume_source: resume.source,
    resume_label: resume.source === "master" ? activeResumeLabel() : RESUME_LABELS[resume.source],
    title_hits: h.titleHits,
    skill_hits: h.skillHits,
    resume_overlap: h.resumeOverlap,
    remote_bonus: h.remoteBonus,
    location_delta: h.locDelta,
    location_note: h.locNote,
    rationale: job.matchRationale || h.rationale,
    steps,
    formula: [
      { label: "Base", points: 40, detail: "Every listing starts at 40" },
      {
        label: "Target titles",
        points: titlePts,
        detail: h.titleHits.length
          ? `${h.titleHits.length} × 12 — ${h.titleHits.join(", ")}`
          : "No target titles found in this JD",
      },
      {
        label: "Target skills",
        points: skillPts,
        detail: h.skillHits.length
          ? `${h.skillHits.length} × 5 — ${h.skillHits.slice(0, 8).join(", ")}${h.skillHits.length > 8 ? "…" : ""}`
          : "No target skills found in this JD",
      },
      {
        label: "Resume ↔ JD overlap",
        points: overlapPts,
        detail: h.resumeOverlap.length
          ? `${h.resumeOverlap.length} × 4 — ${h.resumeOverlap.slice(0, 8).join(", ")}${h.resumeOverlap.length > 8 ? "…" : ""}`
          : "No shared skills between the resume and this JD",
      },
      {
        label: "Remote",
        points: remotePts,
        detail: h.remoteBonus ? "Listing is remote and remote roles are allowed" : "No remote bonus",
      },
      {
        label: "Location",
        points: h.locDelta,
        detail: h.locNote || "No EU/location boost or penalty",
      },
    ],
    bands: [
      { range: "80–95", meaning: "Strong frontend / UI role, or closely related full-stack web work the resume clearly covers" },
      { range: "60–79", meaning: "Related role (full-stack, tech lead with UI, React + backend) with real overlap" },
      { range: "40–59", meaning: "Partial overlap, or a seniority / stack mismatch" },
      { range: "< 40", meaning: "Different function — support, marketing, data-only, mobile-native, backend-only with no UI" },
    ],
  };
}

function relocationNote(roles: RolesConfig): string {
  if (roles.relocation_target.toLowerCase() === "europe") {
    return (
      "Candidate is based in India and open to relocating to Europe. " +
      "Do NOT penalize for current India location. " +
      "Favor EU/UK/EMEA, visa sponsorship, or relocation support. " +
      "Penalize US-only, India-only, or explicit 'no sponsorship' requirements."
    );
  }
  return `Preferred location: ${roles.location} (remote_ok=${roles.remote_ok})`;
}

export function statusAfterScore(job: Job): typeof JobStatus.SCORED | typeof JobStatus.READY {
  return job.tailoredResumePdfPath ? JobStatus.READY : JobStatus.SCORED;
}

export async function scoreJob(
  job: Job,
  roles?: RolesConfig,
  useLlm = true,
): Promise<[number, string]> {
  const r = roles || getRolesConfig();
  const resume = candidateResumeText(job);
  const [base, baseReason] = heuristicScore(job, r, resume.text);
  if (!useLlm) return [base, `${baseReason} [${resume.source} resume]`];
  const system =
    "You are a hiring match assistant for a frontend / UI-UX / full-stack web developer. " +
    "Score how well THIS candidate resume fits THIS job. " +
    "Return JSON with keys: score (0-100 integer), rationale (short string). " +
    "Scoring guide: " +
    "80-95 strong frontend/UI or closely related full-stack web role where the resume skills clearly cover the JD; " +
    "60-79 related role (full-stack, technical lead with UI work, React + backend) with real overlap; " +
    "40-59 partial overlap or seniority/stack mismatch; " +
    "below 40 a different function (chat/support, nursing, marketing-only, data-only, mobile-native-only, backend-only with no UI). " +
    "If a tailored resume is provided, treat keyword overlap with the JD as a positive ATS signal. " +
    "Never return a low score because no profile was provided if a resume is in the user message. " +
    "Never penalize India residence when the resume says open to Europe relocation.";
  const user =
    `Target titles: ${r.titles.join(", ")}\n` +
    `Target skills: ${r.skills.join(", ")}\n` +
    `${relocationNote(r)}\n\n` +
    `Resume source: ${resume.source}\n` +
    `CANDIDATE RESUME:\n${(resume.text || "(missing)").slice(0, 7000)}\n\n` +
    `Job title: ${job.title}\nCompany: ${job.company}\nLocation: ${job.location}\n` +
    `Description:\n${(job.description || "").slice(0, 6000)}\n`;
  try {
    const data = await chatJson(system, user);
    let score = Number(data.score ?? base);
    score = Math.max(0, Math.min(100, score));
    const rationale = String(data.rationale || baseReason).trim();
    const blended = Math.round(0.7 * score + 0.3 * base);
    return [blended, `${rationale} [${resume.source} resume]`];
  } catch (exc) {
    if (exc instanceof LLMError) {
      console.log(`  LLM unavailable for scoring (${exc.message}); using heuristic.`);
      return [base, `${baseReason} (LLM fallback) [${resume.source} resume]`];
    }
    throw exc;
  }
}

export async function scorePendingJobs(
  jobs: JobsService,
  opts: { useLlm?: boolean; limit?: number; roles?: RolesConfig } = {},
): Promise<Job[]> {
  const roles = opts.roles || getRolesConfig();
  const pending = await jobs.listForScoring(opts.limit ?? 50);
  const scored: Job[] = [];
  let llmOk = opts.useLlm ?? true;
  for (const job of pending) {
    const [score, rationale] = await scoreJob(job, roles, llmOk);
    if (llmOk && rationale.includes("LLM fallback")) llmOk = false;
    await jobs.updateScore(job.id, score, rationale, statusAfterScore(job));
    const updated = await jobs.get(job.id);
    if (updated) scored.push(updated);
    console.log(`Scored [${score}] ${job.title} @ ${job.company}`);
  }
  return scored;
}
