import { RolesConfig } from "../common/config";
import { SearchOptions } from "../pipeline/search-options";

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
  if (n.length <= 3) {
    return new RegExp(`(?:^|\\s)${n}(?:\\s|$)`).test(h);
  }
  if (h.includes(n)) return true;
  const nc = compact(needle);
  return nc.length >= 4 && compact(haystack).includes(nc);
}

const GENERIC_TITLE_WORDS = new Set([
  "developer",
  "engineer",
  "software",
  "programmer",
  "specialist",
  "consultant",
  "analyst",
  "architect",
  "lead",
  "senior",
  "junior",
  "mid",
  "staff",
  "principal",
  "remote",
  "hybrid",
]);

const FRONTEND_SIGNALS = [
  "frontend",
  "front end",
  "front-end",
  "ui/ux",
  "ui ux",
  "ux engineer",
  "ui engineer",
  "react",
  "vue",
  "next.js",
  "nextjs",
  "nuxt",
  "angular",
  "typescript",
  "javascript",
  "tailwind",
  "css",
  "html",
];

/** Always drop these titles, even if they contain "react" / "javascript". */
const HARD_OFF_TARGET_TITLE = [
  "react native",
  "flutter",
  "android",
  "ios developer",
  "ios engineer",
];

const OFF_TARGET_TITLE = [
  "ai engineer",
  "ml engineer",
  "machine learning",
  "deep learning",
  "llm engineer",
  "prompt engineer",
  "generative ai",
  "genai",
  "mlops",
  "data scientist",
  "data engineer",
  "data analyst",
  "devops",
  "sre",
  "site reliability",
  "security engineer",
  "cloud architect",
  "backend engineer",
  "backend developer",
  "java backend",
  "spring boot",
  "golang",
  "embedded",
  "firmware",
  "salesforce",
  "sap ",
  "nurse",
  "nursing",
  "marketing manager",
  "recruiter",
  "account executive",
  "customer success",
  "chat manager",
  "support engineer",
  "qa tester",
  "manual tester",
  "game designer",
  "power bi",
  "cloud engineer",
];

function distinctiveTokens(phrase: string): string[] {
  return norm(phrase)
    .split(" ")
    .filter((w) => w.length >= 3 && !GENERIC_TITLE_WORDS.has(w));
}

export function targetPhrases(roles: RolesConfig, options?: SearchOptions): string[] {
  const fromSearch = (options?.keywords || []).map((k) => k.trim()).filter(Boolean);
  const phrases = fromSearch.length ? fromSearch : [...(roles.titles || [])];
  return [...new Set(phrases)];
}

function titleHitsPhrase(title: string, phrase: string): boolean {
  if (matches(title, phrase)) return true;
  const distinctive = distinctiveTokens(phrase);
  if (!distinctive.length) return false;
  return distinctive.some((tok) => tok.length >= 4 && matches(title, tok));
}

const WEAK_TITLE_SIGNALS = [
  "full stack",
  "fullstack",
  "full-stack",
  "software engineer",
  "software developer",
  "web developer",
  "web engineer",
  "web application",
];

export type TitleGate = "pass" | "weak" | "fail";

export function titleGate(title: string, phrases: string[]): TitleGate {
  if (!title.trim()) return "fail";
  if (HARD_OFF_TARGET_TITLE.some((neg) => matches(title, neg))) return "fail";
  const hasFrontend = FRONTEND_SIGNALS.some((p) => matches(title, p));
  if (OFF_TARGET_TITLE.some((neg) => matches(title, neg)) && !hasFrontend) return "fail";
  if (phrases.some((p) => titleHitsPhrase(title, p))) return "pass";
  if (hasFrontend) return "pass";
  if (WEAK_TITLE_SIGNALS.some((p) => matches(title, p))) return "weak";
  return "fail";
}

export function skipReasonForCard(title: string, phrases: string[]): string | null {
  if (titleGate(title, phrases) !== "fail") return null;
  return `Off-target title (does not match ${phrases.slice(0, 3).join(", ") || "frontend/UI keywords"})`;
}

export function jdIsOnTarget(
  title: string,
  description: string,
  phrases: string[],
  skills: string[],
): boolean {
  const text = `${title}\n${description}`;
  const skillHits = (skills || []).filter((s) => matches(text, s)).length;
  const frontendHits = FRONTEND_SIGNALS.filter((p) => matches(text, p)).length;
  if (skillHits >= 2 || frontendHits >= 2) return true;
  if (titleGate(title, phrases) === "pass" && (skillHits >= 1 || frontendHits >= 1)) return true;
  if (titleGate(title, phrases) === "pass" && description.trim().length < 80) return true;
  return false;
}

export function skipReasonForJd(
  title: string,
  description: string,
  phrases: string[],
  skills: string[],
): string | null {
  if (jdIsOnTarget(title, description, phrases, skills)) return null;
  return "Off-target job description (no real frontend/UI overlap)";
}
