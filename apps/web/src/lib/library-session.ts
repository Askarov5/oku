import type { Category, LibraryBook } from "@/lib/catalog";
import { isTimeout, readJson } from "@/lib/admin-request";
import {
  EXTRACTION_MODEL_ENDPOINT,
} from "@/lib/extraction-model";
import type { ExtractionModelResponse } from "@/lib/extraction-model";

export interface LibraryCatalog {
  books: LibraryBook[];
  categories: Category[];
}

/** What the library index learns from the one access check. */
export interface LibrarySession {
  catalog: LibraryCatalog;
  /** Started in the same tick as the catalog request. Null when that request failed. */
  model: Promise<ExtractionModelResponse | null>;
}

export type LibraryBoot =
  | { status: "ready"; session: LibrarySession }
  | { status: "denied" }
  | { status: "failed"; timedOut: boolean };

const isCatalog = (value: LibraryCatalog | null): value is LibraryCatalog =>
  value !== null &&
  Array.isArray(value.books) &&
  Array.isArray(value.categories);

const readModel = async (
  response: Response,
): Promise<ExtractionModelResponse | null> => {
  if (!response.ok) return null;
  const data = await readJson<ExtractionModelResponse>(response);
  if (!data || !Array.isArray(data.options)) return null;
  return data;
};

/**
 * The catalog request is the access check. The model request starts beside it
 * and is dropped when access is denied, so a signed-out visit does not apply it.
 */
export const loadLibrarySession = async (
  signal?: AbortSignal,
): Promise<LibraryBoot> => {
  const modelAbort = new AbortController();
  const timeout = AbortSignal.timeout(20_000);
  const booksSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
  const modelSignal = signal
    ? AbortSignal.any([signal, modelAbort.signal, timeout])
    : AbortSignal.any([modelAbort.signal, timeout]);

  const model = fetch(EXTRACTION_MODEL_ENDPOINT, { signal: modelSignal })
    .then(readModel)
    .catch(() => null);

  try {
    const response = await fetch("/api/admin/books", { signal: booksSignal });
    if (signal?.aborted) {
      modelAbort.abort();
      return { status: "failed", timedOut: false };
    }
    if (response.status === 401) {
      modelAbort.abort();
      return { status: "denied" };
    }
    if (!response.ok) {
      modelAbort.abort();
      return { status: "failed", timedOut: false };
    }
    const catalog = await readJson<LibraryCatalog>(response);
    if (!isCatalog(catalog)) {
      modelAbort.abort();
      return { status: "failed", timedOut: false };
    }
    return { status: "ready", session: { catalog, model } };
  } catch (caught) {
    modelAbort.abort();
    if (signal?.aborted) return { status: "failed", timedOut: false };
    return { status: "failed", timedOut: isTimeout(caught) };
  }
};
