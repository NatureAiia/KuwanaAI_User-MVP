import { clsx } from "clsx";
import { forwardRef, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";

const fieldClasses =
  "tap-target mt-1 w-full rounded-lg border border-border bg-bg-surface p-2.5 text-[13.5px] outline-none focus:border-accent-sky";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={clsx(fieldClasses, className)} {...props} />;
});

export const TextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function TextArea({ className, ...props }, ref) {
    return <textarea ref={ref} className={clsx(fieldClasses, "resize-none", className)} {...props} />;
  },
);

export function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-[12.5px] font-medium text-text-secondary">{label}</span>
      {children}
    </label>
  );
}
