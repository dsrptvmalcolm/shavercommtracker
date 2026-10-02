"use client";

import { useActionState } from "react";
import type { ActionState } from "@/app/(app)/admin/actions";

type Props = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  submitLabel: string;
  className?: string;
  id?: string;
  children: React.ReactNode;
};

/** Form wrapper for admin server actions with inline success / error feedback. */
export function ActionForm({ action, submitLabel, className, id, children }: Props) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, {});
  return (
    <form action={formAction} className={className} id={id}>
      {children}
      <div className="col-span-full flex flex-wrap items-center gap-3 pt-2">
        <button type="submit" disabled={pending} className="btn-primary px-4 py-2">
          {pending ? "Saving…" : submitLabel}
        </button>
        {state.error && <span className="text-sm text-danger">{state.error}</span>}
        {state.ok && !pending && <span className="text-sm text-success">{state.ok}</span>}
      </div>
    </form>
  );
}
