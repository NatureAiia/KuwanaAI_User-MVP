"use client";

import { Button } from "@/components/ui/Button";
import { AttributeFieldsEditor } from "@/components/attributes/AttributeFieldsEditor";
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
      <div className="mt-4">
        <AttributeFieldsEditor fields={fields} values={values} onChange={onChange} />
      </div>
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
