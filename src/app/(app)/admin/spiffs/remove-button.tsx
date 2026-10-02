"use client";

import { useTransition } from "react";
import { deleteAdjustment } from "../actions";

export function RemoveButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => confirm("Remove this spiff?") && start(async () => void (await deleteAdjustment(id)))}
      className="text-xs font-bold uppercase tracking-wider text-danger hover:underline disabled:opacity-50"
    >
      {pending ? "Removing…" : "Remove"}
    </button>
  );
}
