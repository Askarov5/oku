import type { ReactElement, SVGProps } from "react";

export type IconProps = SVGProps<SVGSVGElement>;

/* One drawing hand for every icon: 20px box, 1.75 stroke, square ends. */
const frame = (props: IconProps): IconProps => ({
  width: 20,
  height: 20,
  viewBox: "0 0 20 20",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "square",
  strokeLinejoin: "miter",
  "aria-hidden": true,
  focusable: false,
  ...props,
});

export const MenuIcon = (props: IconProps): ReactElement => (
  <svg {...frame(props)}>
    <path d="M3 5.5h14M3 10h14M3 14.5h14" />
  </svg>
);

export const CloseIcon = (props: IconProps): ReactElement => (
  <svg {...frame(props)}>
    <path d="M4.5 4.5l11 11M15.5 4.5l-11 11" />
  </svg>
);

export const ChevronLeftIcon = (props: IconProps): ReactElement => (
  <svg {...frame(props)}>
    <path d="M12 4.5L6.5 10l5.5 5.5" />
  </svg>
);

export const ChevronRightIcon = (props: IconProps): ReactElement => (
  <svg {...frame(props)}>
    <path d="M8 4.5l5.5 5.5L8 15.5" />
  </svg>
);

export const ChevronUpIcon = (props: IconProps): ReactElement => (
  <svg {...frame(props)}>
    <path d="M4.5 12L10 6.5l5.5 5.5" />
  </svg>
);

export const ChevronDownIcon = (props: IconProps): ReactElement => (
  <svg {...frame(props)}>
    <path d="M4.5 8l5.5 5.5L15.5 8" />
  </svg>
);
