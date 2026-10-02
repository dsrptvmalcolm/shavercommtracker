"use client";

import { useTransition } from "react";
import { deleteHoliday } from "../actions";

export function RemoveHolidayButton({ date, name }: { date: string; name: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => confirm(`Remove ${name}? It will count as a selling day.`) && start(async () => void (await deleteHoliday(date)))}
      className="inline-flex min-h-11 items-center px-2 text-xs font-bold uppercase tracking-wider text-danger hover:underline disabled:opacity-50"
    >
      {pending ? "Removing…" : "Remove"}
    </button>
  );
}
