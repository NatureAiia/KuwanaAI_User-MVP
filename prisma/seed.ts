import { PrismaClient, Prisma } from "@prisma/client";
import { BADGE_DEFS, XP_RULES, BADGE_TRIGGERS, QUEST_TRIGGER_EVENTS } from "../src/lib/gamification/rules";
import { createPrismaAdapter } from "../src/lib/prismaAdapter";

const prisma = new PrismaClient({ adapter: createPrismaAdapter() });

// Deterministic PRNG so re-seeding produces the same synthetic history every time.
function seededRandom(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return function next() {
    h = (h * 1664525 + 1013904223) >>> 0;
    return h / 4294967296;
  };
}

// Synthetic 90-day price history ending exactly at the listing's current price,
// so listing/compare pages have a real trend to compute and display.
function buildPriceHistory(currentPrice: number, seedKey: string) {
  const rand = seededRandom(seedKey);
  const daysAgo = [90, 60, 45, 30, 15, 7, 2];
  const now = new Date("2026-08-03T00:00:00.000Z").getTime();
  let price = currentPrice * (0.85 + rand() * 0.3);
  const points = daysAgo.map((d) => {
    price = price * (1 + (rand() - 0.5) * 0.08);
    return { price: Math.round(price * 100) / 100, recordedAt: new Date(now - d * 86_400_000) };
  });
  points.push({ price: currentPrice, recordedAt: new Date(now) });
  return points;
}

// Composes a short description from the listing's own attribute values (not
// invented copy) so the listing detail page has real content to render.
function buildDescription(name: string, provider: string, attrs: Record<string, unknown>, attrDefs: AttrDef[]) {
  const parts = attrDefs
    .filter((a) => a.dataType !== "boolean" && attrs[a.key] !== undefined && attrs[a.key] !== null)
    .slice(0, 3)
    .map((a) => `${attrs[a.key]}${a.unit ? ` ${a.unit}` : ""} ${a.label.toLowerCase()}`);
  return `${name} from ${provider}${parts.length ? ` — ${parts.join(", ")}.` : "."}`;
}

// Deterministic synthetic rating/review-count, same spirit as buildPriceHistory —
// re-seeding produces the same numbers every time. ~15% of listings come back
// with no reviews at all (reviewCount 0, rating null) so the "No reviews yet"
// state has real examples too, instead of every seeded listing looking reviewed.
function buildRating(seedKey: string) {
  const rand = seededRandom(`${seedKey}-rating`);
  if (rand() < 0.15) return { rating: null, reviewCount: 0 };
  const rating = Math.round((3.6 + rand() * 1.4) * 10) / 10;
  const reviewCount = Math.floor(4 + rand() * 240);
  return { rating, reviewCount };
}

type AttrDef = {
  key: string;
  label: string;
  dataType: "number" | "string" | "enum" | "boolean";
  unit?: string;
  isComparable?: boolean;
  // Plain-language override for consumer-facing surfaces (see resolveFieldLabel).
  consumerLabel?: string;
  // Which BCI axis this field feeds as an objective input, if any (see src/lib/bci.ts).
  qualityAxis?: "value" | "trust" | "availability" | "performance" | "resilience";
  // Casual/alternate phrasings for search and intake matching.
  synonyms?: string[];
};

// A provider is usually just a name; give it a websiteUrl when the source
// is known so the "visit provider" link (see resolveProviderLink) has a
// fallback even for listings without their own sourceUrl.
type ProviderSeed = string | { name: string; websiteUrl?: string };

type SectorSeed = {
  slug: string;
  name: string;
  status: "live" | "coming_soon";
  categories: {
    slug: string;
    name: string;
    // Everyday phrasings a consumer might use for this category beyond its
    // own name — matched by classifyIntake()/resolveChatIntent().
    synonyms?: string[];
    attributes: AttrDef[];
    providers: ProviderSeed[];
    listings: {
      name: string;
      provider: string;
      price: number;
      attrs: Record<string, unknown>;
      // Optional per-listing overrides — omit to keep today's defaults
      // (no source URL, freshnessStatus "fresh").
      sourceUrl?: string;
      freshnessStatus?: "fresh" | "stale" | "unverified";
    }[];
  }[];
};

