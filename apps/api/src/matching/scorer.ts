import { Job } from "@prisma/client";
import { RolesConfig, getRolesConfig } from "../common/config";
import { JobStatus } from "../common/job-status";
import { JobsService } from "../jobs/jobs.service";
import { LLMError, chatJson } from "../llm/llm";

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

export function heuristicScore(job: Job, roles?: RolesConfig): [number, string] {
  const r = roles || getRolesConfig();
  const text = `${job.title}\n${job.location}\n${job.description}`.toLowerCase();
  const titleHits = r.titles.filter((t) => text.includes(t.toLowerCase())).length;
  const skillHits = r.skills.filter((s) => text.includes(s.toLowerCase())).length;
  let score = Math.min(100, 35 + titleHits * 12 + skillHits * 6);
  if (text.includes("remote") && r.remote_ok) score = Math.min(100, score + 5);
  const [locDelta, locNote] = locationAdjustment(job, r);
  score = Math.max(0, Math.min(100, score + locDelta));
  const rationale = `Heuristic: ${titleHits} title hit(s), ${skillHits} skill hit(s).${locNote ? ` ${locNote}` : ""}`;
  return [score, rationale];
}

function relocationNote(roles: RolesConfig): string {
  if (roles.relocation_target.toLowerCase() === "europe") {
    return (
      "Candidate goal: relocate to Europe and work for European employers. " +
      "Strongly favor jobs in EU/UK/EMEA, visa sponsorship, or relocation support. " +
      "Penalize US-only, India-only, or explicit 'no sponsorship' requirements. " +
      "Remote jobs open to candidates outside the EU are still good if EMEA-friendly."
    );
  }
  return `Preferred location: ${roles.location} (remote_ok=${roles.remote_ok})`;
}

export async function scoreJob(
  job: Job,
  roles?: RolesConfig,
  useLlm = true,
): Promise<[number, string]> {
  const r = roles || getRolesConfig();
  const [base, baseReason] = heuristicScore(job, r);
  if (!useLlm) return [base, baseReason];
  const system =
    "You are a hiring match assistant for a frontend / UI-UX developer. " +
    "Score how well the candidate profile fits the job. " +
    "Return JSON with keys: score (0-100 integer), rationale (short string). " +
    "Be strict: penalize backend-heavy, mobile-native-only, or unrelated roles.";
  const user =
    `Target titles: ${r.titles.join(", ")}\n` +
    `Target skills: ${r.skills.join(", ")}\n` +
    `${relocationNote(r)}\n\n` +
    `Job title: ${job.title}\nCompany: ${job.company}\nLocation: ${job.location}\n` +
    `Description:\n${(job.description || "").slice(0, 6000)}\n`;
  try {
    const data = await chatJson(system, user);
    let score = Number(data.score ?? base);
    score = Math.max(0, Math.min(100, score));
    const rationale = String(data.rationale || baseReason).trim();
    const blended = Math.round(0.75 * score + 0.25 * base);
    return [blended, rationale];
  } catch (exc) {
    if (exc instanceof LLMError) {
      console.log(`  LLM unavailable for scoring (${exc.message}); using heuristic.`);
      return [base, `${baseReason} (LLM fallback)`];
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
    await jobs.updateScore(job.id, score, rationale, JobStatus.SCORED);
    const updated = await jobs.get(job.id);
    if (updated) scored.push(updated);
    console.log(`Scored [${score}] ${job.title} @ ${job.company}`);
  }
  return scored;
}
