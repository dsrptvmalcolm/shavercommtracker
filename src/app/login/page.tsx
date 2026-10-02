import Image from "next/image";
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="flex min-h-dvh items-center justify-center px-5">
      <div className="card relative w-full max-w-sm overflow-hidden p-8">
        <div className="pointer-events-none absolute -left-16 -top-16 h-64 w-64 rounded-full bg-primary/10 blur-[90px]" />
        <div className="relative">
          <Image src="/logo.png" alt="Shaver Preferred Motors" width={64} height={64} priority className="mb-5 h-16 w-16 object-contain" />
          <p className="eyebrow text-primary">Shaver Preferred Motors</p>
          <h1 className="display mt-1 text-4xl text-white">Team Login</h1>
          <p className="mt-2 mb-6 text-sm text-on-surface-muted">Log deals and track your commission.</p>
          {error === "no-access" && (
            <p className="mb-4 rounded-md border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
              Your login isn&apos;t linked to an active team member. Ask an admin.
            </p>
          )}
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
