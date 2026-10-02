// Temporary QA logins for browser testing and `npm run audit:mobile`. Writes to the PRODUCTION database —
// ask Malcolm first, and always run `delete` when done (QA staff appear on the live Store leaderboard).
//
//   npm run qa:accounts -- create <env-file-path>   creates qa-sales@ / qa-admin@shaver.test with a random password
//                                                   and writes AUDIT_* variables for scripts/mobile-audit.ts
//   npm run qa:accounts -- delete                   removes every @shaver.test login and staff row
//
// Keep the env file outside the repo (e.g. your scratchpad or /tmp) — it holds a password.
import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const QA_DOMAIN = "@shaver.test";
const QA_USERS = [
  { email: `qa-sales${QA_DOMAIN}`, name: "QA Salesperson", is_salesperson: true, is_admin: false },
  { email: `qa-admin${QA_DOMAIN}`, name: "QA Admin", is_salesperson: false, is_admin: true },
];
// A salesperson with real history, viewed read-only through "View as" so audits see populated screens
const VIEW_AS_NAME = "Khristian Ayala";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

const remove = async () => {
  const { count } = await sb.from("staff").delete({ count: "exact" }).like("email", `%${QA_DOMAIN}`);
  const { data } = await sb.auth.admin.listUsers({ perPage: 1000 });
  const users = data.users.filter((u) => u.email?.endsWith(QA_DOMAIN));
  for (const u of users) await sb.auth.admin.deleteUser(u.id);
  console.log(`Removed ${count ?? 0} QA staff rows and ${users.length} QA logins`);
};

const create = async (envPath: string) => {
  await remove();
  const password = randomBytes(18).toString("base64url");
  for (const u of QA_USERS) {
    const auth = await sb.auth.admin.createUser({ email: u.email, password, email_confirm: true });
    if (auth.error) throw auth.error;
    const staff = await sb.from("staff").insert(u);
    if (staff.error) throw staff.error;
  }
  const { data: viewAs } = await sb.from("staff").select("id").eq("name", VIEW_AS_NAME).single();
  const { data: deal } = await sb.from("deals").select("id").eq("salesperson_id", viewAs!.id).order("sale_date", { ascending: false }).limit(1).single();
  const env = [
    `AUDIT_SALES_EMAIL=${QA_USERS[0].email}`,
    `AUDIT_SALES_PASSWORD=${password}`,
    `AUDIT_ADMIN_EMAIL=${QA_USERS[1].email}`,
    `AUDIT_ADMIN_PASSWORD=${password}`,
    `AUDIT_VIEW_AS=${viewAs!.id}`,
    `AUDIT_DEAL_ID=${deal!.id}`,
  ].join("\n");
  await writeFile(envPath, `${env}\n`, { mode: 0o600 });
  console.log(`Created QA logins; credentials written to ${envPath}. Run \`npm run qa:accounts -- delete\` when done.`);
};

const [cmd, envPath] = process.argv.slice(2);
(cmd === "create" && envPath ? create(envPath) : cmd === "delete" ? remove() : Promise.reject(new Error("Usage: create <env-file> | delete"))).catch(
  (err) => {
    console.error(err.message ?? err);
    process.exit(1);
  },
);
