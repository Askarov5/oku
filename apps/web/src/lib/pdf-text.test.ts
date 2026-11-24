import { parseContentsText } from "@oku/shared-types";
import { describe, expect, it } from "vitest";
import { pageTextFromRuns } from "./pdf-text";
import type { PdfTextRun } from "./pdf-text";

const run = (
  str: string,
  x: number,
  y: number,
  width: number,
): PdfTextRun => ({
  str,
  x,
  y,
  width,
  height: 12,
});

describe("pageTextFromRuns", () => {
  it("turns a contents text layer into lines the parser can read", () => {
    const text = pageTextFromRuns([
      run("Мазмуну", 72, 740, 56),
      run("I. Кыргызстандын географиясы", 72, 710, 180),
      run("........", 280, 710, 48),
      run("4", 420, 710, 8),
      run("1. Абалы", 96, 690, 56),
      run("........", 280, 690, 48),
      run("4", 420, 690, 8),
      run("2. Рельефи", 96, 670, 64),
      run("12", 420, 670, 14),
    ]);

    expect(parseContentsText(text)).toEqual([
      { title: "I. Кыргызстандын географиясы", level: 1, printedPage: "4" },
      { title: "1. Абалы", level: 2, printedPage: "4" },
      { title: "2. Рельефи", level: 2, printedPage: "12" },
    ]);
  });

  it("reads the page from top to bottom", () => {
    const text = pageTextFromRuns([
      run("Lower ........ 2", 72, 400, 120),
      run("Upper ........ 1", 72, 700, 120),
    ]);
    expect(text.startsWith("Upper")).toBe(true);
    expect(parseContentsText(text).map((entry) => entry.title)).toEqual([
      "Upper",
      "Lower",
    ]);
  });
});
