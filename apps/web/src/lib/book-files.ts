/*
 * Files kept for a book: the original PDF and a preview image of its first
 * page. Shared by the upload form (which makes the preview) and the upload
 * route (which stores both).
 */

/** The preview is a small image; anything larger is not one we made. */
export const COVER_MAX_BYTES = 2 * 1024 * 1024;

/** Width, in pixels, the first page is rendered at for the saved preview. */
export const COVER_WIDTH = 480;

const COVER_EXTENSIONS: Record<string, string> = {
  "image/webp": "webp",
  // Browsers that cannot encode WebP hand back PNG instead.
  "image/png": "png",
};

/** File extension for an accepted preview image type, or null when the type is not accepted. */
export const coverExtension = (contentType: string): string | null =>
  COVER_EXTENSIONS[contentType] ?? null;

export const bookStoragePrefix = (bookId: string): string =>
  `books/kg/9/political_geography/${bookId}`;

const UNITS = ["KB", "MB", "GB"] as const;

/** A file size for display, e.g. "12.4 MB". */
export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 100 ? Math.round(value) : value.toFixed(1)} ${UNITS[unit]}`;
};
