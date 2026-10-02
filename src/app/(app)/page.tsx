import { redirect } from "next/navigation";
import { requireMe } from "@/lib/data";

export default async function Home() {
  const me = await requireMe();
  redirect(me.is_salesperson ? "/dashboard" : "/admin");
}
