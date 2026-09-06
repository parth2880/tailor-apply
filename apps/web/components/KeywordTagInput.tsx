"use client";

import { KeyboardEvent, useRef, useState } from "react";

type Props = {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
};

export function KeywordTagInput({ value, onChange, placeholder = "Type a keyword and press Enter" }: Props) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function add(raw: string) {
    const tag = raw.trim().replace(/,$/, "");
    if (!tag) return;
    const exists = value.some((v) => v.toLowerCase() === tag.toLowerCase());
    if (exists) {
      setDraft("");
      return;
    }
    onChange([...value, tag]);
    setDraft("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(draft);
      return;
    }
    if (e.key === "Backspace" && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div
      className="field flex min-h-12 flex-wrap items-center gap-1.5 py-2"
      onClick={() => inputRef.current?.focus()}
    >
      {value.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-lg bg-brand-soft px-2 py-1 text-xs font-semibold text-brand"
        >
          {tag}
          <button
            type="button"
            className="rounded-md px-0.5 text-brand/70 hover:bg-white hover:text-brand"
            onClick={() => onChange(value.filter((t) => t !== tag))}
            aria-label={`Remove ${tag}`}
          >
            ×
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => add(draft)}
        className="min-w-40 flex-1 border-0 bg-transparent p-0 text-sm outline-none placeholder:text-ink-muted/70"
        placeholder={value.length ? placeholder : "Add search keywords…"}
      />
    </div>
  );
}
