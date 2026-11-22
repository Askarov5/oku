import type { ButtonHTMLAttributes, ReactElement } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "rail";

export type ButtonSize = "md" | "sm" | "icon";

export interface ButtonStyleOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    ButtonStyleOptions {}

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-[var(--rounded-xs)] border text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

/* md and icon are 44px for every pointer; sm stays dense for a mouse and grows for touch. */
const SIZES: Record<ButtonSize, string> = {
  md: "min-h-[44px] px-[18px] py-[10px]",
  sm: "px-3 py-2 coarse:min-h-[44px]",
  icon: "min-h-[44px] min-w-[44px] px-3 py-[10px]",
};

/* Pressed mirrors hover, so touch gets the same feedback a mouse does. */
const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "border-transparent bg-[var(--accent-primary)] text-[var(--on-accent)] hover:bg-[var(--accent-primary-hover)] active:bg-[var(--accent-primary-hover)]",
  secondary:
    "border-transparent bg-[var(--accent-secondary)] text-[var(--on-accent-secondary)] hover:bg-[var(--accent-secondary-hover)] active:bg-[var(--accent-secondary-hover)]",
  ghost:
    "border-[var(--border-control)] bg-transparent text-[var(--text-primary)] hover:bg-[var(--bg-hover)] active:bg-[var(--bg-hover)]",
  rail: "border-[var(--rail-line)] bg-transparent text-[var(--text-on-rail)] hover:bg-[var(--rail-hover)] active:bg-[var(--rail-hover)]",
};

/** Button styling for elements that are not buttons, such as links. */
export const buttonClasses = ({
  variant = "primary",
  size = "md",
  className = "",
}: ButtonStyleOptions = {}): string =>
  [BASE, SIZES[size], VARIANTS[variant], className].filter(Boolean).join(" ");

export const Button = ({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}: ButtonProps): ReactElement => (
  <button
    className={buttonClasses({ variant, size, className })}
    type={props.type ?? "button"}
    {...props}
  >
    {children}
  </button>
);
