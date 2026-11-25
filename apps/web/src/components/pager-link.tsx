"use client";

import { ChevronLeftIcon, ChevronRightIcon, buttonClasses } from "@oku/ui";
import Link from "next/link";
import type { ReactElement } from "react";

interface PagerLinkProps {
  href: string | null;
  direction: "previous" | "next";
}

/* Icon-only on phones, labelled from sm. An end of the book keeps its slot, dimmed. */
export const PagerLink = ({ href, direction }: PagerLinkProps): ReactElement => {
  const label = direction === "previous" ? "Previous" : "Next";
  const content = (
    <>
      {direction === "previous" ? <ChevronLeftIcon /> : null}
      <span className="hidden sm:inline">{label}</span>
      {direction === "next" ? <ChevronRightIcon /> : null}
    </>
  );

  if (!href) {
    return (
      <span
        aria-hidden="true"
        className={buttonClasses({
          variant: "ghost",
          size: "icon",
          className: "opacity-40",
        })}
      >
        {content}
      </span>
    );
  }

  return (
    <Link
      href={href}
      aria-label={`${label} page`}
      className={buttonClasses({ variant: "ghost", size: "icon" })}
    >
      {content}
    </Link>
  );
};
