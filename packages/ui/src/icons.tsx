import {
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  ArrowUpTrayIcon,
  ArrowsPointingOutIcon,
  Bars3Icon,
  CheckIcon as Check,
  ChevronDownIcon as ChevronDown,
  ChevronLeftIcon as ChevronLeft,
  ChevronRightIcon as ChevronRight,
  ChevronUpIcon as ChevronUp,
  ClipboardDocumentIcon,
  ClockIcon as Clock,
  DocumentTextIcon,
  MoonIcon as Moon,
  PencilSquareIcon,
  PlayIcon as Play,
  PlusIcon as Plus,
  PresentationChartBarIcon,
  SparklesIcon as Sparkles,
  SunIcon as Sun,
  TrashIcon as Trash,
  TrophyIcon as Trophy,
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
export const PlayIcon = icon(Play);
export const SlidesIcon = icon(PresentationChartBarIcon);
export const PlusIcon = icon(Plus);
export const UploadIcon = icon(ArrowUpTrayIcon);
export const CopyIcon = icon(ClipboardDocumentIcon);
export const CheckIcon = icon(Check);
export const SparklesIcon = icon(Sparkles);
export const ClockIcon = icon(Clock);
export const FullscreenIcon = icon(ArrowsPointingOutIcon);
export const ExternalLinkIcon = icon(ArrowTopRightOnSquareIcon);
export const TrophyIcon = icon(Trophy);
export const DocumentIcon = icon(DocumentTextIcon);
