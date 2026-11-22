import { eq } from "drizzle-orm";
import { createDb } from "./client.js";
import { countries, type CountryConfigJson } from "./schema.js";

const databaseUrl =
  process.env.DATABASE_URL ?? "postgresql://oku:oku@localhost:5432/oku";

const kgConfig: CountryConfigJson = {
  languages: ["ky", "ru"],
  gradeRange: [1, 11],
  calendar: "4_quarters",
  gradingScale: { type: "5_point" },
  nationalExam: "ORT",
};

const run = async (): Promise<void> => {
  const db = createDb(databaseUrl);
  const existing = await db
    .select()
    .from(countries)
    .where(eq(countries.code, "kg"))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(countries).values({
      code: "kg",
      name: "Kyrgyzstan",
      config: kgConfig,
    });
    console.log("Seeded country kg.");
  } else {
    await db
      .update(countries)
      .set({ name: "Kyrgyzstan", config: kgConfig })
      .where(eq(countries.code, "kg"));
    console.log("Updated country kg.");
  }

  process.exit(0);
};

run().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
