"use client";

import { useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { clsx } from "clsx";

export function PasswordInput({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? "text" : "password"}
        className={clsx(
          "w-full rounded-xl border border-border bg-bg-surface px-4 py-3 pr-11 text-[15px] outline-none focus:border-accent-sky",
          className,
        )}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="tap-target absolute inset-y-0 right-0 flex items-center justify-center px-3 text-text-muted hover:text-text-secondary"
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}
