import OpenAI from "openai";
import { getSettings } from "../common/config";

export class LLMError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LLMError";
  }
}

const PROVIDER_DEFAULTS: Record<string, { base_url: string | null; model: string }> = {
  groq: { base_url: "https://api.groq.com/openai/v1", model: "openai/gpt-oss-120b" },
  openai: { base_url: null, model: "gpt-4o-mini" },
  ollama: { base_url: "http://127.0.0.1:11434/v1", model: "llama3.2" },
  gemini: {
    base_url: "https://generativelanguage.googleapis.com/v1beta/openai/",
    model: "gemini-3.6-flash",
  },
};

const RETIRED_MODELS: Record<string, string> = {
  "llama-3.3-70b-versatile": "openai/gpt-oss-120b",
  "llama-3.1-8b-instant": "openai/gpt-oss-20b",
  "gemini-2.0-flash": "gemini-3.6-flash",
  "models/gemini-2.0-flash": "gemini-3.6-flash",
  "gemini-2.5-flash": "gemini-3.6-flash",
  "models/gemini-2.5-flash": "gemini-3.6-flash",
  "gemini-2.5-flash-lite": "gemini-3.6-flash",
  "gemini-3-flash-preview": "gemini-3.6-flash",
};

/** If a Gemini model ID 404s (retired / blocked for new AI Studio keys), try these next. */
const GEMINI_MODEL_FALLBACKS = [
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite",
];

/** Free providers only — never auto-failover onto paid OpenAI. */
const FREE_PROVIDER_IDS = ["ollama", "groq", "gemini"] as const;

/** After a rate-limit, skip that provider for this long. */
const COOLDOWN_MS = 12 * 60 * 1000;

export const PROVIDER_CATALOG = [
  {
    id: "groq",
    label: "Groq",
    models: ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.6-27b"],
    default_model: "openai/gpt-oss-120b",
    cost: "Free tier",
    token_score: 85,
    token_note: "High free throughput. Auto-failover switches away when limited.",
    best_for_tokens: true,
  },
  {
    id: "gemini",
    label: "Google Gemini",
    models: ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.1-flash-lite"],
    default_model: "gemini-3.6-flash",
    cost: "Free tier",
    token_score: 70,
    token_note: "Free RPM/TPM; used automatically when Groq is limited.",
    best_for_tokens: false,
  },
  {
    id: "ollama",
    label: "Ollama (local)",
    models: ["llama3.2", "llama3.1", "mistral"],
    default_model: "llama3.2",
    cost: "Free / unlimited local",
    token_score: 100,
    token_note: "Unlimited free — install Ollama + pull a model for runs that never hit cloud quotas.",
    best_for_tokens: true,
  },
  {
    id: "openai",
    label: "OpenAI",
    models: ["gpt-4o-mini", "gpt-4o"],
    default_model: "gpt-4o-mini",
    cost: "Paid",
    token_score: 40,
    token_note: "Paid — never used by auto-failover.",
    best_for_tokens: false,
  },
];

type LlmOverride = { provider: string; model?: string | null };

let override: LlmOverride | null = null;
/** Sticky free provider after a successful failover mid-run. */
let stickyFree: LlmOverride | null = null;
const cooldowns = new Map<string, number>();
const failoverLog: string[] = [];

export function setLlmOverride(provider?: string | null, model?: string | null): void {
  stickyFree = null;
  if (!provider) {
    override = null;
    return;
  }
  override = { provider: provider.trim().toLowerCase(), model: model || null };
}

export function clearLlmOverride(): void {
  override = null;
  stickyFree = null;
}

export function getFailoverLog(): string[] {
  return [...failoverLog];
}

export function clearFailoverLog(): void {
  failoverLog.length = 0;
}

function markCooldown(provider: string): void {
  cooldowns.set(provider, Date.now() + COOLDOWN_MS);
}

function isCooling(provider: string): boolean {
  const until = cooldowns.get(provider);
  if (!until) return false;
  if (Date.now() >= until) {
    cooldowns.delete(provider);
    return false;
  }
  return true;
}

function preferredProvider(): string {
  if (override?.provider) return override.provider;
  if (stickyFree?.provider) return stickyFree.provider;
  return (getSettings().llm_provider || "groq").trim().toLowerCase();
}

function providerName(): string {
  return preferredProvider();
}

function defaultModelFor(provider: string): string {
  const settings = getSettings();
  const defaults = PROVIDER_DEFAULTS[provider] || PROVIDER_DEFAULTS.groq;
  const preferred = preferredProvider();

  let model = defaults.model;
  if (preferred === provider) {
    if (override?.model) model = override.model.trim();
    else if (stickyFree?.provider === provider && stickyFree.model) model = stickyFree.model.trim();
    else model = (settings.llm_model || settings.openai_model || defaults.model).trim();
  } else if (stickyFree?.provider === provider && stickyFree.model) {
    model = stickyFree.model.trim();
  }

  return RETIRED_MODELS[model] || model;
}

