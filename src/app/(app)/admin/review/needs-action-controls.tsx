"use client";

import { useState, useTransition } from "react";
import { setNeedsAction } from "../actions";

/** "Flag" button that opens a short field for what needs to happen; the note is added to the deal notes. */
export function FlagNeedsAction({ dealId }: { dealId: string }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
      const res = await setNeedsAction(dealId, true, note);
      if (res.error) setError(res.error);
      else {
        setOpen(false);
        setNote("");
      }
    });

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-secondary px-3 py-1.5 text-xs">
        Flag needs action
      </button>
    );
  }

  return (
    <div className="w-full space-y-2">
      <label htmlFor={`na-${dealId}`} className="field-label">What needs to happen?</label>
      <input
        id={`na-${dealId}`}
        value={note}
        onChange={(e) => {
          setNote(e.target.value);
          setError(undefined);
        }}
        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), submit())}
        autoFocus
        autoComplete="off"
        enterKeyHint="done"
        placeholder="e.g. Missing stip — call customer"
        className="input"
      />
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={submit} disabled={pending} className="btn-primary px-3 py-1.5 text-xs">
          {pending ? "Saving…" : "Flag"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn-secondary px-3 py-1.5 text-xs">Cancel</button>
        {error && <span className="text-sm text-danger">{error}</span>}
      </div>
    </div>
  );
}

/** Checked while the deal needs action — uncheck to resolve. */
export function ResolveNeedsAction({ dealId }: { dealId: string }) {
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <label className="flex min-h-11 items-center gap-3 text-sm font-bold">
      <input
        type="checkbox"
        checked={!pending}
        disabled={pending}
        onChange={() =>
          start(async () => {
            const res = await setNeedsAction(dealId, false);
            if (res.error) setError(res.error);
          })
        }
        className="h-4 w-4 accent-primary"
      />
      {pending ? "Resolving…" : "Needs action"}
      {error && <span className="font-normal text-danger">{error}</span>}
    </label>
  );
}
