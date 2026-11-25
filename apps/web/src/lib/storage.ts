import { mkdir, rm, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { uploadObject as uploadR2Object } from "./r2";

const localRoot = (): string =>
  path.resolve(process.cwd(), process.env.LOCAL_STORAGE_DIR ?? "../../.r2-local");

const isLocalStorage = (): boolean =>
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

/** Removes every object under a key prefix. Local only; R2 cleanup is best-effort later. */
export const deletePrefix = async (prefix: string): Promise<void> => {
  if (!isLocalStorage()) {
    return;
  }
  const fullPath = path.join(localRoot(), prefix);
  await rm(fullPath, { recursive: true, force: true });
};
