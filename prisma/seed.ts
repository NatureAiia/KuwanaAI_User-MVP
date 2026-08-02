import { PrismaClient } from "@prisma/client";
import { BADGE_DEFS } from "../src/lib/gamification/rules";

const prisma = new PrismaClient();

const XP_RULES: Record<string, number> = {
  profile_completed: 50,
  comparison_viewed: 2,
  comparison_completed: 10,
  recommendation_viewed: 3,
  item_saved: 5,
  action_taken: 25,
  daily_visit: 5,
};

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
        update: { name: catSeed.name },
        create: { sectorId: sector.id, slug: catSeed.slug, name: catSeed.name },
      });

      for (const [i, attr] of catSeed.attributes.entries()) {
        await prisma.attributeSchemaField.upsert({
          where: { categoryId_key: { categoryId: category.id, key: attr.key } },
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
        const data = {
          categoryId: category.id,
          providerId,
          name: listing.name,
          attributes: listing.attrs,
          price: listing.price,
          currency: "USD",
          freshnessStatus: "fresh" as const,
          lastVerifiedAt: new Date(),
        };
        if (existing) {
          await prisma.listing.update({ where: { id: existing.id }, data });
        } else {
          await prisma.listing.create({ data });
        }
      }
    }
  }

  for (const [eventType, xpValue] of Object.entries(XP_RULES)) {
    await prisma.gamificationRule.upsert({
      where: { eventType: eventType as never },
      update: { xpValue },
      create: { eventType: eventType as never, xpValue },
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
