import type {
  ImageBlock,
  PageAnchorBlock,
  TableBlock,
  UnitBlock,
} from "@oku/shared-types";
import Link from "next/link";
import type { ReactElement } from "react";
import type { Components } from "react-markdown";
import { RichText } from "@/components/rich-text";
import { TableView } from "@/components/table-view";
import { pageAnchorId } from "@/lib/book-outline";
import { pageLabel } from "@/lib/page-label";

interface UnitBodyProps {
  body: UnitBlock[];
  /** Where a page marker leads, e.g. that page's review screen. */
  pageHref: (pageNumber: number) => string;
  /** The unit title's level, so headings in the text start below it. */
  headingLevel?: number;
}

interface PageMarkerProps {
  anchor: Pick<PageAnchorBlock, "pageNumber" | "label">;
  href: string;
}

type Segment =
  | { kind: "markdown"; id: string; markdown: string }
  | { kind: "image"; block: ImageBlock }
  | { kind: "table"; block: TableBlock }
  | { kind: "anchor"; block: PageAnchorBlock };

/* An in-text page marker travels through Markdown as a link with this prefix. */
const INLINE_ANCHOR = "#oku-page-";

const MARKER =
  "rounded-[var(--rounded-sm)] border border-[var(--border-hairline)] px-2 py-0.5 font-mono text-xs tabular-nums text-[var(--text-secondary)] hover:border-[var(--border-control)] hover:text-[var(--text-primary)]";

/*
 * The body is Markdown interrupted by components. A page that starts in the
 * middle of a paragraph must not break that paragraph, so its two halves are
 * joined here and the page marker rides inline between them.
 */
const toSegments = (body: UnitBlock[]): Segment[] => {
  const segments: Segment[] = [];
  for (let index = 0; index < body.length; index += 1) {
    const block = body[index];
    if (!block) {
      continue;
    }
    if (block.type === "image") {
      segments.push({ kind: "image", block });
      continue;
    }
    if (block.type === "markdown") {
      segments.push({ kind: "markdown", id: block.id, markdown: block.markdown });
      continue;
    }
    if (block.type === "table") {
      segments.push({ kind: "table", block });
      continue;
    }

    const previous = segments[segments.length - 1];
    const next = body[index + 1];
    if (
      block.midParagraph &&
      previous?.kind === "markdown" &&
      next?.type === "markdown"
    ) {
      const marker = `[${pageLabel(block.pageNumber, block.label)}](${INLINE_ANCHOR}${block.pageNumber})`;
      previous.markdown = `${previous.markdown.trimEnd()} ${marker} ${next.markdown.trimStart()}`;
      index += 1;
      continue;
    }
    segments.push({ kind: "anchor", block });
  }
  return segments;
};

/* A page start between blocks: a hairline with the page label on it, as in DESIGN.md. */
const PageMarker = ({ anchor, href }: PageMarkerProps): ReactElement => (
  <div
    id={pageAnchorId(anchor.pageNumber)}
    className="my-6 flex scroll-mt-24 items-center gap-3 first:mt-2"
  >
    <span aria-hidden="true" className="h-px flex-1 bg-[var(--border-hairline)]" />
    {/* The label stays small; on touch the hit area grows to 44px around it. */}
    <Link
      href={href}
      className={`${MARKER} relative coarse:after:absolute coarse:after:-inset-x-2 coarse:after:-inset-y-3`}
    >
      {pageLabel(anchor.pageNumber, anchor.label)}
    </Link>
    <span aria-hidden="true" className="h-px flex-1 bg-[var(--border-hairline)]" />
  </div>
);

/** Page markers that ride inside a paragraph are links with the oku-page prefix. */
const pageAnchorComponents = (
  pageHref: (pageNumber: number) => string,
): Components => ({
  a: ({ node: _node, href, children, ...props }) => {
    if (href?.startsWith(INLINE_ANCHOR)) {
      const pageNumber = Number(href.slice(INLINE_ANCHOR.length));
      return (
        <Link
          id={pageAnchorId(pageNumber)}
          href={pageHref(pageNumber)}
          className={`${MARKER} mx-0.5 inline-block scroll-mt-24 align-baseline`}
        >
          {children}
        </Link>
      );
    }
    return (
      <a
        href={href}
        className="underline decoration-[var(--border-control)] underline-offset-4 hover:text-[var(--accent-ink)]"
        {...props}
      >
        {children}
      </a>
    );
  },
});

export const UnitBody = ({
  body,
  pageHref,
  headingLevel = 2,
}: UnitBodyProps): ReactElement => {
  const components = pageAnchorComponents(pageHref);

  return (
    <div className="max-w-[70ch] text-base leading-7">
      {toSegments(body).map((segment) => {
        if (segment.kind === "anchor") {
          return (
            <PageMarker
              key={segment.block.id}
              anchor={segment.block}
              href={pageHref(segment.block.pageNumber)}
            />
          );
        }
        if (segment.kind === "image") {
          const { block } = segment;
          return (
            <figure key={block.id} className="my-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={block.url}
                alt={block.alt || block.ai_description}
                loading="lazy"
                decoding="async"
                className="max-w-full rounded-[var(--rounded-xs)] border border-[var(--border-hairline)]"
              />
              {block.caption ? (
                <figcaption className="mt-2 text-sm text-[var(--text-secondary)]">
                  {block.caption}
                </figcaption>
              ) : null}
            </figure>
          );
        }
        if (segment.kind === "table") {
          const { block } = segment;
          return (
            <TableView
              key={block.id}
              idInBook={block.idInBook}
              caption={block.caption}
              rows={block.rows}
            />
          );
        }
        return (
          <RichText
            key={segment.id}
            markdown={segment.markdown}
            components={components}
            headingLevel={headingLevel}
          />
        );
      })}
    </div>
  );
};
