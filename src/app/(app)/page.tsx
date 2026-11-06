import { redirect } from "next/navigation";
import { homePath, requireMe } from "@/lib/data";

export default async function Home() {
  const me = await requireMe();
  redirect(homePath(me));
}
