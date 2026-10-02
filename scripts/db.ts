import pg from "pg";

export const createDbClient = async (): Promise<pg.Client> => {
  const raw = process.env.POSTGRES_URL_NON_POOLING;
  if (!raw) throw new Error("POSTGRES_URL_NON_POOLING is not set — run `vercel env pull`");
  // Supabase's cert chain isn't in Node's default store; strip sslmode so the ssl option below applies
  const url = new URL(raw);
  url.searchParams.delete("sslmode");
  const client = new pg.Client({ connectionString: url.toString(), ssl: { rejectUnauthorized: false } });
  await client.connect();
  return client;
};
