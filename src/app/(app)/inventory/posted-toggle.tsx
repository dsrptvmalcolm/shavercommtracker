"use client";

import { useOptimistic, useState, useTransition } from "react";
import { setVehiclePosted } from "./actions";

/** Posted / not posted button for porters and admins. Tapping again undoes it. */
export function PostedToggle({ vehicleId, posted, className = "" }: { vehicleId: string; posted: boolean; className?: string }) {
  const [optimistic, setOptimistic] = useOptimistic(posted);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const toggle = () =>
    startTransition(async () => {
      setError(undefined);
      setOptimistic(!optimistic);
      const res = await setVehiclePosted(vehicleId, !optimistic);
      if (res.error) setError(res.error);
    });

  return (
    <div className={className}>
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={optimistic}
        className={`${optimistic ? "btn-primary" : "btn-secondary"} w-full px-4 py-2`}
      >
        {optimistic ? "Posted ✓" : "Mark posted"}
      </button>
      {error && (
        <p role="alert" className="mt-1 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
