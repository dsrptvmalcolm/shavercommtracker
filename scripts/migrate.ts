// Applies supabase/migrations/*.sql in order, once each.
// Usage: npm run db:migrate   (reads POSTGRES_URL_NON_POOLING from .env.local)
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { createDbClient } from "./db";

const dir = join(process.cwd(), "supabase", "migrations");

const main = async () => {
  const db = await createDbClient();
  await db.query(
    "create table if not exists public._migrations (name text primary key, applied_at timestamptz not null default now())",
  );
  await db.query("alter table public._migrations enable row level security");
  const applied = new Set((await db.query("select name from public._migrations")).rows.map((r) => r.name));
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();

  for (const file of files.filter((f) => !applied.has(f))) {
    const sql = await readFile(join(dir, file), "utf8");
    await db.query("begin");
    try {
      await db.query(sql);
      await db.query("insert into public._migrations (name) values ($1)", [file]);
      await db.query("commit");
      console.log(`applied ${file}`);
    } catch (err) {
      await db.query("rollback");
      throw err;
    }
  }
  console.log("migrations up to date");
  await db.end();
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
