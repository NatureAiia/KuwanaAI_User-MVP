"use client";

import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/Button";

type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

type PendingConfirm = ConfirmOptions & {
  resolve: (confirmed: boolean) => void;
};

/**
 * Drop-in replacement for window.confirm()'s "are you sure?" pattern, styled
 * to match the app instead of the browser chrome. Usage:
 *
 *   const confirm = useConfirmDialog();
 *   ...
 *   const dialog = confirm.render();
 *   ...
 *   if (!(await confirm.ask({ title: "Delete this listing?" }))) return;
 *
 * Render `dialog` once near the root of the component that owns the hook.
 */
export function useConfirmDialog() {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const resolveRef = useRef<((confirmed: boolean) => void) | null>(null);

  const ask = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setPending({ ...options, resolve });
    });
  }, []);

  const settle = useCallback((confirmed: boolean) => {
    resolveRef.current?.(confirmed);
    resolveRef.current = null;
    setPending(null);
  }, []);

  const render = useCallback(() => {
    if (!pending || typeof document === "undefined") return null;
    return createPortal(
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
        onClick={() => settle(false)}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-[380px] rounded-[var(--radius-card)] border border-border bg-bg-surface p-5 shadow-2xl"
        >
          <h2 id="confirm-dialog-title" className="font-display text-[17px] font-semibold">
            {pending.title}
          </h2>
          {pending.description && (
            <p className="mt-1.5 text-[13px] leading-[1.5] text-text-secondary">
              {pending.description}
            </p>
          )}
          <div className="mt-5 flex justify-end gap-2.5">
            <Button variant="secondary" size="md" onClick={() => settle(false)} autoFocus>
              {pending.cancelLabel ?? "Cancel"}
            </Button>
            <Button
              variant={pending.danger ? "danger" : "primary"}
              size="md"
              onClick={() => settle(true)}
            >
              {pending.confirmLabel ?? "Confirm"}
            </Button>
          </div>
        </div>
      </div>,
      document.body,
    );
  }, [pending, settle]);

  return { ask, render };
}
