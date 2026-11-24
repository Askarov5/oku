import { describe, expect, it } from "vitest";
import {
  parsePageNumbersInput,
  parsePageRoleAssignments,
  resolvePageRoles,
  roleForPage,
  unitKindForPageRole,
} from "./page-roles.js";

describe("parsePageNumbersInput", () => {
  it("treats blank as no pages", () => {
    expect(parsePageNumbersInput("")).toEqual({ ok: true, pages: [] });
    expect(parsePageNumbersInput("  ")).toEqual({ ok: true, pages: [] });
  });

  it("reads lists, brackets, and ranges", () => {
    expect(parsePageNumbersInput("222, 223")).toEqual({
      ok: true,
      pages: [222, 223],
    });
    expect(parsePageNumbersInput("[222, 223]")).toEqual({
      ok: true,
      pages: [222, 223],
    });
    expect(parsePageNumbersInput("218-221")).toEqual({
      ok: true,
      pages: [218, 219, 220, 221],
    });
    expect(parsePageNumbersInput("1, 3-4, 6")).toEqual({
      ok: true,
      pages: [1, 3, 4, 6],
    });
  });

  it("rejects bad tokens", () => {
    expect(parsePageNumbersInput("0").ok).toBe(false);
    expect(parsePageNumbersInput("5-3").ok).toBe(false);
    expect(parsePageNumbersInput("abc").ok).toBe(false);
  });
});

describe("resolvePageRoles", () => {
  it("maps pages and rejects overlaps", () => {
    const ok = resolvePageRoles(
      {
        cover: [1],
        tableOfContents: [222, 223],
        glossary: [],
        appendices: [],
        answers: [],
      },
      250,
    );
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(roleForPage(1, ok.byPage)).toBe("cover");
      expect(roleForPage(222, ok.byPage)).toBe("table_of_contents");
      expect(roleForPage(10, ok.byPage)).toBe("body");
      expect(ok.specialPages).toEqual([1, 222, 223]);
    }

    const clash = resolvePageRoles(
      {
        cover: [1],
        tableOfContents: [1],
        glossary: [],
        appendices: [],
        answers: [],
      },
      10,
    );
    expect(clash.ok).toBe(false);
  });

  it("rejects pages outside the PDF", () => {
    const result = resolvePageRoles(
      {
        cover: [11],
        tableOfContents: [],
        glossary: [],
        appendices: [],
        answers: [],
      },
      10,
    );
    expect(result.ok).toBe(false);
  });
});

describe("parsePageRoleAssignments", () => {
  it("parses all fields", () => {
    const result = parsePageRoleAssignments({
      cover: "1",
      tableOfContents: "222-223",
      glossary: "",
      appendices: "240",
      answers: "[248, 249]",
    });
    expect(result).toEqual({
      ok: true,
      assignments: {
        cover: [1],
        tableOfContents: [222, 223],
        glossary: [],
        appendices: [240],
        answers: [248, 249],
      },
    });
  });
});

describe("unitKindForPageRole", () => {
  it("maps roles to unit kinds", () => {
    expect(unitKindForPageRole("body")).toBe("body");
    expect(unitKindForPageRole("cover")).toBe("cover");
    expect(unitKindForPageRole("table_of_contents")).toBeNull();
  });
});
