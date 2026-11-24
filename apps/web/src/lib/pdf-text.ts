/**
 * One painted run from a PDF text layer. Coordinates are PDF user space:
 * y grows upward.
 */
export interface PdfTextRun {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/**
 * Rebuilds page text as lines a contents parser can read.
 * Indent becomes leading spaces. A wide gap before a page number becomes
 * a run of spaces, which is how a table of contents separates title and page.
 */
export const pageTextFromRuns = (runs: PdfTextRun[]): string => {
  const visible = runs.filter((run) => run.str.length > 0);
  if (visible.length === 0) {
    return "";
  }

  const heights = visible.map((run) => run.height).sort((a, b) => a - b);
  const typical = heights[Math.floor(heights.length / 2)] ?? 12;
  const band = Math.max(typical * 0.45, 2);
  const bucket = (y: number): number => Math.round(y / band);

  const sorted = [...visible].sort((a, b) => {
    const row = bucket(b.y) - bucket(a.y);
    return row !== 0 ? row : a.x - b.x;
  });

  const minX = Math.min(...visible.map((run) => run.x));
  const lines: PdfTextRun[][] = [];
  for (const run of sorted) {
    const line = lines[lines.length - 1];
    const anchor = line?.[0];
    if (anchor && bucket(anchor.y) === bucket(run.y)) {
      line.push(run);
    } else {
      lines.push([run]);
    }
  }

  return lines
    .map((line) => {
      const sample = line.find((run) => run.str.trim().length > 0) ?? line[0];
      if (!sample) {
        return "";
      }
      const charWidth = Math.max(
        sample.width / Math.max(sample.str.length, 1),
        typical * 0.45,
        1,
      );
      const indent = clamp(
        Math.round((line[0]!.x - minX) / charWidth),
        0,
        12,
      );
      let text = " ".repeat(indent);
      let cursor = line[0]!.x;
      for (const run of line) {
        const gap = run.x - cursor;
        if (text.trim().length > 0 && gap > charWidth * 0.6) {
          const spaces =
            gap > charWidth * 2
              ? clamp(Math.round(gap / charWidth), 2, 8)
              : 1;
          text += " ".repeat(spaces);
        }
        text += run.str;
        cursor = Math.max(cursor, run.x + Math.max(run.width, 0));
      }
      return text.replace(/\s+$/g, "");
    })
    .filter((line) => line.trim().length > 0)
    .join("\n");
};