const SECTORS: SectorSeed[] = [
  {
    slug: "telecom",
    name: "Telecom",
    status: "live",
    categories: [
      {
        slug: "data-bundles",
        name: "Data bundles",
        attributes: [
          { key: "data_amount", label: "Data", dataType: "number", unit: "GB" },
          { key: "validity_days", label: "Validity", dataType: "number", unit: "days" },
          { key: "network", label: "Network", dataType: "enum" },
          { key: "speed", label: "Speed", dataType: "enum" },
        ],
        providers: ["Econet", "NetOne", "Telecel"],
        listings: [
          // NetOne 1GB $4 vs Econet 1GB $5 — the exact reference figures from
          // the uploaded docs (validity approximated at 30 days, not stated there).
          { name: "OneFusion Monthly 1GB", provider: "NetOne", price: 4, attrs: { data_amount: 1, validity_days: 30, network: "NetOne", speed: "4G" }, freshnessStatus: "unverified" },
          { name: "PowerBundle Monthly 1GB", provider: "Econet", price: 5, attrs: { data_amount: 1, validity_days: 30, network: "Econet", speed: "4G" }, freshnessStatus: "unverified" },
          { name: "Weekly Bundle 1GB", provider: "Econet", price: 1.5, attrs: { data_amount: 1, validity_days: 7, network: "Econet", speed: "4G" } },
          { name: "PowerBundle 5GB", provider: "Econet", price: 5, attrs: { data_amount: 5, validity_days: 30, network: "Econet", speed: "4G" } },
          { name: "NightBundle 10GB", provider: "Econet", price: 3, attrs: { data_amount: 10, validity_days: 1, network: "Econet", speed: "4G" } },
          { name: "PowerBundle 20GB", provider: "Econet", price: 15, attrs: { data_amount: 20, validity_days: 30, network: "Econet", speed: "5G" } },
          { name: "OneFusion Daily 500MB", provider: "NetOne", price: 0.5, attrs: { data_amount: 0.5, validity_days: 1, network: "NetOne", speed: "4G" } },
          { name: "OneFusion Weekly 3GB", provider: "NetOne", price: 3, attrs: { data_amount: 3, validity_days: 7, network: "NetOne", speed: "4G" } },
          { name: "OneFusion Monthly 15GB", provider: "NetOne", price: 12, attrs: { data_amount: 15, validity_days: 30, network: "NetOne", speed: "4G" } },
          { name: "Telecel Anytime 2GB", provider: "Telecel", price: 2, attrs: { data_amount: 2, validity_days: 7, network: "Telecel", speed: "3G" } },
          { name: "Telecel Anytime 12GB", provider: "Telecel", price: 10, attrs: { data_amount: 12, validity_days: 30, network: "Telecel", speed: "4G" } },
        ],
      },
      {
        slug: "voice-sms-bundles",
        name: "Voice & SMS bundles",
        attributes: [
          { key: "minutes", label: "Minutes", dataType: "number", unit: "min" },
          { key: "sms_count", label: "SMS", dataType: "number" },
          { key: "validity_days", label: "Validity", dataType: "number", unit: "days" },
          { key: "network", label: "Network", dataType: "enum" },
        ],
        providers: ["Econet", "NetOne", "Telecel"],
        listings: [
          { name: "Talk 60", provider: "Econet", price: 2, attrs: { minutes: 60, sms_count: 50, validity_days: 7, network: "Econet" } },
          { name: "Talk 300", provider: "Econet", price: 8, attrs: { minutes: 300, sms_count: 200, validity_days: 30, network: "Econet" } },
          { name: "Talk 1000", provider: "Econet", price: 20, attrs: { minutes: 1000, sms_count: 500, validity_days: 30, network: "Econet" } },
          { name: "OneTalk 100", provider: "NetOne", price: 3, attrs: { minutes: 100, sms_count: 100, validity_days: 30, network: "NetOne" } },
          { name: "OneTalk 500", provider: "NetOne", price: 12, attrs: { minutes: 500, sms_count: 300, validity_days: 30, network: "NetOne" } },
          { name: "Telecel Chat 150", provider: "Telecel", price: 5, attrs: { minutes: 150, sms_count: 150, validity_days: 30, network: "Telecel" } },
          { name: "Telecel Chat 400", provider: "Telecel", price: 10, attrs: { minutes: 400, sms_count: 250, validity_days: 30, network: "Telecel" } },
        ],
      },
    ],
  },
  {
    slug: "banking",
    name: "Banking",
    status: "live",
    categories: [
      {
        slug: "savings-accounts",
        name: "Savings accounts",
        attributes: [
          { key: "monthly_fee", label: "Monthly fee", dataType: "number", unit: "USD" },
          { key: "min_balance", label: "Min. balance", dataType: "number", unit: "USD" },
          { key: "interest_rate", label: "Interest rate", dataType: "number", unit: "% p.a." },
          { key: "atm_withdrawal_fee", label: "ATM withdrawal fee", dataType: "number", unit: "USD" },
          { key: "mobile_app", label: "Mobile app", dataType: "string" },
        ],
        providers: ["CBZ", "Steward Bank", "FBC", "Nedbank"],
        listings: [
          { name: "CBZ Smart Save", provider: "CBZ", price: 2, attrs: { monthly_fee: 2, min_balance: 10, interest_rate: 1.5, atm_withdrawal_fee: 1, mobile_app: "CBZ Touch App" } },
          { name: "CBZ Freedom Save", provider: "CBZ", price: 0, attrs: { monthly_fee: 0, min_balance: 0, interest_rate: 0.5, atm_withdrawal_fee: 1.5, mobile_app: "CBZ Touch App" } },
          { name: "Steward Bank Sync Save", provider: "Steward Bank", price: 1, attrs: { monthly_fee: 1, min_balance: 5, interest_rate: 2, atm_withdrawal_fee: 0.5, mobile_app: "Steward Bank App" } },
          { name: "Steward Bank Youth Save", provider: "Steward Bank", price: 0, attrs: { monthly_fee: 0, min_balance: 0, interest_rate: 1, atm_withdrawal_fee: 1, mobile_app: "Steward Bank App" } },
          { name: "FBC Gold Save", provider: "FBC", price: 3, attrs: { monthly_fee: 3, min_balance: 20, interest_rate: 2.5, atm_withdrawal_fee: 1, mobile_app: "FBC Bank App" } },
          { name: "FBC Basic Save", provider: "FBC", price: 1, attrs: { monthly_fee: 1, min_balance: 5, interest_rate: 1, atm_withdrawal_fee: 1.5 } },
          { name: "Nedbank Prime Save", provider: "Nedbank", price: 4, attrs: { monthly_fee: 4, min_balance: 50, interest_rate: 3, atm_withdrawal_fee: 2, mobile_app: "Nedbank App" } },
          { name: "Nedbank Everyday Save", provider: "Nedbank", price: 2, attrs: { monthly_fee: 2, min_balance: 10, interest_rate: 1.2, atm_withdrawal_fee: 1, mobile_app: "Nedbank App" } },
        ],
      },
      {
        slug: "current-accounts",
        name: "Current accounts",
        attributes: [
          { key: "monthly_fee", label: "Monthly fee", dataType: "number", unit: "USD" },
          { key: "min_balance", label: "Min. balance", dataType: "number", unit: "USD" },
          { key: "transaction_fee", label: "Transaction fee", dataType: "number", unit: "USD" },
          { key: "overdraft", label: "Overdraft available", dataType: "boolean" },
          { key: "branch_count", label: "Branches", dataType: "number" },
        ],
        providers: ["CBZ", "Steward Bank", "FBC", "Nedbank"],
        listings: [
          { name: "CBZ Business Current", provider: "CBZ", price: 6, attrs: { monthly_fee: 6, min_balance: 50, transaction_fee: 0.3, overdraft: true, branch_count: 60 } },
          { name: "CBZ Personal Current", provider: "CBZ", price: 3, attrs: { monthly_fee: 3, min_balance: 10, transaction_fee: 0.2, overdraft: false, branch_count: 60 } },
          { name: "Steward Bank Current", provider: "Steward Bank", price: 2, attrs: { monthly_fee: 2, min_balance: 5, transaction_fee: 0.15, overdraft: false, branch_count: 25 } },
          { name: "FBC Current Account", provider: "FBC", price: 4, attrs: { monthly_fee: 4, min_balance: 20, transaction_fee: 0.25, overdraft: true, branch_count: 18 } },
          { name: "Nedbank Current Account", provider: "Nedbank", price: 5, attrs: { monthly_fee: 5, min_balance: 30, transaction_fee: 0.35, overdraft: true, branch_count: 15 } },
          { name: "Nedbank Student Current", provider: "Nedbank", price: 0, attrs: { monthly_fee: 0, min_balance: 0, transaction_fee: 0.1, overdraft: false, branch_count: 15 } },
        ],
      },
      {
        // Real reference figures from the uploaded docs: a channel-based RTGS
        // fee differential — app ~$2 vs manual/branch $5.20 for a $500 RTGS
        // transfer on a low-cost Nostro FCA (USD) youth account.
        slug: "nostro-fca-accounts",
        name: "Nostro FCA (USD) accounts",
        synonyms: ["usd account", "foreign currency account", "dollar account"],
        attributes: [
          { key: "monthly_fee", label: "Monthly fee", dataType: "number", unit: "USD" },
          { key: "min_balance", label: "Min. balance", dataType: "number", unit: "USD", consumerLabel: "Minimum balance to open" },
          {
            key: "rtgs_fee_app",
            label: "RTGS Fee (App)",
            consumerLabel: "Sending money via app",
            dataType: "number",
            unit: "USD",
          },
          {
            key: "rtgs_fee_manual",
            label: "RTGS Fee (Manual/Branch)",
            consumerLabel: "Sending money at a branch",
            dataType: "number",
            unit: "USD",
          },
          { key: "channel_ussd", label: "USSD Channel", dataType: "boolean", qualityAxis: "availability", synonyms: ["*230#", "dial code"] },
          { key: "channel_agency", label: "Agency Banking", dataType: "boolean", qualityAxis: "availability" },
          { key: "customer_type", label: "Customer type", dataType: "enum" },
        ],
        providers: ["CBZ", "Steward Bank", "FBC"],
        listings: [
          {
            name: "CBZ Youth Nostro FCA",
            provider: "CBZ",
            price: 0,
            attrs: {
              monthly_fee: 0,
              min_balance: 0,
              rtgs_fee_app: 2,
              rtgs_fee_manual: 5.2,
              channel_ussd: true,
              channel_agency: true,
              customer_type: "Youth",
            },
            freshnessStatus: "unverified",
          },
          {
            name: "Steward Bank Youth Nostro FCA",
            provider: "Steward Bank",
            price: 0,
            attrs: {
              monthly_fee: 0,
              min_balance: 0,
              rtgs_fee_app: 2.5,
              rtgs_fee_manual: 5,
              channel_ussd: true,
              channel_agency: true,
              customer_type: "Youth",
            },
          },
          {
            name: "FBC Individual Nostro FCA",
            provider: "FBC",
            price: 2,
            attrs: {
              monthly_fee: 2,
              min_balance: 20,
              rtgs_fee_app: 3,
              rtgs_fee_manual: 6,
              channel_ussd: false,
              channel_agency: true,
              customer_type: "Individual",
            },
          },
        ],
      },
    ],
  },
  {
    slug: "insurance",
    name: "Insurance",
    status: "live",
    categories: [
      {
        slug: "motor-insurance",
        name: "Motor insurance",
        attributes: [
          { key: "premium_monthly", label: "Monthly premium", dataType: "number", unit: "USD" },
          { key: "coverage_amount", label: "Coverage", dataType: "number", unit: "USD" },
          { key: "excess", label: "Excess", dataType: "number", unit: "USD" },
          { key: "roadside_assistance", label: "Roadside assistance", dataType: "boolean" },
          { key: "claim_turnaround_days", label: "Claim turnaround", dataType: "number", unit: "days" },
        ],
        providers: ["Old Mutual", "ZIMNAT", "Fidelity Life"],
        listings: [
          { name: "Old Mutual Comprehensive", provider: "Old Mutual", price: 45, attrs: { premium_monthly: 45, coverage_amount: 15000, excess: 200, roadside_assistance: true, claim_turnaround_days: 5 } },
          { name: "Old Mutual Third Party", provider: "Old Mutual", price: 15, attrs: { premium_monthly: 15, coverage_amount: 3000, excess: 100, roadside_assistance: false, claim_turnaround_days: 7 } },
          { name: "ZIMNAT Comprehensive Plus", provider: "ZIMNAT", price: 40, attrs: { premium_monthly: 40, coverage_amount: 14000, excess: 150, roadside_assistance: true, claim_turnaround_days: 4 } },
          { name: "ZIMNAT Basic Cover", provider: "ZIMNAT", price: 12, attrs: { premium_monthly: 12, coverage_amount: 2500, excess: 100, roadside_assistance: false, claim_turnaround_days: 10 } },
          { name: "Fidelity Life Drive Secure", provider: "Fidelity Life", price: 38, attrs: { premium_monthly: 38, coverage_amount: 13000, excess: 180, roadside_assistance: true, claim_turnaround_days: 6 } },
          { name: "Fidelity Life Third Party", provider: "Fidelity Life", price: 10, attrs: { premium_monthly: 10, coverage_amount: 2000, excess: 100, roadside_assistance: false, claim_turnaround_days: 9 } },
        ],
      },
      {
        slug: "life-insurance",
        name: "Life insurance",
        attributes: [
          { key: "premium_monthly", label: "Monthly premium", dataType: "number", unit: "USD" },
          { key: "coverage_amount", label: "Coverage", dataType: "number", unit: "USD" },
          { key: "term_years", label: "Term", dataType: "number", unit: "years" },
          { key: "funeral_cover", label: "Funeral cover included", dataType: "boolean" },
          { key: "payout_speed_days", label: "Payout speed", dataType: "number", unit: "days" },
        ],
        providers: ["Old Mutual", "ZIMNAT", "Fidelity Life"],
        listings: [
          { name: "Old Mutual Family Life", provider: "Old Mutual", price: 25, attrs: { premium_monthly: 25, coverage_amount: 20000, term_years: 20, funeral_cover: true, payout_speed_days: 14 } },
          { name: "Old Mutual Life Essential", provider: "Old Mutual", price: 12, attrs: { premium_monthly: 12, coverage_amount: 8000, term_years: 10, funeral_cover: false, payout_speed_days: 21 } },
          { name: "ZIMNAT Life Cover", provider: "ZIMNAT", price: 18, attrs: { premium_monthly: 18, coverage_amount: 15000, term_years: 15, funeral_cover: true, payout_speed_days: 10 } },
          { name: "Fidelity Life Secure Future", provider: "Fidelity Life", price: 20, attrs: { premium_monthly: 20, coverage_amount: 18000, term_years: 20, funeral_cover: true, payout_speed_days: 12 } },
          { name: "Fidelity Life Starter Cover", provider: "Fidelity Life", price: 8, attrs: { premium_monthly: 8, coverage_amount: 5000, term_years: 5, funeral_cover: false, payout_speed_days: 18 } },
        ],
      },
      {
        slug: "medical-aid-plans",
        name: "Medical aid plans",
        attributes: [
          { key: "monthly_contribution", label: "Monthly contribution", dataType: "number", unit: "USD" },
          { key: "hospital_cover", label: "Hospital cover", dataType: "enum" },
          { key: "day_to_day_cover", label: "Day-to-day cover", dataType: "enum" },
          { key: "dependants_allowed", label: "Dependants allowed", dataType: "boolean" },
          { key: "dental_cover", label: "Dental & optical", dataType: "boolean" },
        ],
        providers: ["Cimas", "PSMAS", "First Mutual Health", "Alliance Health", "Aura Medical Aid Scheme", "FLIMAS"],
        listings: [
          { name: "Cimas Smart Primary", provider: "Cimas", price: 45, attrs: { monthly_contribution: 45, hospital_cover: "Limited", day_to_day_cover: "Restricted", dependants_allowed: true, dental_cover: false } },
          { name: "Cimas Premium Plan", provider: "Cimas", price: 120, attrs: { monthly_contribution: 120, hospital_cover: "Full", day_to_day_cover: "Comprehensive", dependants_allowed: true, dental_cover: true } },
          { name: "PSMAS ZimCare", provider: "PSMAS", price: 25, attrs: { monthly_contribution: 25, hospital_cover: "Limited", day_to_day_cover: "Restricted", dependants_allowed: true, dental_cover: false } },
          { name: "PSMAS MegaCare", provider: "PSMAS", price: 60, attrs: { monthly_contribution: 60, hospital_cover: "Full", day_to_day_cover: "Moderate", dependants_allowed: true, dental_cover: true } },
          { name: "First Mutual Health Essential", provider: "First Mutual Health", price: 30, attrs: { monthly_contribution: 30, hospital_cover: "Limited", day_to_day_cover: "Restricted", dependants_allowed: true, dental_cover: false } },
          { name: "First Mutual Health Classic", provider: "First Mutual Health", price: 75, attrs: { monthly_contribution: 75, hospital_cover: "Full", day_to_day_cover: "Moderate", dependants_allowed: true, dental_cover: true } },
          { name: "Alliance Health Scheme", provider: "Alliance Health", price: 35, attrs: { monthly_contribution: 35, hospital_cover: "Limited", day_to_day_cover: "Restricted", dependants_allowed: true, dental_cover: false } },
          { name: "Aura Medical Aid Scheme", provider: "Aura Medical Aid Scheme", price: 40, attrs: { monthly_contribution: 40, hospital_cover: "Full", day_to_day_cover: "Moderate", dependants_allowed: true, dental_cover: false } },
          { name: "FLIMAS Family Plan", provider: "FLIMAS", price: 28, attrs: { monthly_contribution: 28, hospital_cover: "Limited", day_to_day_cover: "Restricted", dependants_allowed: true, dental_cover: false } },
        ],
      },
    ],
  },
  {
    slug: "education",
    name: "Education",
    status: "live",
    categories: [
      {
        slug: "primary-schools",
        name: "Primary schools",
        attributes: [
          { key: "term_fees", label: "Term fees", dataType: "number", unit: "USD" },
          { key: "curriculum", label: "Curriculum", dataType: "enum" },
          { key: "boarding", label: "Boarding", dataType: "boolean" },
          { key: "student_teacher_ratio", label: "Student:teacher ratio", dataType: "number" },
          { key: "location", label: "Location", dataType: "string" },
        ],
        providers: ["Chisipite Junior", "Hartmann House", "Coghlan Primary", "Whitestone Primary"],
        listings: [
          { name: "Chisipite Junior School", provider: "Chisipite Junior", price: 650, attrs: { term_fees: 650, curriculum: "Cambridge", boarding: false, student_teacher_ratio: 15, location: "Harare" } },
          { name: "Hartmann House Primary", provider: "Hartmann House", price: 700, attrs: { term_fees: 700, curriculum: "Cambridge", boarding: false, student_teacher_ratio: 14, location: "Harare" } },
          { name: "Coghlan Primary School", provider: "Coghlan Primary", price: 180, attrs: { term_fees: 180, curriculum: "ZIMSEC", boarding: false, student_teacher_ratio: 30, location: "Harare" } },
          { name: "Whitestone Primary", provider: "Whitestone Primary", price: 550, attrs: { term_fees: 550, curriculum: "Cambridge", boarding: false, student_teacher_ratio: 16, location: "Bulawayo" } },
        ],
      },
      {
        slug: "secondary-schools",
        name: "Secondary schools",
        attributes: [
          { key: "term_fees", label: "Term fees", dataType: "number", unit: "USD" },
          { key: "curriculum", label: "Curriculum", dataType: "enum" },
          { key: "boarding", label: "Boarding", dataType: "boolean" },
          { key: "pass_rate_pct", label: "Pass rate", dataType: "number", unit: "%" },
          { key: "location", label: "Location", dataType: "string" },
        ],
        providers: ["Peterhouse", "St George's College", "Founders High", "Girls High School", "Trinity College"],
        listings: [
          { name: "Peterhouse Boys' School", provider: "Peterhouse", price: 1800, attrs: { term_fees: 1800, curriculum: "Cambridge", boarding: true, pass_rate_pct: 98, location: "Marondera" } },
          { name: "St George's College", provider: "St George's College", price: 1200, attrs: { term_fees: 1200, curriculum: "Cambridge", boarding: true, pass_rate_pct: 96, location: "Harare" } },
          { name: "Founders High School", provider: "Founders High", price: 300, attrs: { term_fees: 300, curriculum: "ZIMSEC", boarding: false, pass_rate_pct: 85, location: "Bulawayo" } },
          { name: "Girls High School", provider: "Girls High School", price: 280, attrs: { term_fees: 280, curriculum: "ZIMSEC", boarding: false, pass_rate_pct: 88, location: "Bulawayo" } },
          { name: "Trinity College", provider: "Trinity College", price: 950, attrs: { term_fees: 950, curriculum: "Cambridge", boarding: true, pass_rate_pct: 94, location: "Harare" } },
        ],
      },
      {
        slug: "universities",
        name: "Universities & tertiary",
        attributes: [
          { key: "tuition_per_year", label: "Tuition (per year)", dataType: "number", unit: "USD" },
          { key: "program_count", label: "Programmes", dataType: "number" },
          { key: "residential", label: "On-campus accommodation", dataType: "boolean" },
          { key: "study_mode", label: "Study mode", dataType: "enum" },
          { key: "location", label: "Location", dataType: "string" },
        ],
        providers: [
          "University of Zimbabwe",
          "NUST",
          "Midlands State University",
          "Harare Institute of Technology",
          "Great Zimbabwe University",
          "Chinhoyi University of Technology",
        ],
        listings: [
          { name: "University of Zimbabwe — Bachelor's programmes", provider: "University of Zimbabwe", price: 900, attrs: { tuition_per_year: 900, program_count: 100, residential: true, study_mode: "Full-time", location: "Harare" } },
          { name: "NUST — Undergraduate programmes", provider: "NUST", price: 950, attrs: { tuition_per_year: 950, program_count: 60, residential: true, study_mode: "Full-time", location: "Bulawayo" } },
          { name: "Midlands State University — Undergraduate", provider: "Midlands State University", price: 750, attrs: { tuition_per_year: 750, program_count: 85, residential: true, study_mode: "Full-time", location: "Gweru" } },
          { name: "Harare Institute of Technology — BSc programmes", provider: "Harare Institute of Technology", price: 1100, attrs: { tuition_per_year: 1100, program_count: 30, residential: false, study_mode: "Full-time", location: "Harare" } },
          { name: "Great Zimbabwe University — Undergraduate", provider: "Great Zimbabwe University", price: 700, attrs: { tuition_per_year: 700, program_count: 70, residential: true, study_mode: "Full-time", location: "Masvingo" } },
          { name: "Chinhoyi University of Technology — BSc programmes", provider: "Chinhoyi University of Technology", price: 800, attrs: { tuition_per_year: 800, program_count: 40, residential: true, study_mode: "Full-time", location: "Chinhoyi" } },
        ],
      },
    ],
  },
  {
    // Medical aid plans moved to the insurance sector above — kept as an
    // empty shell (rather than deleted) for future healthcare categories
    // like doctors/clinics.
    slug: "healthcare",
    name: "Healthcare",
    status: "live",
    categories: [],
  },
  {
    slug: "transport",
    name: "Transport",
    status: "live",
    categories: [
      {
        slug: "bus-fares",
        name: "Intercity bus fares",
        attributes: [
          { key: "fare", label: "Fare", dataType: "number", unit: "USD" },
          { key: "route", label: "Route", dataType: "string" },
          { key: "duration_hours", label: "Duration", dataType: "number", unit: "hours" },
          { key: "class", label: "Class", dataType: "enum" },
        ],
        providers: [
          // No confirmed official ZUPCO website turned up in research —
          // each listing below cites the fare source directly instead.
          "ZUPCO",
          { name: "CityLink Luxury Coaches", websiteUrl: "https://www.citylinkcoaches.co.zw/" },
          // Pathfinder's own site couldn't be confirmed either; the listing
          // below cites the third-party profile the fare range came from.
          "Pathfinder Luxury Coaches",
        ],
        listings: [
          // Fares confirmed via zimpricecheck.com's bus-fare price-update page.
          {
            name: "ZUPCO Harare–Bulawayo",
            provider: "ZUPCO",
            price: 15,
            attrs: { fare: 15, route: "Harare–Bulawayo", duration_hours: 6, class: "Standard" },
            sourceUrl: "https://zimpricecheck.com/price-updates/bus-fare-and-transport-costs/",
          },
          {
            name: "ZUPCO Harare–Mutare",
            provider: "ZUPCO",
            price: 10,
            attrs: { fare: 10, route: "Harare–Mutare", duration_hours: 4, class: "Standard" },
            sourceUrl: "https://zimpricecheck.com/price-updates/bus-fare-and-transport-costs/",
          },
          {
            name: "ZUPCO Harare–Gweru",
            provider: "ZUPCO",
            price: 12,
            attrs: { fare: 12, route: "Harare–Gweru", duration_hours: 3, class: "Standard" },
            sourceUrl: "https://zimpricecheck.com/price-updates/bus-fare-and-transport-costs/",
          },
          // Fare is an approximate corridor figure (couldn't fetch CityLink's
          // fares page directly) — flagged unverified for an admin to confirm.
          {
            name: "CityLink Harare–Bulawayo (Luxury)",
            provider: "CityLink Luxury Coaches",
            price: 25,
            attrs: { fare: 25, route: "Harare–Bulawayo", duration_hours: 5, class: "Luxury" },
            sourceUrl: "https://www.citylinkcoaches.co.zw/routes-fares/",
            freshnessStatus: "unverified",
          },
          {
            name: "Pathfinder Harare–Bulawayo (Luxury)",
            provider: "Pathfinder Luxury Coaches",
            price: 25,
            attrs: { fare: 25, route: "Harare–Bulawayo", duration_hours: 5, class: "Luxury" },
            sourceUrl: "https://www.victoriafalls-guide.net/pathfinder-bus.html",
            freshnessStatus: "unverified",
          },
        ],
      },
    ],
  },
  {
    slug: "utilities",
    name: "Utilities",
    status: "live",
    categories: [
      {
        slug: "prepaid-tokens",
        name: "Prepaid tokens",
        attributes: [
          { key: "fee_per_transaction", label: "Fee per transaction", dataType: "number", unit: "USD" },
          { key: "processing_time", label: "Processing time", dataType: "number", unit: "min" },
          { key: "channel", label: "Channel", dataType: "enum" },
        ],
        providers: ["ZESA ZETDC", "EcoCash", "OneMoney"],
        listings: [
          { name: "ZESA Token via ZETDC USSD", provider: "ZESA ZETDC", price: 0.5, attrs: { fee_per_transaction: 0.5, processing_time: 2, channel: "USSD" } },
          { name: "ZESA Token via EcoCash", provider: "EcoCash", price: 0.3, attrs: { fee_per_transaction: 0.3, processing_time: 1, channel: "App" } },
          { name: "ZESA Token via OneMoney Agent", provider: "OneMoney", price: 1, attrs: { fee_per_transaction: 1, processing_time: 5, channel: "Agent" } },
        ],
      },
      {
        slug: "vehicle-licensing",
        name: "Vehicle licensing",
        attributes: [
          { key: "license_period", label: "Period", dataType: "enum" },
          { key: "vehicle_class", label: "Vehicle class", dataType: "enum" },
          { key: "channel", label: "Channel", dataType: "enum" },
          { key: "processing_time", label: "Processing time", dataType: "number", unit: "min" },
        ],
        providers: ["ZINARA"],
        listings: [
          { name: "ZINARA Private vehicle — 1 year (sedan)", provider: "ZINARA", price: 55, attrs: { license_period: "1 year", vehicle_class: "Private", channel: "ZINARA office", processing_time: 20 } },
          { name: "ZINARA Private vehicle — 6 months (sedan)", provider: "ZINARA", price: 30, attrs: { license_period: "6 months", vehicle_class: "Private", channel: "ZINARA office", processing_time: 20 } },
          { name: "ZINARA Commuter omnibus — 1 year", provider: "ZINARA", price: 120, attrs: { license_period: "1 year", vehicle_class: "Commercial", channel: "ZINARA office", processing_time: 25 } },
          { name: "ZINARA Heavy truck — 1 year", provider: "ZINARA", price: 180, attrs: { license_period: "1 year", vehicle_class: "Commercial", channel: "ZINARA office", processing_time: 30 } },
        ],
      },
      {
        slug: "water-bills",
        name: "Municipal water",
        attributes: [
          { key: "monthly_usage", label: "Usage", dataType: "number", unit: "kl" },
          { key: "billing_frequency", label: "Billing", dataType: "enum" },
          { key: "payment_channel", label: "Payment channel", dataType: "enum" },
          { key: "prepaid_available", label: "Prepaid available", dataType: "boolean" },
        ],
        providers: ["City of Harare", "City of Bulawayo"],
        listings: [
          { name: "City of Harare water — domestic (20 kl/mo)", provider: "City of Harare", price: 35, attrs: { monthly_usage: 20, billing_frequency: "Monthly", payment_channel: "City council + EcoCash", prepaid_available: true } },
          { name: "City of Harare water — domestic (40 kl/mo)", provider: "City of Harare", price: 70, attrs: { monthly_usage: 40, billing_frequency: "Monthly", payment_channel: "City council + EcoCash", prepaid_available: true } },
          { name: "City of Bulawayo water — domestic (20 kl/mo)", provider: "City of Bulawayo", price: 32, attrs: { monthly_usage: 20, billing_frequency: "Monthly", payment_channel: "City council + EcoCash", prepaid_available: true } },
          { name: "City of Bulawayo water — domestic (40 kl/mo)", provider: "City of Bulawayo", price: 62, attrs: { monthly_usage: 40, billing_frequency: "Monthly", payment_channel: "City council + EcoCash", prepaid_available: true } },
        ],
      },
      {
        slug: "property-rates",
        name: "Property rates",
        attributes: [
          { key: "property_value", label: "Property value", dataType: "number", unit: "USD" },
          { key: "billing_frequency", label: "Billing", dataType: "enum" },
          { key: "payment_channel", label: "Payment channel", dataType: "enum" },
          { key: "rates_percent", label: "Rate", dataType: "number", unit: "% p.a." },
        ],
        providers: ["City of Harare", "City of Bulawayo"],
        listings: [
          { name: "City of Harare rates — dwelling (val $50k)", provider: "City of Harare", price: 25, attrs: { property_value: 50000, billing_frequency: "Monthly", payment_channel: "City council + EcoCash", rates_percent: 0.6 } },
          { name: "City of Harare rates — dwelling (val $25k)", provider: "City of Harare", price: 13, attrs: { property_value: 25000, billing_frequency: "Monthly", payment_channel: "City council + EcoCash", rates_percent: 0.6 } },
          { name: "City of Bulawayo rates — dwelling (val $50k)", provider: "City of Bulawayo", price: 22, attrs: { property_value: 50000, billing_frequency: "Monthly", payment_channel: "City council + EcoCash", rates_percent: 0.5 } },
          { name: "City of Bulawayo rates — dwelling (val $25k)", provider: "City of Bulawayo", price: 11, attrs: { property_value: 25000, billing_frequency: "Monthly", payment_channel: "City council + EcoCash", rates_percent: 0.5 } },
        ],
      },
    ],
  },
  {
    slug: "pharmacy",
    name: "Pharmacy",
    status: "live",
    categories: [
      {
        slug: "otc-essentials",
        name: "OTC & health essentials",
        attributes: [
          { key: "pack_size", label: "Pack size", dataType: "string" },
          { key: "stock_status", label: "Stock status", dataType: "enum" },
        ],
        providers: ["TM Pharmacy", "Greens Pharmacy", "Clicks"],
        listings: [
          { name: "Paracetamol 500mg (20 tabs)", provider: "TM Pharmacy", price: 1.5, attrs: { pack_size: "20 tabs", stock_status: "In stock" } },
          { name: "Paracetamol 500mg (20 tabs)", provider: "Greens Pharmacy", price: 1.8, attrs: { pack_size: "20 tabs", stock_status: "In stock" } },
          { name: "Oral Rehydration Salts (1 sachet)", provider: "Clicks", price: 0.6, attrs: { pack_size: "1 sachet", stock_status: "In stock" } },
          { name: "Multivitamin (30 tabs)", provider: "TM Pharmacy", price: 4.5, attrs: { pack_size: "30 tabs", stock_status: "Low stock" } },
        ],
      },
    ],
  },
  {
    slug: "electronics",
    name: "Tech & Electronics",
    status: "live",
    categories: [
      {
        slug: "tech-gadgets",
        name: "Tech & Gadgets",
        attributes: [
          { key: "device_type", label: "Type", dataType: "enum" },
          { key: "storage_gb", label: "Storage", dataType: "number", unit: "GB" },
          { key: "warranty_months", label: "Warranty", dataType: "number", unit: "months" },
          { key: "condition", label: "Condition", dataType: "enum" },
        ],
        providers: ["TechZone", "Electromart", "HiFi Corp"],
        listings: [
          { name: "Samsung Galaxy A15 128GB", provider: "TechZone", price: 189, attrs: { device_type: "Phone", storage_gb: 128, warranty_months: 12, condition: "New" } },
          { name: "Xiaomi Redmi Note 13 128GB", provider: "Electromart", price: 165, attrs: { device_type: "Phone", storage_gb: 128, warranty_months: 12, condition: "New" } },
          { name: "iPhone 12 64GB Refurbished", provider: "Electromart", price: 320, attrs: { device_type: "Phone", storage_gb: 64, warranty_months: 6, condition: "Refurbished" } },
          { name: "HP Pavilion 15 Laptop 512GB", provider: "HiFi Corp", price: 650, attrs: { device_type: "Laptop", storage_gb: 512, warranty_months: 24, condition: "New" } },
          { name: "Lenovo IdeaPad 3 256GB", provider: "TechZone", price: 480, attrs: { device_type: "Laptop", storage_gb: 256, warranty_months: 12, condition: "New" } },
          { name: "Samsung Galaxy Tab A9 64GB", provider: "Electromart", price: 210, attrs: { device_type: "Tablet", storage_gb: 64, warranty_months: 12, condition: "New" } },
          { name: "JBL Bluetooth Speaker", provider: "HiFi Corp", price: 35, attrs: { device_type: "Accessory", storage_gb: 0, warranty_months: 6, condition: "New" } },
          { name: "Anker Power Bank 20000mAh", provider: "TechZone", price: 28, attrs: { device_type: "Accessory", storage_gb: 0, warranty_months: 6, condition: "New" } },
        ],
      },
      {
        slug: "ai-tools",
        name: "AI Tools & Subscriptions",
        attributes: [
          { key: "plan_type", label: "Plan", dataType: "enum" },
          { key: "context_window_k", label: "Context window", dataType: "number", unit: "K tokens" },
          { key: "platform", label: "Platform", dataType: "enum" },
        ],
        providers: ["OpenAI", "Anthropic", "Google", "Microsoft", "Perplexity"],
        listings: [
          { name: "ChatGPT Plus", provider: "OpenAI", price: 20, attrs: { plan_type: "Plus", context_window_k: 128, platform: "All" } },
          { name: "ChatGPT Team", provider: "OpenAI", price: 30, attrs: { plan_type: "Team", context_window_k: 128, platform: "All" } },
          { name: "Claude Pro", provider: "Anthropic", price: 20, attrs: { plan_type: "Pro", context_window_k: 200, platform: "All" } },
          { name: "Gemini Advanced", provider: "Google", price: 20, attrs: { plan_type: "Pro", context_window_k: 1000, platform: "All" } },
          { name: "Copilot Pro", provider: "Microsoft", price: 20, attrs: { plan_type: "Pro", context_window_k: 128, platform: "All" } },
          { name: "Perplexity Pro", provider: "Perplexity", price: 20, attrs: { plan_type: "Pro", context_window_k: 128, platform: "All" } },
        ],
      },
    ],
  },
  {
    slug: "fashion",
    name: "Clothes",
    status: "live",
    categories: [
      {
        slug: "clothing",
        name: "Clothing",
        attributes: [
          { key: "garment_type", label: "Type", dataType: "enum" },
          { key: "size_range", label: "Sizes", dataType: "string" },
          { key: "material", label: "Material", dataType: "string" },
        ],
        providers: ["Edgars", "Truworths", "Bata", "Topics"],
        listings: [
          { name: "Edgars Men's Basic Tee", provider: "Edgars", price: 8, attrs: { garment_type: "T-Shirt", size_range: "S-XXL", material: "Cotton" } },
          { name: "Truworths Women's Summer Dress", provider: "Truworths", price: 22, attrs: { garment_type: "Dress", size_range: "S-XL", material: "Polyester blend" } },
          { name: "Edgars Slim Fit Jeans", provider: "Edgars", price: 25, attrs: { garment_type: "Jeans", size_range: "28-38", material: "Denim" } },
          { name: "Truworths Men's Chinos", provider: "Truworths", price: 20, attrs: { garment_type: "Jeans", size_range: "30-40", material: "Cotton twill" } },
          { name: "Bata Men's Formal Shoes", provider: "Bata", price: 32, attrs: { garment_type: "Shoes", size_range: "6-11", material: "Leather" } },
          { name: "Bata Women's Sandals", provider: "Bata", price: 15, attrs: { garment_type: "Shoes", size_range: "4-9", material: "Synthetic" } },
          { name: "Topics Kids Hoodie", provider: "Topics", price: 12, attrs: { garment_type: "Jacket", size_range: "4-12yrs", material: "Fleece" } },
          { name: "Edgars Winter Jacket", provider: "Edgars", price: 40, attrs: { garment_type: "Jacket", size_range: "S-XXL", material: "Polyester fill" } },
        ],
      },
    ],
  },
  {
    slug: "hotels",
    name: "Hotels",
    status: "live",
    categories: [
      {
        slug: "hotel-stays",
        name: "Hotels & stays",
        attributes: [
          { key: "price_per_night", label: "Price per night", dataType: "number", unit: "USD" },
          { key: "room_type", label: "Room type", dataType: "enum" },
          { key: "location", label: "Location", dataType: "string" },
          { key: "breakfast_included", label: "Breakfast included", dataType: "boolean" },
          { key: "pool", label: "Swimming pool", dataType: "boolean" },
        ],
        providers: ["Meikles", "Rainbow Towers", "Cresta", "Holiday Inn", "Victoria Falls Safari Lodge", "Kingdom Hotel"],
        listings: [
          { name: "Meikles Hotel — Standard Room", provider: "Meikles", price: 180, attrs: { price_per_night: 180, room_type: "Standard", location: "Harare", breakfast_included: true, pool: true } },
          { name: "Meikles Hotel — Executive Room", provider: "Meikles", price: 240, attrs: { price_per_night: 240, room_type: "Executive", location: "Harare", breakfast_included: true, pool: true } },
          { name: "Rainbow Towers — Standard Room", provider: "Rainbow Towers", price: 120, attrs: { price_per_night: 120, room_type: "Standard", location: "Harare", breakfast_included: true, pool: true } },
          { name: "Rainbow Towers — Deluxe Room", provider: "Rainbow Towers", price: 160, attrs: { price_per_night: 160, room_type: "Deluxe", location: "Harare", breakfast_included: true, pool: true } },
          { name: "Cresta Oasis — Standard Room", provider: "Cresta", price: 70, attrs: { price_per_night: 70, room_type: "Standard", location: "Harare", breakfast_included: true, pool: false } },
          { name: "Holiday Inn Harare — Standard Room", provider: "Holiday Inn", price: 85, attrs: { price_per_night: 85, room_type: "Standard", location: "Harare", breakfast_included: true, pool: true } },
          { name: "Victoria Falls Safari Lodge — Standard Room", provider: "Victoria Falls Safari Lodge", price: 350, attrs: { price_per_night: 350, room_type: "Standard", location: "Victoria Falls", breakfast_included: true, pool: true } },
          { name: "Kingdom Hotel — Standard Room", provider: "Kingdom Hotel", price: 150, attrs: { price_per_night: 150, room_type: "Standard", location: "Victoria Falls", breakfast_included: true, pool: true } },
          { name: "Holiday Inn Bulawayo — Standard Room", provider: "Holiday Inn", price: 80, attrs: { price_per_night: 80, room_type: "Standard", location: "Bulawayo", breakfast_included: true, pool: false } },
          { name: "Cresta Churchill — Standard Room", provider: "Cresta", price: 60, attrs: { price_per_night: 60, room_type: "Standard", location: "Bulawayo", breakfast_included: true, pool: false } },
        ],
      },
    ],
  },
  {
    slug: "retail",
    name: "Retail & Groceries",
    status: "live",
    categories: [
      {
        slug: "maize-meal",
        name: "Maize meal (10kg)",
        attributes: [
          { key: "brand", label: "Brand", dataType: "string" },
          { key: "pack_size", label: "Pack size", dataType: "string" },
          { key: "store", label: "Store", dataType: "enum" },
        ],
        providers: ["Pick n Pay", "Spar", "Bon Marché", "OK Zimbabwe", "Choppies"],
        listings: [
          { name: "White Star Maize Meal 10kg", provider: "Pick n Pay", price: 8.5, attrs: { brand: "White Star", pack_size: "10kg", store: "Pick n Pay" } },
          { name: "White Star Maize Meal 10kg", provider: "Spar", price: 8.2, attrs: { brand: "White Star", pack_size: "10kg", store: "Spar" } },
          { name: "White Star Maize Meal 10kg", provider: "Bon Marché", price: 8.9, attrs: { brand: "White Star", pack_size: "10kg", store: "Bon Marché" } },
          { name: "White Star Maize Meal 10kg", provider: "OK Zimbabwe", price: 8.3, attrs: { brand: "White Star", pack_size: "10kg", store: "OK Zimbabwe" } },
          { name: "White Star Maize Meal 10kg", provider: "Choppies", price: 7.9, attrs: { brand: "White Star", pack_size: "10kg", store: "Choppies" } },
        ],
      },
      {
        slug: "cooking-oil",
        name: "Cooking oil (2L)",
        attributes: [
          { key: "brand", label: "Brand", dataType: "string" },
          { key: "pack_size", label: "Pack size", dataType: "string" },
          { key: "store", label: "Store", dataType: "enum" },
        ],
        providers: ["Pick n Pay", "Spar", "Bon Marché", "OK Zimbabwe", "Choppies"],
        listings: [
          { name: "Dona Cooking Oil 2L", provider: "Pick n Pay", price: 6.4, attrs: { brand: "Dona", pack_size: "2L", store: "Pick n Pay" } },
          { name: "Dona Cooking Oil 2L", provider: "Spar", price: 6.1, attrs: { brand: "Dona", pack_size: "2L", store: "Spar" } },
          { name: "Dona Cooking Oil 2L", provider: "Bon Marché", price: 6.6, attrs: { brand: "Dona", pack_size: "2L", store: "Bon Marché" } },
          { name: "Dona Cooking Oil 2L", provider: "OK Zimbabwe", price: 6.2, attrs: { brand: "Dona", pack_size: "2L", store: "OK Zimbabwe" } },
          { name: "Dona Cooking Oil 2L", provider: "Choppies", price: 5.9, attrs: { brand: "Dona", pack_size: "2L", store: "Choppies" } },
        ],
      },
      {
        slug: "sugar",
        name: "Sugar (2kg)",
        attributes: [
          { key: "brand", label: "Brand", dataType: "string" },
          { key: "pack_size", label: "Pack size", dataType: "string" },
          { key: "store", label: "Store", dataType: "enum" },
        ],
        providers: ["Pick n Pay", "Spar", "Bon Marché", "OK Zimbabwe", "Choppies"],
        listings: [
          { name: "Star Sugar 2kg", provider: "Pick n Pay", price: 3.8, attrs: { brand: "Star Sugar", pack_size: "2kg", store: "Pick n Pay" } },
          { name: "Star Sugar 2kg", provider: "Spar", price: 3.6, attrs: { brand: "Star Sugar", pack_size: "2kg", store: "Spar" } },
          { name: "Star Sugar 2kg", provider: "Bon Marché", price: 4.0, attrs: { brand: "Star Sugar", pack_size: "2kg", store: "Bon Marché" } },
          { name: "Star Sugar 2kg", provider: "OK Zimbabwe", price: 3.7, attrs: { brand: "Star Sugar", pack_size: "2kg", store: "OK Zimbabwe" } },
          { name: "Star Sugar 2kg", provider: "Choppies", price: 3.5, attrs: { brand: "Star Sugar", pack_size: "2kg", store: "Choppies" } },
        ],
      },
      {
        slug: "rice",
        name: "Rice (5kg)",
        attributes: [
          { key: "brand", label: "Brand", dataType: "string" },
          { key: "pack_size", label: "Pack size", dataType: "string" },
          { key: "store", label: "Store", dataType: "enum" },
        ],
        providers: ["Pick n Pay", "Spar", "Bon Marché", "OK Zimbabwe", "Choppies"],
        listings: [
          { name: "Yummy Rice 5kg", provider: "Pick n Pay", price: 9.5, attrs: { brand: "Yummy", pack_size: "5kg", store: "Pick n Pay" } },
          { name: "Yummy Rice 5kg", provider: "Spar", price: 9.1, attrs: { brand: "Yummy", pack_size: "5kg", store: "Spar" } },
          { name: "Yummy Rice 5kg", provider: "Bon Marché", price: 9.8, attrs: { brand: "Yummy", pack_size: "5kg", store: "Bon Marché" } },
          { name: "Yummy Rice 5kg", provider: "OK Zimbabwe", price: 9.3, attrs: { brand: "Yummy", pack_size: "5kg", store: "OK Zimbabwe" } },
          { name: "Yummy Rice 5kg", provider: "Choppies", price: 8.9, attrs: { brand: "Yummy", pack_size: "5kg", store: "Choppies" } },
        ],
      },
      {
        // Real reference figures from the uploaded 7-sector docs: cement
        // "$11-14" and solar "$0.31/W (Jinko 550W $170) vs $0.50/W (generic
        // 100W $50)" — spread within the stated ranges, not invented beyond
        // them; per-retailer prices otherwise unverified.
        slug: "building-materials",
        name: "Building materials",
        synonyms: ["cement", "bricks", "building supplies"],
        attributes: [
          { key: "material", label: "Material", dataType: "enum" },
          { key: "pack_size", label: "Pack size", dataType: "string" },
          { key: "store", label: "Store", dataType: "enum" },
        ],
        providers: ["OK Zimbabwe", "N Richards Wholesale", "Halsteds"],
        listings: [
          { name: "PPC Cement 50kg", provider: "OK Zimbabwe", price: 14, attrs: { material: "Cement", pack_size: "50kg", store: "OK Zimbabwe" }, freshnessStatus: "unverified" },
          { name: "PPC Cement 50kg", provider: "N Richards Wholesale", price: 11, attrs: { material: "Cement", pack_size: "50kg", store: "N Richards Wholesale" }, freshnessStatus: "unverified" },
          { name: "PPC Cement 50kg", provider: "Halsteds", price: 12.5, attrs: { material: "Cement", pack_size: "50kg", store: "Halsteds" }, freshnessStatus: "unverified" },
        ],
      },
      {
        slug: "solar-equipment",
        name: "Solar equipment",
        synonyms: ["solar panel", "solar power", "off-grid power"],
        attributes: [
          { key: "watts", label: "Wattage", dataType: "number", unit: "W" },
          { key: "cost_per_watt", label: "Cost per watt", dataType: "number", unit: "USD/W", qualityAxis: "value" },
          { key: "brand", label: "Brand", dataType: "string" },
          { key: "store", label: "Store", dataType: "enum" },
        ],
        providers: ["OK Zimbabwe", "N Richards Wholesale"],
        listings: [
          { name: "Jinko 550W Solar Panel", provider: "N Richards Wholesale", price: 170, attrs: { watts: 550, cost_per_watt: 0.31, brand: "Jinko", store: "N Richards Wholesale" }, freshnessStatus: "unverified" },
          { name: "Generic 100W Solar Panel", provider: "OK Zimbabwe", price: 50, attrs: { watts: 100, cost_per_watt: 0.5, brand: "Generic", store: "OK Zimbabwe" }, freshnessStatus: "unverified" },
        ],
      },
    ],
  },
  {
    // Net-new sector (see src/lib/sectors.ts) — the 7th of the uploaded
    // docs' 7 sectors. One real cited figure (Chicken Inn's "2-piecer"),
    // the rest are illustrative placeholders in the same synthetic-but-
    // plausible style the Banking/Telecom sectors above already use.
    slug: "food",
    name: "Food & Drink",
    status: "live",
    categories: [
      {
        slug: "fast-food",
        name: "Fast food",
        synonyms: ["takeaway", "quick meal", "fast food chains"],
        attributes: [
          { key: "meal", label: "Meal", dataType: "string" },
          { key: "delivery", label: "Delivery available", dataType: "boolean", qualityAxis: "availability" },
          { key: "halal", label: "Halal", dataType: "boolean" },
        ],
        providers: ["Chicken Inn", "Pizza Inn", "Nando's"],
        listings: [
          {
            name: "2-Piece Chicken Combo",
            provider: "Chicken Inn",
            price: 3,
            attrs: { meal: "2-piece chicken + chips", delivery: true, halal: false },
            freshnessStatus: "unverified",
          },
          { name: "Medium Pepperoni Pizza", provider: "Pizza Inn", price: 8, attrs: { meal: "Medium pizza", delivery: true, halal: false }, freshnessStatus: "unverified" },
          { name: "Quarter Chicken Meal", provider: "Nando's", price: 7, attrs: { meal: "Quarter chicken + side", delivery: true, halal: true }, freshnessStatus: "unverified" },
        ],
      },
      {
        slug: "casual-dining",
        name: "Casual dining",
        synonyms: ["restaurant", "sit-down meal"],
        attributes: [
          { key: "cuisine", label: "Cuisine", dataType: "string" },
          { key: "seating", label: "Seating available", dataType: "boolean", qualityAxis: "availability" },
        ],
        providers: ["Victoria 22", "Cafe Nush"],
        listings: [
          { name: "Steak & Chips", provider: "Victoria 22", price: 25, attrs: { cuisine: "Zimbabwean/International", seating: true }, freshnessStatus: "unverified" },
          { name: "Breakfast Platter", provider: "Cafe Nush", price: 8, attrs: { cuisine: "Cafe", seating: true }, freshnessStatus: "unverified" },
        ],
      },
    ],
  },
];

