"use client";

import { useState, useTransition } from "react";
import { dismissInventoryAlert } from "./actions";

/** Dismiss button for one alert. The row disappears when the page revalidates. */
export function DismissAlertButton({ alertId, label }: { alertId: string; label: string }) {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const dismiss = () =>
    startTransition(async () => {
      setError(undefined);
      const res = await dismissInventoryAlert(alertId);
      if (res.error) setError(res.error);
    });
  return (
    <div className="shrink-0 text-right">
      <button type="button" onClick={dismiss} disabled={pending} aria-label={label} className="btn-secondary px-4 py-2">
        {pending ? "…" : "Dismiss"}
      </button>
      {error && (
        <p role="alert" className="mt-1 max-w-40 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
