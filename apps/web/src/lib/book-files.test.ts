import { describe, expect, it } from "vitest";
import { bookStoragePrefix, coverExtension, formatFileSize } from "./book-files";

describe("coverExtension", () => {
  it("accepts the image types a browser canvas produces", () => {
    expect(coverExtension("image/webp")).toBe("webp");
    expect(coverExtension("image/png")).toBe("png");
  });

  it("rejects everything else", () => {
    expect(coverExtension("application/pdf")).toBeNull();
    expect(coverExtension("image/svg+xml")).toBeNull();
    expect(coverExtension("")).toBeNull();
  });
});

describe("bookStoragePrefix", () => {
  it("keeps a book's files under one folder", () => {
    expect(bookStoragePrefix("abc")).toBe("books/kg/abc");
  });
});

describe("formatFileSize", () => {
  it("picks a readable unit", () => {
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(1536)).toBe("1.5 KB");
    expect(formatFileSize(13 * 1024 * 1024)).toBe("13.0 MB");
    expect(formatFileSize(250 * 1024 * 1024)).toBe("250 MB");
    expect(formatFileSize(3 * 1024 * 1024 * 1024)).toBe("3.0 GB");
  });
});
