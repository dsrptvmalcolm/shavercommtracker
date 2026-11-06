import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getMyAlertCount, getViewer } from "@/lib/data";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?error=no-access");
  if (viewer.real.must_change_password) redirect("/change-password");
  // The badge is a nicety: a failed alerts read must never take down every page
  const alertCount = await getMyAlertCount().catch((err: unknown) => {
    console.error("alert count failed:", (err as Error).message);
    return 0;
  });
  return (
    <AppShell viewer={viewer} alertCount={alertCount}>
      {children}
    </AppShell>
  );
}
