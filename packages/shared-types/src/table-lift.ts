import type { TableCell, TableRow } from "./block-ast.js";

export interface LiftedMarkdown {
  kind: "markdown";
  markdown: string;
}

export interface LiftedTable {
  kind: "table";
  caption: string | null;
  rows: TableRow[];
}

export type LiftedPiece = LiftedMarkdown | LiftedTable;

const DELIMITER =
  /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/;

const splitRow = (line: string): string[] => {
  const trimmed = line.trim().replace(/\s+/g, " ");
  const body = trimmed.replace(/^\|/, "").replace(/\|$/, "");
  return body.split("|").map((cell) => cell.trim());
};

const rowClosed = (line: string): boolean => {
  const trimmed = line.trim();
  return trimmed.startsWith("|") && trimmed.endsWith("|");
};

const pad = (cells: string[], columns: number): string[] => {
  const next = cells.slice(0, columns);
  while (next.length < columns) {
    next.push("");
  }
  return next;
};

const isSubheader = (cells: string[]): boolean => {
  const filled = cells.map((cell) => cell.trim()).filter(Boolean);
  if (filled.length === 0 || filled.length === cells.length) {
    return false;
  }
  return filled.every((cell) => !/^\d/.test(cell));
};

const span = (count: number, key: "colspan" | "rowspan"): Pick<TableCell, "colspan" | "rowspan"> =>
  count > 1 ? { [key]: count } : {};

interface HeaderBlock {
  start: number;
  cells: string[];
  wrapped: boolean;
}

const takeHeader = (lines: string[], delimiter: number): HeaderBlock | null => {
  let end = delimiter - 1;
  while (end >= 0 && (lines[end] ?? "").trim() === "") {
    end -= 1;
  }
  const last = lines[end] ?? "";
  if (end < 0 || !last.includes("|")) {
    return null;
  }
  const collected = [last];
  let start = end;
  while (!rowClosed(collected.join(" ")) && start > 0) {
    const previous = lines[start - 1] ?? "";
    if (previous.trim() === "") {
      break;
    }
    collected.unshift(previous);
    start -= 1;
  }
  return {
    start,
    cells: splitRow(collected.join(" ")),
    wrapped: collected.length > 1,
  };
};

const takeBody = (
  lines: string[],
  start: number,
): { rows: string[][]; end: number } => {
  const rows: string[][] = [];
  let index = start;
  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (line.trim() === "" || !line.includes("|") || DELIMITER.test(line)) {
      break;
    }
    const chunk = [line];
    let cursor = index;
    while (!rowClosed(chunk.join(" ")) && cursor + 1 < lines.length) {
      const next = lines[cursor + 1] ?? "";
      if (next.trim() === "" || DELIMITER.test(next)) {
        break;
      }
      chunk.push(next);
      cursor += 1;
    }
    rows.push(splitRow(chunk.join(" ")));
    index = cursor + 1;
  }
  return { rows, end: index };
};

const takeCaption = (
  lines: string[],
  headerStart: number,
): { start: number; text: string | null } => {
  const picked: string[] = [];
  let cursor = headerStart;
  while (picked.length < 2) {
    let index = cursor - 1;
    while (index >= 0 && (lines[index] ?? "").trim() === "") {
      index -= 1;
    }
    if (index < 0) {
      break;
    }
    const line = (lines[index] ?? "").trim();
    if (!line || line.includes("|") || line.startsWith("#") || line.length > 80) {
      break;
    }
    picked.unshift(line);
    cursor = index;
  }
  if (picked.length === 0) {
    return { start: headerStart, text: null };
  }
  const text = picked
    .map((line, index) =>
      index === 0 && picked.length > 1 && !/[.!?…]$/.test(line) ? `${line}.` : line,
    )
    .join(" ");
  return { start: cursor, text };
};

const headerRows = (
  top: string[],
  sub: string[] | null,
  columns: number,
): TableRow[] => {
  const cells: TableCell[] = [];
  for (let column = 0; column < columns; ) {
    const text = top[column] ?? "";
    if (!text) {
      column += 1;
      continue;
    }
    let width = 1;
    while (column + width < columns && !(top[column + width] ?? "").trim()) {
      width += 1;
    }
    const below = sub
      ? Array.from({ length: width }, (_, offset) => (sub[column + offset] ?? "").trim())
      : [];
    const stacked = sub !== null && width === 1 && below.every((cell) => cell === "");
    cells.push({
      text,
      ...(stacked ? span(2, "rowspan") : span(width, "colspan")),
    });
    column += width;
  }
  const rows: TableRow[] = [{ header: true, cells }];
  if (sub) {
    rows.push({
      header: true,
      cells: sub.filter((text) => text.trim()).map((text) => ({ text })),
    });
  }
  return rows;
};

/**
 * Pull a pipe table GFM cannot draw out of a Markdown string. A table with one
 * header row and no wrapped cell stays in the Markdown.
 */
export const liftComplexTables = (markdown: string): LiftedPiece[] => {
  const lines = markdown.split("\n");
  const pieces: LiftedPiece[] = [];
  let cursor = 0;
  let lifted = false;

  const pushMarkdown = (from: number, to: number): void => {
    const text = lines.slice(from, to).join("\n").trim();
    if (text) {
      pieces.push({ kind: "markdown", markdown: text });
    }
  };

  for (let index = 0; index < lines.length; index += 1) {
    if (!DELIMITER.test(lines[index] ?? "")) {
      continue;
    }
    const columns = splitRow(lines[index] ?? "").length;
    const header = takeHeader(lines, index);
    if (!header) {
      continue;
    }
    const body = takeBody(lines, index + 1);
    const paddedHeader = pad(header.cells, columns);
    const sub = body.rows[0] && isSubheader(pad(body.rows[0], columns))
      ? pad(body.rows[0], columns)
      : null;
    if (!header.wrapped && header.cells.length === columns && sub === null) {
      continue;
    }
    const caption = takeCaption(lines, header.start);
    pushMarkdown(cursor, caption.start);
    const data = sub ? body.rows.slice(1) : body.rows;
    pieces.push({
      kind: "table",
      caption: caption.text,
      rows: [
        ...headerRows(paddedHeader, sub, columns),
        ...data.map((cells) => ({
          header: false,
          cells: pad(cells, columns).map((text) => ({ text })),
        })),
      ],
    });
    lifted = true;
    cursor = body.end;
    index = body.end - 1;
  }

  if (!lifted) {
    return [{ kind: "markdown", markdown }];
  }
  pushMarkdown(cursor, lines.length);
  return pieces;
};
