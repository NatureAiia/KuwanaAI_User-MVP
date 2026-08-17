"use client";

import { clsx } from "clsx";
import type { AttributeField } from "@/components/provider/types";

/**
 * Per-field editor for a category's attribute schema — a boolean renders as a
 * yes/no toggle, everything else (number/string/enum) as a text input. Shared
 * between the provider self-service wizard's Specs step and the admin
 * "New listing" form, which used to require hand-editing a raw JSON blob for
 * the exact same data.
 */
export function AttributeFieldsEditor({
  fields,
  values,
  onChange,
}: {
  fields: AttributeField[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  if (fields.length === 0) {
    return <p className="text-[13px] text-text-muted">This category has no extra specs to fill in.</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
  );
}

/** Converts the editor's string-keyed form values into typed attribute values, matching each field's declared dataType. Empty/absent values are omitted rather than coerced. */
export function attributeValuesToTyped(
  fields: AttributeField[],
  values: Record<string, string>,
): Record<string, unknown> {
  const attributes: Record<string, unknown> = {};
  for (const field of fields) {
    const raw = values[field.key];
    if (raw === undefined || raw === "") continue;
    attributes[field.key] = field.dataType === "number" ? Number(raw) : field.dataType === "boolean" ? raw === "yes" : raw;
  }
  return attributes;
}
