"use client";

import type { TableRow } from "@oku/shared-types";
import type { ReactElement } from "react";
import { MarkdownView } from "@/components/markdown-view";

interface TableViewProps {
  idInBook?: string | null;
  caption: string | null;
  rows: TableRow[];
}

const cellText = (text: string): ReactElement | string =>
  text.trim() === "" ? "" : <MarkdownView markdown={text} compact />;

const figCaption = (
  idInBook: string | null | undefined,
  caption: string | null,
): string | null => {
  const label = (idInBook ?? "").trim();
  const title = (caption ?? "").trim();
  if (label && title) {
    return `${label}. ${title}`;
  }
  return label || title || null;
};

/** A textbook grid, including cells that span columns or rows. */
export const TableView = ({
  idInBook,
  caption,
  rows,
}: TableViewProps): ReactElement => {
  const bodyStart = rows.findIndex((row) => !row.header);
  const head = bodyStart === -1 ? rows : rows.slice(0, bodyStart);
  const body = bodyStart === -1 ? [] : rows.slice(bodyStart);
  const label = figCaption(idInBook, caption);

  return (
    <figure className="my-6">
      {label ? (
        <figcaption className="mb-2 text-sm font-semibold">{label}</figcaption>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          {head.length > 0 ? (
            <thead>
              {head.map((row, rowIndex) => (
                <tr key={`h-${rowIndex}`}>
                  {row.cells.map((cell, cellIndex) => (
                    <th
                      key={`h-${rowIndex}-${cellIndex}`}
                      colSpan={cell.colspan ?? 1}
                      rowSpan={cell.rowspan ?? 1}
                      className="border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-left font-semibold"
                    >
                      {cellText(cell.text)}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
          ) : null}
          {body.length > 0 ? (
            <tbody>
              {body.map((row, rowIndex) => (
                <tr key={`b-${rowIndex}`}>
                  {row.cells.map((cell, cellIndex) => (
                    <td
                      key={`b-${rowIndex}-${cellIndex}`}
                      colSpan={cell.colspan ?? 1}
                      rowSpan={cell.rowspan ?? 1}
                      className="border border-[var(--border-hairline)] px-3 py-2 align-top"
                    >
                      {cellText(cell.text)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          ) : null}
        </table>
      </div>
    </figure>
  );
};
