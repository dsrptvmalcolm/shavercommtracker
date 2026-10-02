import { AppShell } from "@/components/app-shell";
import { requireMe } from "@/lib/data";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await requireMe();
  return <AppShell me={me}>{children}</AppShell>;
}
