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
// Note: Reserve Bank of Zimbabwe (RBZ) is intentionally not in this list —
// it's the central bank / regulator, not a retail bank, and adding it here
// would collide with the regulator allowlist in src/lib/orgVerification.ts.
export const BANKS = [
  "CBZ Bank",
  "Steward Bank",
  "Stanbic",
  "FBC",
  "ZB Bank",
  "Nedbank",
  "POSB",
  "Ecobank",
  "First Capital",
  "NMB",
  "BancABC",
  "CABS",
  "Other",
  "I don't bank",
];
// Account types apply to the *bank* account (ZIG/Commercial/etc.). Mobile
// wallets (EcoCash/OneMoney/etc.) live in their own step — they're issued
// by mobile network operators, not banks, so they don't belong here.
export const ACCOUNT_TYPES = [
  "Savings",
  "Current",
  "USD Nostro",
  "ZIG",
  "Commercial",
  "Building Society",
  "DTMBs",
  "DFIs",
];
// Mobile wallets issued by telecoms / fintechs. Kept separate from the bank
// account-types list because users almost always have a wallet *in addition
// to* a bank account, and the use cases (P2P transfer, airtime purchase,
// bill pay) are different from "what kind of bank account do you hold".
export const WALLETS = [
  "OneMoney",
  "EcoCash",
  "InnBucks",
  "Mukuru",
  "O'mari",
  "MyCash",
];

export const INSURERS = ["Old Mutual", "First Mutual", "ZIMNAT", "Fidelity Life", "I don't have insurance"];
export const POLICY_TYPES = ["Life", "Health", "Motor", "Property", "Funeral", "Travel", "House insurance"];

// Chip-group option lists for the corporate/provider/regulator signup
// wizard's "applicationDetails" step (src/app/signup/page.tsx) — all
// optional, same low-friction pattern as the consumer arrays above.
export const EMPLOYEE_COUNT_BANDS = ["1-10", "11-50", "51-200", "201-1000", "1000+"];
export const MONTHLY_TRANSACTION_VOLUME_BANDS = ["Under $10k", "$10k-$100k", "$100k-$1M", "$1M+"];
export const PROVIDER_BUSINESS_TYPES = ["Kiosk", "Informal trader", "Registered SME", "Other"];
export const PROVIDER_LISTING_VOLUME_BANDS = ["Under 10", "10-50", "50-200", "200+"];

export const MEDICAL_AIDS = [
  "Cimas",
  "First Mutual Health",
  "Alliance Health",
  "With my Bank/Mobile Wallet",
  "Notable Society",
  "FLIMAS",
  "Heritage",
  "Aura Medical Aid Scheme",
  "Altfin Medical Aid Scheme",
  "PSMAS",
  "Public hospital only",
  "None",
];
