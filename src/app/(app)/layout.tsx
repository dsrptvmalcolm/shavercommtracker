import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getViewer } from "@/lib/data";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?error=no-access");
  return <AppShell viewer={viewer}>{children}</AppShell>;
}
