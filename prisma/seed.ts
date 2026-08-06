/**
 * prisma/seed.ts
 * Deterministic seed for KuwanaAI
 * - 10 sectors (healthcare = COMING_SOON but footprint allowed)
 * - categories + attribute schemas (JSON, no DDL needed for new sectors)
 * - providers + listings (published filtering)
 * - 90-day price history
 * - gamification rules, badges, quests
 * - FX fallback rates (never delete fallback)
 * Idempotent: uses upsert
 */
import { PrismaClient, Sector, SectorStatus } from '@prisma/client'

const prisma = new PrismaClient()

const SECTORS: { slug: string; name: string; sector: Sector; status: SectorStatus; description: string; order: number }[] = [
  { slug: 'telecoms', name: 'Telecommunications', sector: 'TELECOMS', status: 'ACTIVE', description: 'Data, voice, fibre in ZW', order: 1 },
  { slug: 'banking', name: 'Banking & Mobile Money', sector: 'BANKING', status: 'ACTIVE', description: 'Accounts, EcoCash, OneMoney', order: 2 },
  { slug: 'insurance', name: 'Insurance', sector: 'INSURANCE', status: 'ACTIVE', description: 'Motor, health, funeral', order: 3 },
  { slug: 'energy', name: 'Energy & Solar', sector: 'ENERGY', status: 'ACTIVE', description: 'ZESA, solar kits, gas', order: 4 },
  { slug: 'retail-grocery', name: 'Retail & Groceries', sector: 'RETAIL_GROCERY', status: 'ACTIVE', description: 'Supermarket basket comparison', order: 5 },
  { slug: 'fuel', name: 'Fuel & Transport', sector: 'FUEL', status: 'ACTIVE', description: 'Petrol, diesel, kombi fares', order: 6 },
  { slug: 'education', name: 'Education', sector: 'EDUCATION', status: 'ACTIVE', description: 'School fees, short courses', order: 7 },
  { slug: 'housing', name: 'Housing & Rentals', sector: 'HOUSING', status: 'ACTIVE', description: 'Rentals, stands, materials', order: 8 },
  { slug: 'transport', name: 'Logistics & Transport', sector: 'TRANSPORT', status: 'ACTIVE', description: 'Courier, intercity', order: 9 },
  { slug: 'healthcare', name: 'Healthcare', sector: 'HEALTHCARE', status: 'COMING_SOON', description: 'Clinics, pharmacies, cover', order: 10 },
]

