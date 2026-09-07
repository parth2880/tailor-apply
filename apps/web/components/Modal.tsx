"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type Props = {
  children: ReactNode;
  onClose: () => void;
  maxWidth?: "lg" | "xl" | "3xl";
};

export function Modal({ children, onClose, maxWidth = "lg" }: Props) {
  const [mounted, setMounted] = useState(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    setMounted(true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCloseRef.current();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  if (!mounted) return null;

  const widthClass =
    maxWidth === "3xl" ? "max-w-3xl" : maxWidth === "xl" ? "max-w-xl" : "max-w-lg";

  return createPortal(
    <div className="fixed inset-0 z-100" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-md" onClick={onClose} />
      <div
        className={`relative mx-auto flex min-h-full items-end px-3 py-4 sm:items-center sm:px-4 sm:py-8 ${widthClass}`}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
