import Image from "next/image";
import { redirect } from "next/navigation";
import { signOut } from "@/app/login/actions";
import { getViewer } from "@/lib/data";
import { ChangePasswordForm } from "./change-password-form";

export default async function ChangePasswordPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  return (
    <main className="flex min-h-dvh items-center justify-center px-5">
      <div className="card relative w-full max-w-sm overflow-hidden p-8">
        <div className="pointer-events-none absolute -left-16 -top-16 h-64 w-64 rounded-full bg-primary/10 blur-[90px]" />
        <div className="relative text-center">
          <Image src="/logo.png" alt="Shaver Preferred Motors" width={72} height={72} priority className="mx-auto mb-5 h-18 w-18 object-contain" />
          <p className="eyebrow text-primary">Welcome, {viewer.real.name.split(" ")[0]}</p>
          <h1 className="display mt-1 text-4xl text-white">Set Your Password</h1>
          <p className="mt-2 mb-6 text-sm text-on-surface-muted">
            {viewer.real.must_change_password
              ? "You signed in with a temporary password. Choose your own to continue."
              : "Choose a new password."}
          </p>
          <div className="text-left">
            <ChangePasswordForm />
          </div>
          <form action={signOut} className="mt-4">
            <button type="submit" className="text-xs font-bold uppercase tracking-wider text-on-surface-subtle hover:text-on-surface">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
