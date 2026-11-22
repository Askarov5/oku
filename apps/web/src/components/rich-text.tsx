"use client";

import { liftComplexTables } from "@oku/shared-types";
import type { ReactElement } from "react";
import type { Components } from "react-markdown";
import { MarkdownView } from "@/components/markdown-view";
import { TableView } from "@/components/table-view";

interface RichTextProps {
  markdown: string;
  /** Page-anchor links in a unit body. */
  components?: Components;
  /** The unit title's level. Headings in the Markdown start one step below it. */
  headingLevel?: number;
}

/**
 * Prose, simple Markdown tables, and a real grid wherever a pipe table has a
 * stacked or wrapped header.
 */
export const RichText = ({
  markdown,
  components,
  headingLevel,
}: RichTextProps): ReactElement => {
  const pieces = liftComplexTables(markdown);
  return (
    <>
      {pieces.map((piece, index) =>
        piece.kind === "markdown" ? (
          <MarkdownView
            key={`m-${index}`}
            markdown={piece.markdown}
            components={components}
            headingLevel={headingLevel}
          />
        ) : (
          <TableView
            key={`t-${index}`}
            caption={piece.caption}
            rows={piece.rows}
          />
        ),
      )}
    </>
  );
};
