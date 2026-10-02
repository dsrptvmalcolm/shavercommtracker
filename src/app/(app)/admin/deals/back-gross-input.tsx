"use client";

import { useState, useTransition } from "react";
import { setBackGross } from "../actions";

/** Inline back gross entry — saves when the field loses focus or Enter is pressed. */
export function BackGrossInput({ dealId, value }: { dealId: string; value: number | null }) {
  const initial = value == null ? "" : value.toFixed(2);
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [pending, start] = useTransition();

  const commit = () => {
    if (draft.trim() === saved) return;
    start(async () => {
      const res = await setBackGross(dealId, draft);
      if (res.error) {
        setStatus("error");
      } else {
        setSaved(draft.trim());
        setStatus("saved");
      }
    });
  };

  return (
    <div className="flex items-center justify-end gap-2">
      <input
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          setStatus("idle");
        }}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), commit())}
        inputMode="decimal"
        placeholder="—"
        aria-label="Back gross"
        className={`input w-28 py-1.5 text-right font-mono ${status === "error" ? "border-danger" : ""}`}
      />
      <span className="w-3 text-xs">
        {pending ? "…" : status === "saved" ? <span className="text-success">✓</span> : status === "error" ? <span className="text-danger">!</span> : ""}
      </span>
    </div>
  );
}
