import { describe, expect, it } from "vitest";
import { publishBlocker, publishPipeline } from "./publish";

describe("publishPipeline", () => {
  it("drops saved-only pages", () => {
    const pages = [
      { status: "stored", pageNumber: 1 },
      { status: "reviewed", pageNumber: 2 },
      { status: "stored", pageNumber: 3 },
      { status: "extracted", pageNumber: 4 },
    ];
    expect(publishPipeline(pages).map((page) => page.pageNumber)).toEqual([
      2, 4,
    ]);
  });
});

describe("publishBlocker", () => {
  it("allows publish when every digitized page is reviewed", () => {
    expect(
      publishBlocker([
        { status: "stored" },
        { status: "reviewed" },
        { status: "stored" },
        { status: "reviewed" },
      ]),
    ).toBeNull();
  });

  it("ignores stored pages when counting unfinished work", () => {
    const message = publishBlocker([
      { status: "stored" },
      { status: "extracted" },
      { status: "reviewed" },
    ]);
    expect(message).toBe(
      "all digitized pages must be reviewed before publish (1 remaining)",
    );
  });

  it("blocks when nothing has been digitized", () => {
    expect(
      publishBlocker([{ status: "stored" }, { status: "stored" }]),
    ).toBe("digitize at least one page before publish");
  });

  it("blocks an empty book", () => {
    expect(publishBlocker([])).toBe("book has no pages");
  });
});
