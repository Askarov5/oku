import { describe, expect, it } from "vitest";
import {
  digitizePageSeeds,
  pageInDigitizeRange,
  queuedPageCount,
} from "./book-page-range";

describe("digitizePageSeeds", () => {
  it("queues the whole book when the range is blank", () => {
    const result = digitizePageSeeds(5, "", "");
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.pageStart).toBe(1);
    expect(result.pageEnd).toBe(5);
    expect(result.pages).toEqual([
      { pageNumber: 1, status: "pending", stage: "queued" },
      { pageNumber: 2, status: "pending", stage: "queued" },
      { pageNumber: 3, status: "pending", stage: "queued" },
      { pageNumber: 4, status: "pending", stage: "queued" },
      { pageNumber: 5, status: "pending", stage: "queued" },
    ]);
  });

  it("queues a middle slice and keeps the rest stored", () => {
    const result = digitizePageSeeds(6, "2", "4");
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.pageStart).toBe(2);
    expect(result.pageEnd).toBe(4);
    expect(result.pages.map((page) => page.status)).toEqual([
      "stored",
      "pending",
      "pending",
      "pending",
      "stored",
      "stored",
    ]);
    expect(result.pages.filter((page) => page.status === "pending")).toHaveLength(
      3,
    );
  });

  it("queues a single page", () => {
    const result = digitizePageSeeds(10, "7", "7");
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.pageStart).toBe(7);
    expect(result.pageEnd).toBe(7);
    expect(result.pages[6]).toEqual({
      pageNumber: 7,
      status: "pending",
      stage: "queued",
    });
    expect(result.pages.filter((page) => page.status === "stored")).toHaveLength(
      9,
    );
  });

  it("rejects a range outside the PDF", () => {
    expect(digitizePageSeeds(3, "1", "4").ok).toBe(false);
    expect(digitizePageSeeds(3, "0", "2").ok).toBe(false);
    expect(digitizePageSeeds(3, "3", "1").ok).toBe(false);
    expect(digitizePageSeeds(3, "1.5", "2").ok).toBe(false);
  });
});

describe("queuedPageCount", () => {
  it("counts the digitize window, or null when invalid", () => {
    expect(queuedPageCount(20, "10", "12")).toBe(3);
    expect(queuedPageCount(20, "", "")).toBe(20);
    expect(queuedPageCount(20, "5", "4")).toBeNull();
  });
});

describe("pageInDigitizeRange", () => {
  it("marks pages inside the window", () => {
    expect(pageInDigitizeRange(1, 10, "3", "5")).toBe(false);
    expect(pageInDigitizeRange(4, 10, "3", "5")).toBe(true);
    expect(pageInDigitizeRange(4, 10, "9", "2")).toBeNull();
  });
});