async function main() {
  for (const sectorSeed of SECTORS) {
    const sector = await prisma.sectorConfig.upsert({
      where: { slug: sectorSeed.slug },
      update: { name: sectorSeed.name, status: sectorSeed.status },
      create: { slug: sectorSeed.slug, name: sectorSeed.name, status: sectorSeed.status },
    });

    for (const catSeed of sectorSeed.categories) {
      const category = await prisma.category.upsert({
        where: { sectorId_slug: { sectorId: sector.id, slug: catSeed.slug } },
        update: { name: catSeed.name, synonyms: catSeed.synonyms ?? [] },
        create: { sectorId: sector.id, slug: catSeed.slug, name: catSeed.name, synonyms: catSeed.synonyms ?? [] },
      });

      for (const [i, attr] of catSeed.attributes.entries()) {
        if (!attr.label || !attr.label.trim()) {
          throw new Error(
            `Seed error: attribute "${attr.key}" in category "${catSeed.slug}" (sector "${sectorSeed.slug}") ` +
              "has no human-readable label — every comparable attribute must have one (see savings-accounts above for the pattern).",
          );
        }
        await prisma.attributeSchemaField.upsert({
          where: { categoryId_key: { categoryId: category.id, key: attr.key } },
          update: {
            label: attr.label,
            dataType: attr.dataType,
            unit: attr.unit,
            sortOrder: i,
            consumerLabel: attr.consumerLabel ?? null,
            qualityAxis: attr.qualityAxis ?? null,
            synonyms: attr.synonyms ?? [],
          },
          create: {
            categoryId: category.id,
            key: attr.key,
            label: attr.label,
            dataType: attr.dataType,
            unit: attr.unit,
            isComparable: attr.isComparable ?? true,
            sortOrder: i,
            consumerLabel: attr.consumerLabel ?? null,
            qualityAxis: attr.qualityAxis ?? null,
            synonyms: attr.synonyms ?? [],
          },
        });
      }

      const providerIdByName = new Map<string, string>();
      for (const p of catSeed.providers) {
        const name = typeof p === "string" ? p : p.name;
        const websiteUrl = typeof p === "string" ? undefined : p.websiteUrl;
        const provider = await prisma.provider.upsert({
          where: { id: `${sectorSeed.slug}-${name}` },
          // Only touch websiteUrl when the seed actually specifies one — a
          // re-seed must never blank out a URL an admin set via /admin/catalog.
          update: websiteUrl ? { websiteUrl } : {},
          create: { id: `${sectorSeed.slug}-${name}`, name, verified: true, ...(websiteUrl ? { websiteUrl } : {}) },
        });
        providerIdByName.set(name, provider.id);
      }

      for (const listing of catSeed.listings) {
        const providerId = providerIdByName.get(listing.provider)!;
        const existing = await prisma.listing.findFirst({
          where: { categoryId: category.id, name: listing.name, providerId },
        });
        const seedKey = `${category.slug}-${listing.provider}-${listing.name}`;
        const data = {
          categoryId: category.id,
          providerId,
          name: listing.name,
          description: buildDescription(listing.name, listing.provider, listing.attrs, catSeed.attributes),
          attributes: listing.attrs as Prisma.InputJsonValue,
          price: listing.price,
          currency: "USD",
          sourceUrl: listing.sourceUrl ?? null,
          freshnessStatus: listing.freshnessStatus ?? ("fresh" as const),
          lastVerifiedAt: new Date(),
          ...buildRating(seedKey),
        };
        const listingRecord = existing
          ? await prisma.listing.update({ where: { id: existing.id }, data })
          : await prisma.listing.create({ data });

        await prisma.listingPriceHistory.deleteMany({ where: { listingId: listingRecord.id } });
        const history = buildPriceHistory(listing.price, seedKey);
        await prisma.listingPriceHistory.createMany({
          data: history.map((h) => ({ listingId: listingRecord.id, price: h.price, recordedAt: h.recordedAt })),
        });
      }
    }
  }

  // Electromart is seeded as an unverified reseller (grey-market/parallel-import electronics are
  // common in this market) so the provider-trust signal (Decision Score, compare/regulator views)
  // has a real example to surface instead of every seeded provider being verified.
  await prisma.provider.update({ where: { id: "electronics-Electromart" }, data: { verified: false } });

  // The 5 fixed BCI axes (see src/lib/bci.ts) — display names are
  // admin-editable afterwards, the axis enum value is the stable slug.
  // Weights match the docs' own default split: Value 25 / Trust 25 /
  // Availability 20 / Performance 15 / Resilience 15.
  const AXIS_SEEDS: { axis: "value" | "trust" | "availability" | "performance" | "resilience"; displayName: string; description: string; defaultWeight: number }[] = [
    { axis: "value", displayName: "Value for Money", description: "Price and fees relative to peers.", defaultWeight: 0.25 },
    { axis: "trust", displayName: "Trust & Safety", description: "Regulator standing and verification.", defaultWeight: 0.25 },
    { axis: "availability", displayName: "Availability", description: "Channel/branch/service coverage.", defaultWeight: 0.2 },
    { axis: "performance", displayName: "Performance", description: "Speed and quality of service.", defaultWeight: 0.15 },
    { axis: "resilience", displayName: "Resilience", description: "Backup channels and outage recovery.", defaultWeight: 0.15 },
  ];
  for (const a of AXIS_SEEDS) {
    await prisma.qualityAxisConfig.upsert({
      where: { axis: a.axis },
      update: { displayName: a.displayName, description: a.description, defaultWeight: a.defaultWeight },
      create: { axis: a.axis, displayName: a.displayName, description: a.description, defaultWeight: a.defaultWeight },
    });
  }

  // A handful of real, publicly known homepages as scrape-pipeline targets
  // for the sectors this round added/extended — ready for Firecrawl to crawl
  // once a real instance is configured (FIRECRAWL_API_URL/KEY in production;
  // none is running in dev, so these are registered but not run here). Not
  // an exhaustive source list — a starting point per sector, added to over
  // time via /admin/scraper same as any other source.
  const SCRAPE_SOURCE_SEEDS: { name: string; url: string; sectorSlug: string; categorySlug: string }[] = [
    { name: "Econet Zimbabwe", url: "https://www.econet.co.zw/", sectorSlug: "telecom", categorySlug: "data-bundles" },
    { name: "NetOne Zimbabwe", url: "https://www.netone.co.zw/", sectorSlug: "telecom", categorySlug: "data-bundles" },
    { name: "CBZ Bank", url: "https://www.cbz.co.zw/", sectorSlug: "banking", categorySlug: "nostro-fca-accounts" },
    { name: "ZUPCO", url: "https://www.zupco.co.zw/", sectorSlug: "transport", categorySlug: "bus-fares" },
  ];
  for (const s of SCRAPE_SOURCE_SEEDS) {
    const category = await prisma.category.findFirst({
      where: { slug: s.categorySlug, sector: { slug: s.sectorSlug } },
      select: { id: true },
    });
    if (!category) continue;
    const existing = await prisma.scrapeSource.findFirst({ where: { url: s.url, categoryId: category.id } });
    if (!existing) {
      await prisma.scrapeSource.create({ data: { name: s.name, url: s.url, categoryId: category.id } });
    }
  }

  for (const [eventType, xpValue] of Object.entries(XP_RULES)) {
    const badgeTrigger = BADGE_TRIGGERS[eventType as keyof typeof BADGE_TRIGGERS] as
      | Prisma.InputJsonValue
      | undefined;
    const questTrigger = QUEST_TRIGGER_EVENTS.includes(eventType as never)
      ? (true as unknown as Prisma.InputJsonValue)
      : undefined;

    await prisma.gamificationRule.upsert({
      where: { eventType: eventType as never },
      update: { xpValue, badgeTrigger, questTrigger },
      create: { eventType: eventType as never, xpValue, badgeTrigger, questTrigger },
    });
  }

  for (const badge of BADGE_DEFS) {
    await prisma.badge.upsert({
      where: { name: badge.name },
      update: { description: badge.description },
      create: { name: badge.name, description: badge.description, criteria: {} },
    });
  }

  const now = new Date();
  const weekFromNow = new Date(now.getTime() + 7 * 86_400_000);
  await prisma.quest.upsert({
    where: { id: "weekly-compare-3-categories" },
    update: { activeFrom: now, activeTo: weekFromNow },
    create: {
      id: "weekly-compare-3-categories",
      name: "Cross-sector explorer",
      description: "Compare listings in 3 different categories this week.",
      criteria: { type: "category_count", target: 3, window: "week" },
      activeFrom: now,
      activeTo: weekFromNow,
    },
  });

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
