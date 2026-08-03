import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { recordEvent } from "@/lib/gamification/process-event";
import type { Sector } from "@prisma/client";

const bodySchema = z.object({
  fullName: z.string().min(1),
  ageRange: z.string().optional(),
  occupation: z.string().optional(),
  location: z.string().optional(),
  socialPlatforms: z.array(z.string()).default([]),
  telecomFootprint: z
    .object({
      primary_network: z.string(),
      plan_type: z.string(),
      monthly_spend_range: z.string(),
    })
    .optional(),
  bankingFootprint: z
    .object({
      bank_name: z.string(),
      account_types: z.array(z.string()).default([]),
    })
    .optional(),
  insuranceFootprint: z
    .object({
      provider: z.string(),
      policy_types: z.array(z.string()).default([]),
      has_insurance: z.boolean(),
    })
    .optional(),
  healthcareFootprint: z
    .object({
      medical_aid_provider: z.string(),
      chronic_condition_disclosure_opt_in: z.boolean(),
    })
    .optional(),
  consents: z.object({
    research_use: z.boolean(),
    leaderboard_participation: z.boolean(),
  }),
});

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const {
    fullName,
    ageRange,
    occupation,
    location,
    socialPlatforms,
    telecomFootprint,
    bankingFootprint,
    insuranceFootprint,
    healthcareFootprint,
    consents,
  } = parsed.data;

  const footprintsBySector: Partial<Record<Sector, object>> = {
    telecom: telecomFootprint,
    banking: bankingFootprint,
    insurance: insuranceFootprint,
    healthcare: healthcareFootprint,
  };

  const gamification = await prisma.$transaction(async (tx) => {
    await tx.user.upsert({
      where: { id: authUser.id },
      update: { email: authUser.email! },
      create: { id: authUser.id, email: authUser.email!, role: "consumer" },
    });

    await tx.userProfile.upsert({
      where: { userId: authUser.id },
      update: { fullName, ageRange, occupation, location, socialPlatforms },
      create: { userId: authUser.id, fullName, ageRange, occupation, location, socialPlatforms },
    });

    for (const [sector, data] of Object.entries(footprintsBySector)) {
      if (!data) continue;
      await tx.sectorFootprint.upsert({
        where: { userId_sector: { userId: authUser.id, sector: sector as Sector } },
        update: { data },
        create: { userId: authUser.id, sector: sector as Sector, data },
      });
    }

    for (const [consentType, granted] of Object.entries(consents)) {
      await tx.consent.upsert({
        where: { userId_consentType: { userId: authUser.id, consentType } },
        update: { granted, grantedAt: new Date() },
        create: { userId: authUser.id, consentType, granted },
      });
    }

    return recordEvent(tx, { userId: authUser.id, eventType: "profile_completed" });
  });

  return NextResponse.json({ gamification });
}
