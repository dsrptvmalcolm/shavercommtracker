import { ActionForm } from "@/components/action-form";
import { ViewAsButton } from "@/components/view-as-button";
import { getAllStaff, requireAdmin, type Staff } from "@/lib/data";
import { saveStaff } from "../actions";

export default async function StaffPage() {
  await requireAdmin();
  const staff = await getAllStaff();
  return (
    <>
      <div>
        <p className="eyebrow text-primary">Team</p>
        <h1 className="display text-4xl text-white lg:text-5xl">Staff &amp; Logins</h1>
        <p className="mt-2 max-w-2xl text-sm text-on-surface-muted">
          Add an email and set a password to give someone a login. Salespeople see only their own deals; admins see everything.
        </p>
      </div>
      <div className="space-y-4">
        {staff.map((s) => (
          <details key={s.id} className="card group overflow-hidden">
            <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-6 py-4 hover:bg-surface-card-hover">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-white">{s.name}</span>
                {s.is_salesperson && <span className="chip bg-primary-soft text-primary">Sales</span>}
                {s.is_admin && <span className="chip bg-surface-subtle text-on-surface">Admin</span>}
                {s.multilingual_eligible && <span className="chip bg-success/10 text-success">Multi-lingual</span>}
                {!s.active && <span className="chip bg-danger/10 text-danger">Inactive</span>}
              </span>
              <span className="text-xs text-on-surface-subtle">{s.email ?? "No login yet"}</span>
            </summary>
            <div className="border-t border-surface-border/70 p-6">
              {s.is_salesperson && s.active && (
                <div className="mb-4 flex justify-end">
                  <ViewAsButton staffId={s.id} name={s.name} />
                </div>
              )}
              <StaffForm staff={s} />
            </div>
          </details>
        ))}
      </div>
      <section className="card p-6">
        <h2 className="display mb-4 text-xl text-white">Add a team member</h2>
        <StaffForm />
      </section>
    </>
  );
}

function StaffForm({ staff }: { staff?: Staff }) {
  return (
    <ActionForm action={saveStaff} submitLabel={staff ? "Save" : "Add"} className="grid gap-4 sm:grid-cols-2">
      {staff && <input type="hidden" name="id" value={staff.id} />}
      <div>
        <label className="field-label" htmlFor={`name-${staff?.id ?? "new"}`}>Name</label>
        <input id={`name-${staff?.id ?? "new"}`} name="name" required defaultValue={staff?.name} className="input" />
      </div>
      <div>
        <label className="field-label" htmlFor={`email-${staff?.id ?? "new"}`}>Login email</label>
        <input id={`email-${staff?.id ?? "new"}`} name="email" type="email" defaultValue={staff?.email ?? ""} className="input" />
      </div>
      <div>
        <label className="field-label" htmlFor={`password-${staff?.id ?? "new"}`}>{staff?.email ? "Reset password" : "Password"}</label>
        <input id={`password-${staff?.id ?? "new"}`} name="password" type="text" autoComplete="new-password" placeholder="Leave blank to keep" className="input" />
      </div>
      <div>
        <label className="field-label" htmlFor={`pb-${staff?.id ?? "new"}`}>Personal best (units)</label>
        <input id={`pb-${staff?.id ?? "new"}`} name="personal_best_units" inputMode="decimal" required defaultValue={staff?.personal_best_units ?? 0} className="input" />
        <p className="mt-1 text-xs text-on-surface-subtle">Manual baseline. Any higher month on record counts automatically.</p>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2 sm:col-span-2">
        {(
          [
            ["is_salesperson", "Salesperson", staff?.is_salesperson ?? true],
            ["is_admin", "Admin", staff?.is_admin ?? false],
            ["multilingual_eligible", "Multi-lingual eligible", staff?.multilingual_eligible ?? false],
            ["active", "Active", staff?.active ?? true],
          ] as const
        ).map(([name, label, checked]) => (
          <label key={name} className="flex items-center gap-2 text-sm">
            <input type="checkbox" name={name} defaultChecked={checked} className="h-4 w-4 accent-primary" />
            {label}
          </label>
        ))}
      </div>
    </ActionForm>
  );
}
