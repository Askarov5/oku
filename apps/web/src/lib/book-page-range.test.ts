import { describe, expect, it } from "vitest";
import type { SpecialPageRole } from "@oku/shared-types";
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
    expect(result.bodyConversionQueued).toBe(true);
    expect(result.pages).toEqual([
      { pageNumber: 1, status: "pending", stage: "queued", pageRole: "body" },
      { pageNumber: 2, status: "pending", stage: "queued", pageRole: "body" },
      { pageNumber: 3, status: "pending", stage: "queued", pageRole: "body" },
      { pageNumber: 4, status: "pending", stage: "queued", pageRole: "body" },
      { pageNumber: 5, status: "pending", stage: "queued", pageRole: "body" },
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
      pageRole: "body",
    });
    expect(result.pages.filter((page) => page.status === "stored")).toHaveLength(
      9,
    );
  });

  it("queues only specials when page roles are set", () => {
    const roles = new Map<number, SpecialPageRole>([
      [1, "cover"],
      [222, "table_of_contents"],
      [223, "table_of_contents"],
    ]);
    const result = digitizePageSeeds(250, "1", "250", roles);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.bodyConversionQueued).toBe(false);
    expect(result.queuedPages).toEqual([1, 222, 223]);
    expect(result.pages[0]).toEqual({
      pageNumber: 1,
      status: "pending",
      stage: "queued",
      pageRole: "cover",
    });
    expect(result.pages[1]?.status).toBe("stored");
    expect(result.pages[221]?.pageRole).toBe("table_of_contents");
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
