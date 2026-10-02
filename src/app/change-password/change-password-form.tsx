"use client";

import { useActionState } from "react";
import { type ChangePasswordState, changePassword } from "./actions";

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState<ChangePasswordState, FormData>(changePassword, {});
  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="password" className="field-label">New password</label>
        <input id="password" name="password" type="password" autoComplete="new-password" enterKeyHint="next" required minLength={8} className="input" />
      </div>
      <div>
        <label htmlFor="confirm" className="field-label">Confirm new password</label>
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" enterKeyHint="done" required minLength={8} className="input" />
      </div>
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      <button type="submit" disabled={pending} className="btn-primary w-full py-3">
        {pending ? "Saving…" : "Set password"}
      </button>
    </form>
  );
}
