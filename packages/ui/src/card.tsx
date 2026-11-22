import type { HTMLAttributes, ReactElement } from "react";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Set false when the card's content runs edge to edge (title row, dividers). */
  padded?: boolean;
}

export const Card = ({
  padded = true,
  className = "",
  children,
  ...props
}: CardProps): ReactElement => (
  <div
    className={[
      "rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] bg-[var(--bg-surface)]",
      padded ? "p-6" : "",
      className,
    ]
      .filter(Boolean)
      .join(" ")}
    {...props}
  >
    {children}
  </div>
);
