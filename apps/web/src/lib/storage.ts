import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { getEnv } from "./env";
import { publicObjectUrl, uploadObject as uploadR2Object } from "./r2";

const localRoot = (): string =>
  path.resolve(process.cwd(), process.env.LOCAL_STORAGE_DIR ?? "../../.r2-local");

export const isLocalStorage = (): boolean =>
  (process.env.STORAGE_DRIVER ?? "local") === "local";

export const uploadObject = async (input: {
  key: string;
  body: Buffer | Uint8Array;
  contentType: string;
}): Promise<string> => {
  if (!isLocalStorage()) {
    return uploadR2Object(input);
  }

  const fullPath = path.join(localRoot(), input.key);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, input.body);
  return `/api/media/${input.key}`;
};

export const readLocalObject = async (key: string): Promise<Buffer | null> => {
  try {
    return await readFile(path.join(localRoot(), key));
  } catch {
    return null;
  }
};

export const mediaPublicUrl = (key: string): string => {
  if (isLocalStorage()) {
    return `/api/media/${key}`;
  }
  return publicObjectUrl(key);
};

export const storageMode = (): string => {
  const env = getEnv();
  return isLocalStorage() ? `local:${localRoot()}` : `r2:${env.r2.endpoint}`;
};
