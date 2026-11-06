"use client";

import { useState } from "react";

const copyText = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older iOS / non-secure contexts: fall back to a hidden textarea
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    el.remove();
    return ok;
  }
};

/** Copies `text` and confirms with "Copied ✓" for two seconds. */
export function CopyButton({ text, label, className = "" }: { text: string; label: string; className?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const onClick = async () => {
    setState((await copyText(text)) ? "copied" : "failed");
    setTimeout(() => setState("idle"), 2000);
  };
  return (
    <button type="button" onClick={onClick} disabled={!text} className={`btn-secondary px-4 py-2 ${className}`}>
      <span aria-live="polite">{state === "copied" ? "Copied ✓" : state === "failed" ? "Couldn't copy" : label}</span>
    </button>
  );
}
