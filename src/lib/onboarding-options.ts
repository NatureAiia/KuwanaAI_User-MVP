// Option lists for the consumer onboarding steps (Section 4.1 / 4.2 sectors).
// Kept as plain string arrays so they map straight onto SectorFootprint.data.

export const AGE_RANGES = ["18-24", "25-34", "35-44", "45-54", "55+"];

export const OCCUPATIONS = ["Student", "Employed", "Self-employed", "Unemployed", "Retired"];

export const SOCIAL_PLATFORMS = [
  "WhatsApp",
  "Facebook",
  "X",
  "Instagram",
  "LinkedIn",
  "TikTok",
  "YouTube",
];

export const NETWORKS = ["Econet", "NetOne", "Telecel"];
export const PLAN_TYPES = ["Prepaid", "Postpaid", "Not sure"];
export const SPEND_RANGES = ["Under $10", "$10–$25", "$25–$50", "$50+"];

// Banking relationships — multi-select: many Zimbabweans hold accounts at
// more than one bank (a salary account at CBZ, a savings/EcoCash wallet at
// Steward, a USD nostro at Stanbic, etc.). "I don't bank" stays as an
// exclusive single-select option so the rest of the flow knows to skip the
// account-types follow-up.
export const BANKS = [
  "CBZ Bank",
  "Steward Bank",
  "Stanbic",
  "FBC",
  "ZB Bank",
  "Nedbank",
  "POSB",
  "Other",
  "I don't bank",
];
export const ACCOUNT_TYPES = ["Savings", "Current", "EcoCash", "OneMoney", "USD Nostro"];

export const INSURERS = ["Old Mutual", "First Mutual", "ZIMNAT", "Fidelity Life", "I don't have insurance"];
export const POLICY_TYPES = ["Life", "Health", "Motor", "Property", "Funeral", "Travel"];

export const MEDICAL_AIDS = ["Cimas", "First Mutual Health", "PSMAS", "Public hospital only", "None"];
