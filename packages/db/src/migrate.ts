import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const databaseUrl =
  process.env.DATABASE_URL ?? "postgresql://oku:oku@localhost:5432/oku";

const root = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = join(root, "../drizzle");

const run = async (): Promise<void> => {
  const client = postgres(databaseUrl, { max: 1 });
  const db = drizzle(client);

  await client`CREATE EXTENSION IF NOT EXISTS vector`;
  await migrate(db, { migrationsFolder });
  await client.end();
  console.log("Migrations applied.");
};

run().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
