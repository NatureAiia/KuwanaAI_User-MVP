"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { IntakeQuestion } from "@/lib/insuranceIntake";

export type IntakeAnswer = { question: string; answer: string };

export function CategoryIntakeModal({
  categoryName,
  questions,
  initialAnswers,
  onSubmit,
  onSkip,
  submitting,
}: {
  categoryName: string;
  questions: IntakeQuestion[];
  initialAnswers?: Record<string, string>;
  onSubmit: (answers: IntakeAnswer[]) => void;
  onSkip: () => void;
  submitting: boolean;
}) {
  const [values, setValues] = useState<Record<string, string>>(initialAnswers ?? {});

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const answers = questions
      .map((q) => ({ question: q.question, answer: (values[q.key] ?? "").trim() }))
      .filter((a) => a.answer.length > 0);
    onSubmit(answers);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-[var(--radius-card)] border border-border bg-bg-surface p-5 shadow-lg">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-accent-sky">
              Help us tailor this
            </p>
            <p className="mt-0.5 font-display text-[16px] font-semibold">A little more about your {categoryName.toLowerCase()} needs</p>
            <p className="mt-1 text-[12px] leading-snug text-text-muted">
              Answers are saved to your profile as notes so Kuwana can use them for future {categoryName.toLowerCase()}{" "}
              recommendations too.
            </p>
          </div>
          <button
            type="button"
            onClick={onSkip}
            aria-label="Skip for now"
            className="tap-target shrink-0 rounded-full p-1 text-text-muted hover:text-text-primary"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          {questions.map((q) => (
            <div key={q.key}>
              <label className="text-[12.5px] font-medium text-text-secondary">{q.question}</label>
              <input
                type="text"
                value={values[q.key] ?? ""}
                onChange={(e) => setValues((prev) => ({ ...prev, [q.key]: e.target.value }))}
                placeholder={q.placeholder}
                className="tap-target mt-1 w-full rounded-lg border border-border bg-bg-base p-2 text-[13px] outline-none placeholder:text-text-muted focus:border-accent-sky"
              />
            </div>
          ))}

          <div className="flex items-center gap-2 pt-1">
            <Button type="submit" disabled={submitting} className="flex-1 justify-center">
              {submitting ? "Saving…" : "Continue"}
            </Button>
            <button
              type="button"
              onClick={onSkip}
              disabled={submitting}
              className="tap-target text-[12.5px] font-medium text-text-secondary hover:text-text-primary"
            >
              Skip for now
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
