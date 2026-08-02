import { clsx } from "clsx";
import Link from "next/link";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "lg";

type BaseProps = {
  variant?: Variant;
  size?: Size;
  className?: string;
};

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-accent-gold text-[#14181d] hover:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed",
  secondary:
    "bg-transparent border border-border text-text-primary hover:bg-bg-surface-raised disabled:opacity-50",
  ghost: "bg-transparent text-text-secondary hover:text-text-primary disabled:opacity-50",
  danger: "bg-accent-coral text-white hover:brightness-95 disabled:opacity-50",
};

const SIZE_CLASSES: Record<Size, string> = {
  md: "px-4 py-2.5 text-[14px] rounded-xl",
  lg: "px-6 py-3.5 text-[15px] rounded-xl",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: BaseProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={clsx(
        "tap-target font-semibold font-body transition-all inline-flex items-center justify-center gap-2",
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
      {...props}
    />
  );
}

export function LinkButton({
  variant = "primary",
  size = "md",
  className,
  href,
  children,
}: BaseProps & { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={clsx(
        "tap-target font-semibold font-body transition-all inline-flex items-center justify-center gap-2",
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
    >
      {children}
    </Link>
  );
}
