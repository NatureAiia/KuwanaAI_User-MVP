// Facts shown on the final "saving your profile" screen, personalized to the
// providers the user actually picked during onboarding. Kept separate from the
// step components so the fact bank can grow independently of the form UI.

const PROVIDER_FACTS: Record<string, string[]> = {
  Econet: [
    "Econet was founded in 1998 and was Zimbabwe's first licensed mobile network operator.",
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
    "CBZ Bank traces back to 1980 and is Zimbabwe's largest bank by assets.",
    "CBZ was the first Zimbabwean bank to launch contactless cards, in 2018.",
  ],
  "Steward Bank": [
    "Steward Bank launched in 2013 as Zimbabwe's first fully digital-first bank.",
    "Steward Bank pioneered USSD (*236#) banking for feature-phone users.",
  ],
  Stanbic: [
    "Stanbic Bank Zimbabwe has operated since 1992, part of the Standard Bank Group.",
  ],
  FBC: ["FBC Bank, listed since 1997, is known for housing and mortgage finance in Zimbabwe."],
  "ZB Bank": ["ZB Bank's roots go back to 1951, making it one of Zimbabwe's oldest banking brands."],
  Nedbank: ["Nedbank Zimbabwe has operated locally since 1954."],
  "Old Mutual": [
    "Old Mutual has operated in Zimbabwe since 1902, over 120 years of life and savings cover.",
  ],
  "First Mutual": ["First Mutual has provided life and health cover in Zimbabwe for over 40 years."],
  ZIMNAT: ["ZIMNAT was founded in 1946 and pioneered livestock insurance for communal farmers."],
  "Fidelity Life": ["Fidelity Life Assurance has offered life cover in Zimbabwe since 1936."],
  Cimas: [
    "Cimas, founded in 1945, is Zimbabwe's oldest medical aid society with 400k+ members.",
    "Cimas runs its own clinics and labs — one of the first HMO-style models in Zimbabwe.",
  ],
  "First Mutual Health": ["First Mutual Health covers over 150,000 lives across Zimbabwe."],
  PSMAS: ["PSMAS was founded in 1930 and is Zimbabwe's largest medical aid scheme by membership."],
};

const GENERIC_FACTS = [
  "Zimbabwe has one of the highest mobile penetration rates in Southern Africa, over 90% SIM penetration.",
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
