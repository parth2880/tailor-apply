import Link from "next/link";
import type { ReactNode } from "react";
import { ResumeSwitcher } from "./ResumeSwitcher";

export function AppHeader({ actions }: { actions?: ReactNode }) {
  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-screen-2xl flex-col gap-3 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4 sm:px-8 sm:py-3.5">
        <Link href="/" className="group flex min-w-0 items-center gap-3 no-underline">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-brand text-white shadow-sm">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <rect x="4" y="7" width="16" height="13" rx="2" />
              <path d="M9 12h6M9 16h3" />
            </svg>
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[1.05rem] font-semibold tracking-tight text-ink group-hover:text-brand">
              Job Automator
            </span>
            <span className="block text-xs text-ink-muted">Find · tailor · you apply</span>
          </span>
        </Link>
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:justify-end">
          <ResumeSwitcher />
          {actions}
        </div>
      </div>
    </header>
  );
}