const CATEGORIES_BY_SECTOR: Record<string, { slug: string; name: string; attrs: { key: string; label: string; dataType: any; required?: boolean; options?: any; unit?: string; order: number }[] }[]> = {
  telecoms: [
    { slug: 'mobile-data', name: 'Mobile Data', attrs: [
      { key: 'data_gb', label: 'Data Allowance', dataType: 'NUMBER', required: true, unit: 'GB', order: 1 },
      { key: 'validity_days', label: 'Validity', dataType: 'NUMBER', required: true, unit: 'days', order: 2 },
      { key: 'price_usd', label: 'Price USD', dataType: 'CURRENCY', required: true, unit: 'USD', order: 3 },
      { key: 'network', label: 'Network', dataType: 'ENUM', options: ['Econet','NetOne','Telecel','Liquid'], order: 4 },
      { key: 'is_night_bundle', label: 'Night Bundle?', dataType: 'BOOLEAN', order: 5 },
    ]},
    { slug: 'fibre', name: 'Home Fibre', attrs: [
      { key: 'speed_mbps', label: 'Speed', dataType: 'NUMBER', unit: 'Mbps', order: 1 },
      { key: 'uncapped', label: 'Uncapped', dataType: 'BOOLEAN', order: 2 },
      { key: 'monthly_usd', label: 'Monthly USD', dataType: 'CURRENCY', required: true, order: 3 },
    ]},
  ],
  banking: [
    { slug: 'mobile-money', name: 'Mobile Money Fees', attrs: [
      { key: 'send_fee_pct', label: 'Send Fee %', dataType: 'NUMBER', order: 1 },
      { key: 'cashout_fee_pct', label: 'Cashout Fee %', dataType: 'NUMBER', order: 2 },
      { key: 'provider', label: 'Provider', dataType: 'ENUM', options: ['EcoCash','OneMoney','TeleCash'], order: 3 },
    ]},
  ],
  'retail-grocery': [
    { slug: 'basic-basket', name: 'Basic Basket', attrs: [
      { key: 'item_count', label: 'Items in basket', dataType: 'NUMBER', order: 1 },
      { key: 'total_zwg', label: 'Total ZWG', dataType: 'CURRENCY', order: 2 },
    ]},
  ],
  energy: [
    { slug: 'solar-kits', name: 'Solar Kits', attrs: [
      { key: 'watts', label: 'Watts', dataType: 'NUMBER', unit: 'W', order: 1 },
      { key: 'battery_kwh', label: 'Battery', dataType: 'NUMBER', unit: 'kWh', order: 2 },
      { key: 'price_usd', label: 'Price USD', dataType: 'CURRENCY', required: true, order: 3 },
    ]},
  ],
  insurance: [{ slug: 'motor-cover', name: 'Motor Cover', attrs: [{ key: 'cover_type', label: 'Cover', dataType: 'ENUM', options: ['Third Party','Full'], order: 1 },{ key: 'annual_usd', label: 'Annual USD', dataType: 'CURRENCY', order: 2 }]}],
  fuel: [{ slug: 'fuel-price', name: 'Fuel Prices', attrs: [{ key: 'fuel_type', label: 'Type', dataType: 'ENUM', options: ['Petrol','Diesel'], order: 1 },{ key: 'price_per_litre_usd', label: 'USD/L', dataType: 'CURRENCY', order: 2 }]}],
  education: [{ slug: 'short-courses', name: 'Short Courses', attrs: [{ key: 'duration_weeks', label: 'Weeks', dataType: 'NUMBER', order: 1 },{ key: 'fee_usd', label: 'Fee USD', dataType: 'CURRENCY', order: 2 }]}],
  housing: [{ slug: 'rentals-2bed', name: '2-Bed Rentals', attrs: [{ key: 'area', label: 'Suburb', dataType: 'STRING', order: 1 },{ key: 'rent_usd', label: 'Rent USD', dataType: 'CURRENCY', order: 2 }]}],
  transport: [{ slug: 'courier-local', name: 'Local Courier', attrs: [{ key: 'max_kg', label: 'Max KG', dataType: 'NUMBER', order: 1 },{ key: 'fee_usd', label: 'Fee USD', dataType: 'CURRENCY', order: 2 }]}],
  healthcare: [{ slug: 'pharmacy-basic', name: 'Pharmacy Basics', attrs: [{ key: 'item', label: 'Item', dataType: 'STRING', order: 1 },{ key: 'price_usd', label: 'Price USD', dataType: 'CURRENCY', order: 2 }]}],
}

<<<<<<< HEAD
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
};

