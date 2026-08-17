/**
 * Category-specific clarifying questions shown before an Insurance AI
 * recommendation, so the answer (stored as a UserNote — see
 * src/lib/userNotes.ts) can ground the recommendation in the user's actual
 * situation instead of just the listing data. Keyed by category slug; falls
 * back to GENERIC_INSURANCE_QUESTIONS for any insurance category not listed
 * explicitly here (e.g. a future one added via the admin catalog).
 */
export type IntakeQuestion = { key: string; question: string; placeholder?: string };

const INSURANCE_INTAKE_QUESTIONS: Record<string, IntakeQuestion[]> = {
  "medical-aid-plans": [
    { key: "dependants", question: "How many dependants need cover, and their ages?", placeholder: "e.g. 2 kids under 12" },
    { key: "conditions", question: "Any existing or chronic conditions to factor in?", placeholder: "e.g. none, or diabetes" },
    { key: "hospital_network", question: "Any specific hospital or network you need covered?", placeholder: "e.g. no preference" },
  ],
  "motor-insurance": [
    { key: "vehicle", question: "What's the vehicle's value and age?", placeholder: "e.g. $8,000, 6 years old" },
    { key: "claims_history", question: "Any claims in the last 3 years?", placeholder: "e.g. none" },
  ],
  "life-insurance": [
    { key: "dependants", question: "How many dependants rely on your income?", placeholder: "e.g. 3" },
    { key: "existing_cover", question: "Do you already have life cover elsewhere?", placeholder: "e.g. no" },
  ],
};

const GENERIC_INSURANCE_QUESTIONS: IntakeQuestion[] = [
  { key: "priority", question: "What matters most to you — lowest cost, most cover, or fastest claims?" },
  { key: "context", question: "Anything else about your situation we should factor in?" },
];

export function getIntakeQuestions(sectorSlug: string, categorySlug: string): IntakeQuestion[] | null {
  if (sectorSlug !== "insurance") return null;
  return INSURANCE_INTAKE_QUESTIONS[categorySlug] ?? GENERIC_INSURANCE_QUESTIONS;
}
