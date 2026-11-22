"use client";

import type { ReactElement } from "react";
import Markdown from "react-markdown";
import type { Components } from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import "katex/dist/katex.min.css";

interface MarkdownViewProps {
  markdown: string;
  /** Extra element renderers. Page anchors in a unit body replace links. */
  components?: Components;
  /** A table cell: no paragraph margins. */
  compact?: boolean;
  /** The unit title's level. Headings in the Markdown start one step below it. */
  headingLevel?: number;
}

type HeadingTag = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

const HEADING_CLASS = [
  "",
  "mb-3 mt-8 text-3xl font-bold tracking-tight",
  "mb-3 mt-8 text-2xl font-bold tracking-tight",
  "mb-3 mt-8 text-xl font-bold tracking-tight",
  "mb-3 mt-8 text-lg font-semibold",
  "mb-2 mt-6 font-semibold",
  "mb-2 mt-6 text-sm font-semibold",
];

/** Markdown h1 renders one level under the unit title, and so on, never past h6. */
const headingComponents = (parentLevel: number): Components => {
  const render = (step: number) => {
    const level = Math.min(6, Math.max(1, parentLevel + step));
    const Tag = `h${level}` as HeadingTag;
    const className = HEADING_CLASS[level] ?? HEADING_CLASS[6];
    return ({ node: _node, ...props }: { node?: unknown }) => (
      <Tag className={className} {...props} />
    );
  };
  return {
    h1: render(1),
    h2: render(2),
    h3: render(3),
    h4: render(4),
    h5: render(5),
    h6: render(6),
  };
};

const baseComponents: Components = {
  p: ({ node: _node, ...props }) => <p className="my-4" {...props} />,
  ul: ({ node: _node, ...props }) => (
    <ul className="my-4 list-disc space-y-1 pl-6" {...props} />
  ),
  ol: ({ node: _node, ...props }) => (
    <ol className="my-4 list-decimal space-y-1 pl-6" {...props} />
  ),
  blockquote: ({ node: _node, ...props }) => (
    <blockquote
      className="my-4 rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] px-4 text-[var(--text-secondary)]"
      {...props}
    />
  ),
  hr: ({ node: _node, ...props }) => (
    <hr className="my-6 border-[var(--border-hairline)]" {...props} />
  ),
  table: ({ node: _node, ...props }) => (
    <div className="my-6 overflow-x-auto">
      <table className="w-full border-collapse text-sm" {...props} />
    </div>
  ),
  th: ({ node: _node, ...props }) => (
    <th
      className="border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-left font-semibold"
      {...props}
    />
  ),
  td: ({ node: _node, ...props }) => (
    <td
      className="border border-[var(--border-hairline)] px-3 py-2 align-top"
      {...props}
    />
  ),
  code: ({ node: _node, ...props }) => (
    <code className="font-mono text-[0.9em]" {...props} />
  ),
  pre: ({ node: _node, ...props }) => (
    <pre className="my-4 overflow-x-auto text-sm" {...props} />
  ),
  a: ({ node: _node, ...props }) => (
    <a
      className="underline decoration-[var(--border-control)] underline-offset-4 hover:text-[var(--accent-ink)]"
      {...props}
    />
  ),
};

const compactComponents: Components = {
  p: ({ node: _node, ...props }) => <span {...props} />,
  h1: ({ node: _node, ...props }) => <span className="font-semibold" {...props} />,
  h2: ({ node: _node, ...props }) => <span className="font-semibold" {...props} />,
  h3: ({ node: _node, ...props }) => <span className="font-semibold" {...props} />,
  h4: ({ node: _node, ...props }) => <span className="font-semibold" {...props} />,
};

/** GFM and KaTeX for a finished Markdown block. */
export const MarkdownView = ({
  markdown,
  components,
  compact = false,
  headingLevel = 2,
}: MarkdownViewProps): ReactElement => (
  <div className={compact ? undefined : "[&_.katex-display]:my-4 [&_.katex-display]:overflow-x-auto"}>
    <Markdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={{
        ...baseComponents,
        ...headingComponents(headingLevel),
        ...(compact ? compactComponents : {}),
        ...components,
      }}
    >
      {markdown}
    </Markdown>
  </div>
);
