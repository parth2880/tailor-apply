import Link from "next/link";
import type { ReactNode } from "react";

export function AppHeader({ actions }: { actions?: ReactNode }) {
  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-screen-2xl flex-wrap items-center justify-between gap-4 px-5 py-3.5 sm:px-8">
        <Link href="/" className="group flex items-center gap-3 no-underline">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-brand text-white shadow-sm">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <rect x="4" y="7" width="16" height="13" rx="2" />
              <path d="M9 12h6M9 16h3" />
            </svg>
          </span>
          <span>
            <span className="block text-[1.05rem] font-semibold tracking-tight text-ink group-hover:text-brand">
              Job Automator
            </span>
            <span className="block text-xs text-ink-muted">Find · tailor · you apply</span>
          </span>
        </Link>
        {actions}
      </div>
    </header>
  );
}