function resolveCredentials(provider = preferredProvider()): {
  key: string;
  baseUrl: string | null;
  model: string;
  provider: string;
} {
  const settings = getSettings();
  const defaults = PROVIDER_DEFAULTS[provider] || PROVIDER_DEFAULTS.groq;
  const model = defaultModelFor(provider);
  const envProvider = (settings.llm_provider || "groq").trim().toLowerCase();
  const baseUrl =
    provider === envProvider && settings.llm_base_url ? settings.llm_base_url : defaults.base_url;

  if (provider === "groq") {
    const key = (settings.groq_api_key || "").trim();
    if (!key || key === "gsk_your_key_here") {
      throw new LLMError(
        "GROQ_API_KEY is missing or still the placeholder. Put your real key in .env (not .env.example). Get one at https://console.groq.com/keys.",
      );
    }
    return { key, baseUrl, model, provider };
  }
  if (provider === "gemini") {
    const key = (settings.gemini_api_key || "").trim();
    if (!key || key === "your_gemini_key") {
      throw new LLMError(
        "GEMINI_API_KEY is missing. Get a free key at https://aistudio.google.com/apikey and add it to .env.",
      );
    }
    return { key, baseUrl, model, provider };
  }
  if (provider === "ollama") {
    return { key: "ollama", baseUrl, model, provider };
  }
  const key = (settings.openai_api_key || "").trim();
  if (!key || key === "sk-your-key-here") {
    throw new LLMError("OPENAI_API_KEY is missing. Or switch to Groq in .env.");
  }
  return { key, baseUrl, model, provider };
}

function getClient(provider = preferredProvider()): OpenAI {
  const { key, baseUrl } = resolveCredentials(provider);
  return new OpenAI({ apiKey: key, ...(baseUrl ? { baseURL: baseUrl } : {}) });
}

function getModel(provider = preferredProvider()): string {
  return resolveCredentials(provider).model;
}

