"use client";

import { clsx } from "clsx";
import { Button } from "@/components/ui/Button";
import type { AttributeField } from "@/components/provider/types";

export function SpecsStep({
  fields,
  values,
  onChange,
  onNext,
  onBack,
}: {
  fields: AttributeField[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <div>
      <p className="font-display text-[16px] font-semibold">Specs</p>
      {fields.length === 0 ? (
        <p className="mt-2 text-[13px] text-text-muted">This category has no extra specs to fill in.</p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {fields.map((field) => (
            <div key={field.key}>
              <label className="block text-[12.5px] font-medium text-text-secondary">
                {field.label}
                {field.unit ? ` (${field.unit})` : ""}
              </label>
              {field.dataType === "boolean" ? (
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  {(["yes", "no"] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => onChange(field.key, opt)}
                      className={clsx(
                        "tap-target rounded-xl border py-2.5 text-[13px] font-semibold capitalize",
                        values[field.key] === opt
                          ? "border-accent-sky bg-accent-sky/15 text-accent-sky"
                          : "border-border bg-bg-surface-raised",
                      )}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              ) : (
                <input
                  inputMode={field.dataType === "number" ? "decimal" : "text"}
                  value={values[field.key] ?? ""}
                  onChange={(e) =>
                    onChange(
                      field.key,
                      field.dataType === "number" ? e.target.value.replace(/[^0-9.]/g, "") : e.target.value,
                    )
                  }
                  placeholder="Optional"
                  className="tap-target mt-1.5 w-full rounded-xl border border-border bg-bg-surface-raised px-3 py-2.5 text-[14px] outline-none focus:border-accent-sky"
                />
              )}
            </div>
          ))}
        </div>
      )}
      <div className="mt-6 flex items-center justify-between">
        <Button type="button" variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button type="button" onClick={onNext}>
          Next
        </Button>
      </div>
    </div>
  );
}
