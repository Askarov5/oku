import type { ReactElement } from "react";

interface BookCoverProps {
  /** Preview image saved at upload; null for books that have none. */
  url: string | null;
  /** Size classes, e.g. `h-16 w-12`. Match `width` and `height`. */
  className?: string;
  /** Intrinsic width, in pixels. Matches the box the classes draw. */
  width: number;
  /** Intrinsic height, in pixels. Matches the box the classes draw. */
  height: number;
  /** Load immediately when the cover is in the first screen. */
  eager?: boolean;
}

const FRAME =
  "block shrink-0 rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] bg-[var(--bg-canvas)]";

/* The book's first page as a thumbnail. Decorative: the title is always beside it. */
export const BookCover = ({
  url,
  className = "",
  width,
  height,
  eager = false,
}: BookCoverProps): ReactElement =>
  url ? (
    <img
      src={url}
      alt=""
      width={width}
      height={height}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      className={`${FRAME} object-cover object-top ${className}`}
    />
  ) : (
    <span aria-hidden="true" className={`${FRAME} ${className}`} />
  );
