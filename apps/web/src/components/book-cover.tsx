import type { ReactElement } from "react";

interface BookCoverProps {
  /** Preview image saved at upload; null for books that have none. */
  url: string | null;
  /** Size classes, e.g. `h-16 w-12`. */
  className?: string;
}

const FRAME =
  "block shrink-0 rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] bg-[var(--bg-canvas)]";

/* The book's first page as a thumbnail. Decorative: the title is always beside it. */
export const BookCover = ({
  url,
  className = "",
}: BookCoverProps): ReactElement =>
  url ? (
    <img
      src={url}
      alt=""
      loading="lazy"
      decoding="async"
      className={`${FRAME} object-cover object-top ${className}`}
    />
  ) : (
    <span aria-hidden="true" className={`${FRAME} ${className}`} />
  );
