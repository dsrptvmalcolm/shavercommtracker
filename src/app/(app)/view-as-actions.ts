"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAllStaff, getViewer, VIEW_AS_COOKIE } from "@/lib/data";

/** Admin-only: render the app as a salesperson sees it. */
export async function startViewAs(staffId: string) {
  const viewer = await getViewer();
  if (!viewer?.real.is_admin) redirect("/");
  const target = (await getAllStaff()).find((s) => s.id === staffId && s.is_salesperson);
  if (!target) redirect("/admin");
  (await cookies()).set(VIEW_AS_COOKIE, target.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  redirect("/dashboard");
}

export async function stopViewAs() {
  (await cookies()).delete(VIEW_AS_COOKIE);
  redirect("/admin");
}
