// Facts shown on the final "saving your profile" screen, personalized to the
// providers the user actually picked during onboarding. Kept separate from the
// step components so the fact bank can grow independently of the form UI.

const PROVIDER_FACTS: Record<string, string[]> = {
  Econet: [
    "Econet launched in 1998 as Zimbabwe's first private mobile network, after a 5-year legal battle that ended the state telecoms monopoly.",
    "EcoCash, launched in 2011, is used by millions of Zimbabweans for everyday mobile payments.",
  ],
  NetOne: [
    "NetOne launched in 1996 as Zimbabwe's first state-owned mobile network.",
    "NetOne's OneMoney service extended mobile money to areas with limited bank coverage.",
  ],
  Telecel: [
    "Telecel Zimbabwe launched in 1998 as a joint venture with Telecel International.",
    "Telecel was among the first in Zimbabwe to offer per-second call billing.",
  ],
  "CBZ Bank": [
    "CBZ Bank traces back to 1980 and is one of Zimbabwe's largest financial institutions.",
  ],
  "Steward Bank": [
    "Steward Bank launched in 2013 as one of Zimbabwe's first digital-first banks.",
    "Steward Bank's USSD banking (*236#) brings banking access to feature-phone users.",
  ],
  Stanbic: [
    "Stanbic Bank Zimbabwe has banked locally since 1965, joining the Standard Bank Group in 1992.",
  ],
  FBC: ["FBC Bank, established in 1997, is known for housing and mortgage finance in Zimbabwe."],
  "ZB Bank": ["ZB Bank's roots go back to 1951, making it one of Zimbabwe's oldest banking brands."],
  Nedbank: ["Nedbank Zimbabwe traces back to 1956, originally the Merchant Bank of Central Africa."],
  "Old Mutual": [
    "Old Mutual has operated in Zimbabwe since 1902, over 120 years of life and savings cover.",
  ],
  "First Mutual": ["First Mutual has provided life and health cover in Zimbabwe for over 40 years."],
  ZIMNAT: ["ZIMNAT was founded in 1946 and offers livestock insurance for communal farmers."],
  "Fidelity Life": ["Fidelity Life Assurance has offered life cover in Zimbabwe since 1936."],
  Cimas: [
    "Cimas, founded in 1945, is one of Zimbabwe's largest medical aid societies.",
    "Cimas runs its own clinics and labs — one of the first HMO-style models in Zimbabwe.",
  ],
  "First Mutual Health": ["First Mutual Health covers a large share of medically insured Zimbabweans."],
  PSMAS: ["PSMAS was founded in 1930, one of Zimbabwe's longest-running medical aid societies."],
};

const GENERIC_FACTS = [
  "Zimbabwe's mobile penetration rate passed 100% in 2024 (POTRAZ) — many people carry more than one active SIM.",
  "Zimbabwe's multi-currency system makes comparing prices in USD the clearest way to see real value.",
  "Bundled data plans in Zimbabwe often expire in as little as 24 hours — validity matters as much as price.",
  "Building your Kuwana profile takes under a minute and unlocks personalized comparisons immediately.",
  "Kuwana only uses the providers you tell us about to tailor recommendations — never sold to third parties.",
];

/** Builds a rotating fact queue personalized to the providers a user selected, with generic facts as filler. */
export function buildFactQueue(selections: Array<string | undefined | null>): string[] {
  const facts: string[] = [];
  for (const selection of selections) {
    if (!selection) continue;
    const providerFacts = PROVIDER_FACTS[selection];
    if (providerFacts) facts.push(...providerFacts);
  }
  facts.push(...GENERIC_FACTS);
  return Array.from(new Set(facts));
}
