export interface AppEnv {
  databaseUrl: string;
  adminToken: string;
  /** Used on the server only, to ask Google which models the key can use. */
  geminiApiKey: string;
  r2: {
    endpoint: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
    publicBaseUrl: string;
    forcePathStyle: boolean;
  };
}

export const getEnv = (): AppEnv => {
  const databaseUrl =
    process.env.DATABASE_URL ?? "postgresql://oku:oku@localhost:5432/oku";
  const adminToken = process.env.ADMIN_TOKEN ?? "dev-admin-token";

  return {
    databaseUrl,
    adminToken,
    geminiApiKey: (process.env.GEMINI_API_KEY ?? "").trim(),
    r2: {
      endpoint: process.env.R2_ENDPOINT ?? "http://localhost:9000",
      accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "minioadmin",
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "minioadmin",
      bucket: process.env.R2_BUCKET ?? "oku-media",
      publicBaseUrl:
        process.env.R2_PUBLIC_BASE_URL ?? "http://localhost:9000/oku-media",
      forcePathStyle: (process.env.R2_FORCE_PATH_STYLE ?? "true") === "true",
    },
  };
};
