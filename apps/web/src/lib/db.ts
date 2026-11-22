import { createDb } from "@oku/db";
import { getEnv } from "./env";

const globalForDb = globalThis as unknown as {
  okuDb?: ReturnType<typeof createDb>;
};

export const getDb = (): ReturnType<typeof createDb> => {
  if (!globalForDb.okuDb) {
    globalForDb.okuDb = createDb(getEnv().databaseUrl);
  }
  return globalForDb.okuDb;
};
