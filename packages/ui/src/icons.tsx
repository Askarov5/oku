import {
  ArrowPathIcon,
  Bars3Icon,
  ChevronDownIcon as ChevronDown,
  ChevronLeftIcon as ChevronLeft,
  ChevronRightIcon as ChevronRight,
  ChevronUpIcon as ChevronUp,
  MoonIcon as Moon,
  PencilSquareIcon,
  SunIcon as Sun,
  TrashIcon as Trash,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import type {
  ForwardRefExoticComponent,
  ReactElement,
  RefAttributes,
  SVGProps,
} from "react";

export type IconProps = SVGProps<SVGSVGElement>;

type HeroIcon = ForwardRefExoticComponent<
  Omit<SVGProps<SVGSVGElement>, "ref"> & {
    title?: string;
    titleId?: string;
  } & RefAttributes<SVGSVGElement>
>;

/* Outline icons at 20px, the size the controls were drawn for. */
const icon =
  (Glyph: HeroIcon) =>
  ({ className, ...props }: IconProps): ReactElement => (
    <Glyph
      aria-hidden
      className={["size-5 shrink-0", className].filter(Boolean).join(" ")}
      {...props}
    />
  );

export const MenuIcon = icon(Bars3Icon);
export const CloseIcon = icon(XMarkIcon);
export const ChevronLeftIcon = icon(ChevronLeft);
export const ChevronRightIcon = icon(ChevronRight);
export const ChevronUpIcon = icon(ChevronUp);
export const ChevronDownIcon = icon(ChevronDown);
export const SunIcon = icon(Sun);
export const MoonIcon = icon(Moon);
export const PencilIcon = icon(PencilSquareIcon);
export const TrashIcon = icon(Trash);
export const RefreshIcon = icon(ArrowPathIcon);
