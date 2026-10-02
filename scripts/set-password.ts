// Creates or resets a login for an existing staff email. Prompts for the password so it never lands in shell history.
// Usage: npm run user:password -- you@example.com
import { createInterface } from "node:readline/promises";
import { createClient } from "@supabase/supabase-js";

const main = async () => {
  const email = process.argv[2];
  if (!email) throw new Error("Usage: npm run user:password -- <email>");
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

  const { data: staff } = await sb.from("staff").select("name").ilike("email", email).maybeSingle();
  if (!staff) throw new Error(`No staff member has the email ${email} — add it on the Staff page or in the staff table first`);

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const password = await rl.question(`New password for ${staff.name} (8+ chars): `);
  rl.close();
  if (password.length < 8) throw new Error("Password must be at least 8 characters");

  const { data } = await sb.auth.admin.listUsers({ perPage: 1000 });
  const existing = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  const { error } = existing
    ? await sb.auth.admin.updateUserById(existing.id, { password })
    : await sb.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  console.log(`Login ${existing ? "updated" : "created"} for ${staff.name}`);
};

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