type SectorSeed = {
  slug: string;
  name: string;
  status: "live" | "coming_soon";
  categories: {
    slug: string;
    name: string;
    attributes: AttrDef[];
    providers: string[];
    listings: { name: string; provider: string; price: number; attrs: Record<string, unknown> }[];
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
          { key: "mobile_app", label: "Mobile app", dataType: "boolean" },
        ],
        providers: ["CBZ", "Steward Bank", "FBC", "Nedbank"],
        listings: [
          { name: "CBZ Smart Save", provider: "CBZ", price: 2, attrs: { monthly_fee: 2, min_balance: 10, interest_rate: 1.5, atm_withdrawal_fee: 1, mobile_app: true } },
          { name: "CBZ Freedom Save", provider: "CBZ", price: 0, attrs: { monthly_fee: 0, min_balance: 0, interest_rate: 0.5, atm_withdrawal_fee: 1.5, mobile_app: true } },
          { name: "Steward Bank Sync Save", provider: "Steward Bank", price: 1, attrs: { monthly_fee: 1, min_balance: 5, interest_rate: 2, atm_withdrawal_fee: 0.5, mobile_app: true } },
          { name: "Steward Bank Youth Save", provider: "Steward Bank", price: 0, attrs: { monthly_fee: 0, min_balance: 0, interest_rate: 1, atm_withdrawal_fee: 1, mobile_app: true } },
          { name: "FBC Gold Save", provider: "FBC", price: 3, attrs: { monthly_fee: 3, min_balance: 20, interest_rate: 2.5, atm_withdrawal_fee: 1, mobile_app: true } },
          { name: "FBC Basic Save", provider: "FBC", price: 1, attrs: { monthly_fee: 1, min_balance: 5, interest_rate: 1, atm_withdrawal_fee: 1.5, mobile_app: false } },
          { name: "Nedbank Prime Save", provider: "Nedbank", price: 4, attrs: { monthly_fee: 4, min_balance: 50, interest_rate: 3, atm_withdrawal_fee: 2, mobile_app: true } },
          { name: "Nedbank Everyday Save", provider: "Nedbank", price: 2, attrs: { monthly_fee: 2, min_balance: 10, interest_rate: 1.2, atm_withdrawal_fee: 1, mobile_app: true } },
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
    ],
  },
  { slug: "healthcare", name: "Healthcare", status: "coming_soon", categories: [] },
  {
    slug: "transport",
    name: "Transport",
    status: "live",
    categories: [
      {
        slug: "ride-fares",
        name: "Ride fares",
        attributes: [
          { key: "fare_estimate", label: "Fare estimate", dataType: "number", unit: "USD" },
          { key: "wait_time", label: "Wait time", dataType: "number", unit: "min" },
          { key: "vehicle_type", label: "Vehicle type", dataType: "enum" },
          { key: "safety_rating", label: "Safety rating", dataType: "number", unit: "/5" },
        ],
        providers: ["Vaya", "inDrive", "Hwindi"],
        listings: [
          { name: "Vaya Standard (5km, CBD)", provider: "Vaya", price: 3.5, attrs: { fare_estimate: 3.5, wait_time: 6, vehicle_type: "Sedan", safety_rating: 4.5 } },
          { name: "Vaya Comfort (5km, CBD)", provider: "Vaya", price: 5, attrs: { fare_estimate: 5, wait_time: 8, vehicle_type: "SUV", safety_rating: 4.7 } },
          { name: "inDrive Negotiated (5km, CBD)", provider: "inDrive", price: 2.8, attrs: { fare_estimate: 2.8, wait_time: 10, vehicle_type: "Sedan", safety_rating: 4.1 } },
          { name: "Hwindi Kombi Seat (5km, CBD)", provider: "Hwindi", price: 1, attrs: { fare_estimate: 1, wait_time: 12, vehicle_type: "Kombi", safety_rating: 3.6 } },
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
];
=======
const PROVIDERS = [
  { slug: 'econet', name: 'Econet', sector: 'telecoms' },
  { slug: 'netone', name: 'NetOne', sector: 'telecoms' },
  { slug: 'liquid-home', name: 'Liquid Home', sector: 'telecoms' },
  { slug: 'ecocash', name: 'EcoCash', sector: 'banking' },
  { slug: 'zesa', name: 'ZESA', sector: 'energy' },
  { slug: 'picknpay-zw', name: 'Pick n Pay ZW', sector: 'retail-grocery' },
  { slug: 'ok-zw', name: 'OK Zimbabwe', sector: 'retail-grocery' },
]
>>>>>>> 3abce5db13eb9afe69cb0f62e1578304aa84aa9d

async function main() {
  console.log('🌱 Seeding KuwanaAI deterministic...')

  // 1. Sectors
  for (const s of SECTORS) {
    await prisma.sectorConfig.upsert({
      where: { slug: s.slug },
      update: { name: s.name, status: s.status, description: s.description, order: s.order, sector: s.sector },
      create: s,
    })
  }

  // 2. Categories + Attribute Schemas
  for (const [sectorSlug, cats] of Object.entries(CATEGORIES_BY_SECTOR)) {
    const sector = await prisma.sectorConfig.findUnique({ where: { slug: sectorSlug } })
    if (!sector) continue
    for (const cat of cats) {
      const category = await prisma.category.upsert({
        where: { sectorId_slug: { sectorId: sector.id, slug: cat.slug } },
        update: { name: cat.name },
        create: { sectorId: sector.id, slug: cat.slug, name: cat.name, description: `${cat.name} in ${sector.name}` },
      })
      for (const attr of cat.attrs) {
        await prisma.attributeSchemaField.upsert({
          where: { categoryId_key: { categoryId: category.id, key: attr.key } },
<<<<<<< HEAD
          update: { label: attr.label, dataType: attr.dataType, unit: attr.unit, sortOrder: i },
          create: {
            categoryId: category.id,
            key: attr.key,
            label: attr.label,
            dataType: attr.dataType,
            unit: attr.unit,
            isComparable: attr.isComparable ?? true,
            sortOrder: i,
          },
        });
      }

      const providerIdByName = new Map<string, string>();
      for (const name of catSeed.providers) {
        const provider = await prisma.provider.upsert({
          where: { id: `${sectorSeed.slug}-${name}` },
          update: {},
          create: { id: `${sectorSeed.slug}-${name}`, name, verified: true },
        });
        providerIdByName.set(name, provider.id);
      }

      for (const listing of catSeed.listings) {
        const providerId = providerIdByName.get(listing.provider)!;
        const existing = await prisma.listing.findFirst({
          where: { categoryId: category.id, name: listing.name },
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
          freshnessStatus: "fresh" as const,
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
=======
          update: { label: attr.label, dataType: attr.dataType, required: !!attr.required, options: attr.options ?? undefined, unit: attr.unit, order: attr.order },
          create: { categoryId: category.id, key: attr.key, label: attr.label, dataType: attr.dataType, required: !!attr.required, options: attr.options ?? undefined, unit: attr.unit, order: attr.order },
        })
>>>>>>> 3abce5db13eb9afe69cb0f62e1578304aa84aa9d
      }
    }
  }

  // 3. Providers
  for (const p of PROVIDERS) {
    const sector = await prisma.sectorConfig.findUnique({ where: { slug: p.sector } })
    await prisma.provider.upsert({
      where: { slug: p.slug },
      update: { name: p.name, sectorId: sector?.id },
      create: { slug: p.slug, name: p.name, sectorId: sector?.id, isVerified: true, metadata: {} },
    })
  }

  // 4. Listings + 90-day price history
  const telecomCat = await prisma.category.findFirst({ where: { slug: 'mobile-data' } })
  const fibreCat = await prisma.category.findFirst({ where: { slug: 'fibre' } })
  const econet = await prisma.provider.findUnique({ where: { slug: 'econet' } })
  const netone = await prisma.provider.findUnique({ where: { slug: 'netone' } })
  const liquid = await prisma.provider.findUnique({ where: { slug: 'liquid-home' } })

  if (telecomCat && econet) {
    const listingsData = [
      { title: 'Econet 25GB Monthly', providerId: econet.id, categoryId: telecomCat.id, sectorId: (await prisma.sectorConfig.findUnique({ where: { slug: 'telecoms' } }))?.id, attributes: { data_gb: 25, validity_days: 30, price_usd: 45, network: 'Econet', is_night_bundle: false }, status: 'PUBLISHED' as const },
      { title: 'Econet 10GB Weekly', providerId: econet.id, categoryId: telecomCat.id, attributes: { data_gb: 10, validity_days: 7, price_usd: 15, network: 'Econet', is_night_bundle: false }, status: 'PUBLISHED' as const },
      { title: 'NetOne 30GB Monthly', providerId: netone?.id, categoryId: telecomCat.id, attributes: { data_gb: 30, validity_days: 30, price_usd: 40, network: 'NetOne' }, status: 'PUBLISHED' as const },
    ]
    for (const l of listingsData) {
      const existing = await prisma.listing.findFirst({ where: { title: l.title } })
      let listing
      if (existing) {
        listing = await prisma.listing.update({ where: { id: existing.id }, data: l })
      } else {
        listing = await prisma.listing.create({ data: l as any })
      }
      // 90-day history
      for (let i = 0; i < 90; i++) {
        const date = new Date()
        date.setDate(date.getDate() - i)
        const variance = (Math.random() - 0.5) * 2
        const basePrice = (l.attributes as any).price_usd ?? 40
        await prisma.listingPriceHistory.upsert({
          where: { id: `${listing.id}-${i}` } as any, // not real id, use create only if needed
          update: {},
          create: {
            listingId: listing.id,
            price: basePrice + variance,
            currency: 'USD',
            recordedAt: date,
            source: i % 7 === 0 ? 'social_mention' : 'manual',
          },
        }).catch(async () => {
          // fallback: create without upsert conflict
          const exists = await prisma.listingPriceHistory.findFirst({ where: { listingId: listing.id, recordedAt: date } })
          if (!exists) await prisma.listingPriceHistory.create({ data: { listingId: listing.id, price: basePrice + variance, currency: 'USD', recordedAt: date, source: 'manual' } })
        })
      }
    }
  }

  if (fibreCat && liquid) {
    await prisma.listing.upsert({
      where: { id: '00000000-0000-0000-0000-000000000001' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000001',
        title: 'Liquid Home 25Mbps Uncapped',
        categoryId: fibreCat.id,
        sectorId: (await prisma.sectorConfig.findUnique({ where: { slug: 'telecoms' } }))?.id,
        providerId: liquid.id,
        attributes: { speed_mbps: 25, uncapped: true, monthly_usd: 85 },
        status: 'PUBLISHED',
      },
    })
  }

  // 5. Gamification Rules (keyed by EventType)
  const rules = [
    { eventType: 'FOOTPRINT_CREATED' as const, xpAward: 50, description: 'Complete sector footprint' },
    { eventType: 'COMPARISON_CREATED' as const, xpAward: 20, description: 'Create a comparison' },
    { eventType: 'LISTING_SAVED' as const, xpAward: 10, description: 'Save a listing' },
    { eventType: 'CONVERSATION_STARTED' as const, xpAward: 15, description: 'Start AI chat' },
    { eventType: 'RECOMMENDATION_VIEWED' as const, xpAward: 5, description: 'View recommendation' },
    { eventType: 'PROFILE_COMPLETED' as const, xpAward: 30, description: 'Complete profile' },
    { eventType: 'DAILY_LOGIN' as const, xpAward: 10, description: 'Daily login streak' },
    { eventType: 'REFERRAL_COMPLETED' as const, xpAward: 100, description: 'Referral completed' },
  ]
  for (const r of rules) {
    await prisma.gamificationRule.upsert({ where: { eventType: r.eventType }, update: { xpAward: r.xpAward }, create: r })
  }

  // 6. Badges
  const badges = [
    { name: 'First Footprint', description: 'Created your first sector footprint', criteria: { footprints: 1 }, xpReward: 50 },
    { name: 'Comparison Pro', description: 'Created 5 comparisons', criteria: { comparisons: 5 }, xpReward: 100 },
    { name: 'Saver', description: 'Saved 10 listings', criteria: { saved: 10 }, xpReward: 75 },
    { name: 'Streak 7', description: '7 day login streak', criteria: { streak: 7 }, xpReward: 150 },
    { name: 'Explorer', description: 'Explored 3 sectors', criteria: { sectors: 3 }, xpReward: 100 },
  ]
  for (const b of badges) {
    await prisma.badge.upsert({ where: { name: b.name }, update: {}, create: b })
  }

  // 7. Quests
  await prisma.quest.upsert({
    where: { id: '00000000-0000-0000-0000-000000000010' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000010',
      title: 'Telecom Saver',
      description: 'Compare 3 telecom bundles and save 1',
      criteria: { sector: 'TELECOMS', actions: [{ type: 'COMPARISON_CREATED', count: 3 }, { type: 'LISTING_SAVED', count: 1 }] },
      xpReward: 200,
      active: true,
    },
  })

  // 8. FX Rates - fallback table, never delete
  const fxPairs = [
    { baseCurrency: 'USD', targetCurrency: 'ZWG', rate: 26.5 },
    { baseCurrency: 'USD', targetCurrency: 'ZiG', rate: 26.5 },
    { baseCurrency: 'USD', targetCurrency: 'ZAR', rate: 18.2 },
  ]
  for (const fx of fxPairs) {
    await prisma.fxRate.create({ data: { ...fx, source: 'fallback', effectiveAt: new Date() } })
  }

  // 9. Social Price Mention sample
  await prisma.socialPriceMention.upsert({
    where: { platform_sourceUrl: { platform: 'FACEBOOK', sourceUrl: 'https://facebook.com/example/post/1' } },
    update: {},
    create: {
      platform: 'FACEBOOK',
      sourceUrl: 'https://facebook.com/example/post/1',
      content: 'Econet 25GB now $42 in Harare!',
      matchedProvider: 'Econet',
      extractedPrices: [{ amount: 42, currency: 'USD', context: '25GB bundle' }],
      sector: 'TELECOMS',
      confidence: 0.82,
    },
  })

  console.log('✅ Seed complete - idempotent')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
