"use client";

import { LlmCatalog } from "@/lib/types";

const RETIRED: Record<string, boolean> = {
  "gemini-2.0-flash": true,
  "llama-3.3-70b-versatile": true,
  "llama-3.1-8b-instant": true,
};

export function LlmProviderFields({
  catalog,
  provider,
  model,
  onProvider,
  onModel,
}: {
  catalog: LlmCatalog | null;
  provider: string;
  model: string;
  onProvider: (id: string) => void;
  onModel: (id: string) => void;
}) {
  const selected = catalog?.providers.find((p) => p.id === provider);

  return (
    <fieldset className="space-y-3">
      <legend className="text-xs font-semibold uppercase tracking-wide text-ink-muted">LLM provider</legend>
      {catalog?.most_tokens_label ? (
        <p className="text-xs text-ink-muted">
          Most free tokens: <strong className="text-ink">{catalog.most_tokens_label}</strong>
          {(catalog as { auto_failover?: boolean }).auto_failover !== false
            ? " · Auto-failover across free providers is on."
            : null}
        </p>
      ) : null}
      <div className="grid gap-2">
        {(catalog?.providers || []).map((p) => (
          <button
            key={p.id}
            type="button"
            disabled={!p.configured}
            onClick={() => {
              onProvider(p.id);
              onModel(p.recommended_model || p.default_model);
            }}
            className={`rounded-2xl border px-3 py-2.5 text-left text-sm transition disabled:opacity-45 ${
              provider === p.id ? "border-brand bg-brand-soft" : "border-line bg-white hover:border-brand/30"
            }`}
          >
            <div className="flex justify-between gap-2">
              <div>
                <strong>{p.label}</strong>
                <span className="text-ink-muted"> · {p.cost}</span>
                <div className="mt-0.5 text-xs text-ink-muted">{p.token_note}</div>
              </div>
              <span className="tabular-nums text-xs text-ink-muted">{p.token_score}/100</span>
            </div>
          </button>
        ))}
      </div>
      <label className="grid gap-1.5 text-sm">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Model</span>
        <select value={model} onChange={(e) => onModel(e.target.value)} className="field">
          {(selected?.models || []).map((m) => (
            <option key={m} value={m} disabled={RETIRED[m]}>
              {m}
              {m === selected?.default_model ? " (recommended)" : ""}
              {RETIRED[m] ? " — retired" : ""}
            </option>
          ))}
        </select>
      </label>
    </fieldset>
  );
}