async function ollamaReachable(): Promise<boolean> {
  try {
    const res = await fetch("http://127.0.0.1:11434/api/tags", {
      signal: AbortSignal.timeout(600),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function keyConfigured(provider: string): Promise<boolean> {
  const settings = getSettings();
  if (provider === "groq") return Boolean((settings.groq_api_key || "").trim());
  if (provider === "gemini") return Boolean((settings.gemini_api_key || "").trim());
  if (provider === "openai") {
    const key = (settings.openai_api_key || "").trim();
    return Boolean(key) && key !== "sk-your-key-here";
  }
  if (provider === "ollama") return ollamaReachable();
  return false;
}

export async function listLlmProviders() {
  const settings = getSettings();
  const active = (settings.llm_provider || "groq").trim().toLowerCase();
  const providers: Array<(typeof PROVIDER_CATALOG)[number] & {
    configured: boolean;
    available: boolean;
    active_default: boolean;
    recommended_model: string;
    cooling_down: boolean;
  }> = [];
  for (const entry of PROVIDER_CATALOG) {
    const configured = await keyConfigured(entry.id);
    providers.push({
      ...entry,
      configured,
      available: configured && !isCooling(entry.id),
      active_default: entry.id === active,
      recommended_model: entry.default_model,
      cooling_down: isCooling(entry.id),
    });
  }
  providers.sort((a, b) =>
    Number(a.configured) === Number(b.configured)
      ? b.token_score - a.token_score || a.label.localeCompare(b.label)
      : Number(b.configured) - Number(a.configured),
  );
  const ready = providers.filter((p) => p.configured);
  const best = ready.reduce(
    (acc, p) => (!acc || p.token_score > acc.token_score ? p : acc),
    ready[0],
  );
  return {
    active_provider: active,
    active_model: settings.llm_model || PROVIDER_DEFAULTS[active]?.model,
    sticky_provider: stickyFree?.provider ?? null,
    most_tokens: best?.id ?? null,
    most_tokens_label: best ? `${best.label} — ${best.token_note}` : null,
    auto_failover: true,
    providers,
  };
}

function isQuotaError(exc: unknown): boolean {
  const msg = String(exc).toLowerCase();
  return (
    /insufficient_quota|rate_limit|429|resource_exhausted|quota exceeded|too many requests|tpm|rpm/i.test(
      msg,
    )
  );
}

function wrapApiError(exc: unknown, provider = preferredProvider()): LLMError {
  const msg = String(exc);
  if (isQuotaError(exc)) {
    return new LLMError(
      `${provider} free-tier limit hit. Auto-failover will try another free provider (Groq / Gemini / Ollama).`,
    );
  }
  if (msg.includes("404") && provider === "gemini") {
    return new LLMError(
      "That Gemini model is unavailable (404). New AI Studio keys often cannot call gemini-2.5-flash — use gemini-3.6-flash.",
    );
  }
  if (
    msg.includes("404") &&
    provider === "groq" &&
    (msg.includes("llama-3.3") || msg.includes("llama-3.1") || msg.includes("model_not_found"))
  ) {
    return new LLMError(
      "That Groq model is retired. Pick openai/gpt-oss-120b (or gpt-oss-20b) in the portal.",
    );
  }
  return new LLMError(`${provider} API error: ${msg}`);
}

async function freeFailoverChain(start: string): Promise<string[]> {
  const chain: string[] = [];
  const seen = new Set<string>();
  const push = async (id: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    if (id === "openai") return;
    if (!(await keyConfigured(id))) return;
    if (isCooling(id) && id !== start) return;
    chain.push(id);
  };
  await push(start);
  const scored = [...FREE_PROVIDER_IDS].sort((a, b) => {
    const sa = PROVIDER_CATALOG.find((p) => p.id === a)?.token_score ?? 0;
    const sb = PROVIDER_CATALOG.find((p) => p.id === b)?.token_score ?? 0;
    return sb - sa;
  });
  for (const id of scored) await push(id);
  // Allow retrying a cooling start provider last if nothing else works
  if (!chain.includes(start) && (await keyConfigured(start))) chain.push(start);
  return chain;
}

async function withFreeFailover<T>(
  run: (provider: string) => Promise<T>,
): Promise<T> {
  const start = preferredProvider();
  const chain = start === "openai" ? [start] : await freeFailoverChain(start);
  const errors: string[] = [];

  for (const provider of chain) {
    try {
      const result = await run(provider);
      if (provider !== start) {
        stickyFree = { provider, model: PROVIDER_DEFAULTS[provider]?.model || null };
        const note = `LLM auto-failover → ${provider} (free)`;
        if (!failoverLog.includes(note)) failoverLog.push(note);
        console.log(`[llm] ${note}`);
      }
      return result;
    } catch (exc) {
      const wrapped = wrapApiError(exc, provider);
      errors.push(`${provider}: ${wrapped.message}`);
      if (isQuotaError(exc)) {
        markCooldown(provider);
        console.warn(`[llm] ${provider} limited — trying next free provider…`);
        continue;
      }
      // Non-quota: still try next free provider (outages, model 404s)
      if (provider !== chain[chain.length - 1] && FREE_PROVIDER_IDS.includes(provider as (typeof FREE_PROVIDER_IDS)[number])) {
        console.warn(`[llm] ${provider} failed (${wrapped.message}) — trying next free provider…`);
        continue;
      }
      throw wrapped;
    }
  }

  throw new LLMError(
    `All free LLM providers are limited or unavailable.\n` +
      errors.join("\n") +
      `\n\nTo keep running forever for free: install Ollama (https://ollama.com), run \`ollama pull llama3.2\`, then set LLM_PROVIDER=ollama in .env.`,
  );
}

function isNotFoundError(exc: unknown): boolean {
  const msg = String(exc);
  return /\b404\b|not.?found|model_not_found/i.test(msg);
}

async function createChat(
  provider: string,
  params: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming,
) {
  const client = getClient(provider);
  const model = getModel(provider);
  const kwargs = { ...params, model };
  const models =
    provider === "gemini"
      ? [...new Set([model, ...GEMINI_MODEL_FALLBACKS])]
      : [model];

  let lastError: unknown;
  for (const candidate of models) {
    const attempt = { ...kwargs, model: candidate };
    try {
      return await client.chat.completions.create(attempt);
    } catch (exc) {
      lastError = exc;
      if (/response_format|json_object/i.test(String(exc)) && attempt.response_format) {
        delete attempt.response_format;
        try {
          return await client.chat.completions.create(attempt);
        } catch (retryExc) {
          lastError = retryExc;
        }
      }
      if (provider === "gemini" && isNotFoundError(exc) && candidate !== models[models.length - 1]) {
        console.warn(`[llm] gemini model ${candidate} returned 404 — trying a current Flash model…`);
        continue;
      }
      if (candidate === models[models.length - 1]) break;
      if (provider === "gemini" && isNotFoundError(exc)) continue;
      throw exc;
    }
  }
  throw lastError;
}

export async function chatJson(
  system: string,
  user: string,
  temperature = 0.2,
): Promise<Record<string, unknown>> {
  const systemJson =
    system + "\n\nRespond with a single valid JSON object only. No markdown fences.";
  const messages = [
    { role: "system" as const, content: systemJson },
    { role: "user" as const, content: user },
  ];

  const response = await withFreeFailover(async (provider) => {
    const kwargs: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
      model: getModel(provider),
      temperature,
      messages,
    };
    if (provider !== "ollama") {
      kwargs.response_format = { type: "json_object" };
    }
    return createChat(provider, kwargs);
  });

  let content = (response.choices[0]?.message?.content || "{}").trim();
  if (content.startsWith("```")) {
    content = content.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
  }
  try {
    return JSON.parse(content);
  } catch {
    const m = content.match(/\{[\s\S]*\}/);
    if (!m) throw new LLMError(`Model did not return JSON: ${content.slice(0, 400)}`);
    return JSON.parse(m[0]);
  }
}

export async function chatText(
  system: string,
  user: string,
  temperature = 0.3,
): Promise<string> {
  const response = await withFreeFailover(async (provider) =>
    createChat(provider, {
      model: getModel(provider),
      temperature,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  );
  return (response.choices[0]?.message?.content || "").trim();
}
