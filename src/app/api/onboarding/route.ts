import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { recordEvent } from "@/lib/gamification/process-event";
import { onboardingBodySchema as bodySchema } from "@/lib/onboardingSchema";
import { emailMatchesRegulator, isPersonalEmailDomain } from "@/lib/orgVerification";
import type { Sector } from "@prisma/client";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // One email, one account: the `users.email` unique constraint enforces
  // this at the data layer, and this guard turns the collision into a clear
  // error instead of a raw 500. `findUnique` never matches this auth user's
  // own row (the upsert below targets that same id), so a hit here always
  // means the email already belongs to a different account.
  const existingAccount = await prisma.user.findUnique({
    where: { email: authUser.email },
    select: { id: true },
  });
  if (existingAccount && existingAccount.id !== authUser.id) {
    return NextResponse.json(
      { error: "This email can only be used once." },
      { status: 409 },
    );
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  // The security boundary for Corporate/Regulator lives here, not in the
  // schema — both checks key off authUser.email (from Supabase's verified
  // session), which the client can't spoof, unlike a role in the request
  // body. See HANDOFF.md and src/lib/orgVerification.ts.
  if (data.role === "corporate" && isPersonalEmailDomain(authUser.email)) {
    return NextResponse.json(
      { error: "Corporate accounts need a work email address — please sign up again with your company email." },
      { status: 403 },
    );
  }
  if (data.role === "regulator" && !emailMatchesRegulator(authUser.email, data.regulatorName)) {
    return NextResponse.json(
      { error: `That email isn't a verified ${data.regulatorName} address — please sign up again with your ${data.regulatorName} email.` },
      { status: 403 },
    );
  }

  const footprintsBySector: Partial<Record<Sector, object>> =
    data.role === "consumer"
      ? {
          telecom: data.telecomFootprint,
          banking: data.bankingFootprint,
          insurance: data.insuranceFootprint,
          healthcare: data.healthcareFootprint,
        }
      : {};

  const profileName =
    data.role === "consumer"
      ? data.fullName
      : data.role === "corporate"
        ? data.organizationName
        : data.role === "provider"
          ? data.businessName
          : data.regulatorName;

  const gamification = await prisma.$transaction(
    async (tx) => {
      await tx.user.upsert({
        where: { id: authUser.id },
        update: { email: authUser.email!, role: data.role },
        create: { id: authUser.id, email: authUser.email!, role: data.role },
      });

      await tx.userProfile.upsert({
        where: { userId: authUser.id },
        update: {
          fullName: profileName,
          ...(data.role === "consumer"
            ? { ageRange: data.ageRange, occupation: data.occupation, location: data.location, socialPlatforms: data.socialPlatforms }
            : {}),
        },
        create: {
          userId: authUser.id,
          fullName: profileName,
          ...(data.role === "consumer"
            ? { ageRange: data.ageRange, occupation: data.occupation, location: data.location, socialPlatforms: data.socialPlatforms }
            : {}),
        },
      });

      // A self-service provider needs its own Provider record to manage —
      // admin-linking (the only other path, see /admin/catalog) doesn't
      // apply here since there's no pre-existing record to link to.
      // verified: false until an admin reviews it (see /admin/catalog),
      // same "unvetted until checked" pattern as a submitted listing.
      if (data.role === "provider") {
        await tx.provider.upsert({
          where: { ownerUserId: authUser.id },
          update: { name: data.businessName },
          create: { name: data.businessName, ownerUserId: authUser.id, verified: false },
        });
      }

      for (const [sector, sectorData] of Object.entries(footprintsBySector)) {
        if (!sectorData) continue;
        await tx.sectorFootprint.upsert({
          where: { userId_sector: { userId: authUser.id, sector: sector as Sector } },
          update: { data: sectorData },
          create: { userId: authUser.id, sector: sector as Sector, data: sectorData },
        });
      }

      for (const [consentType, granted] of Object.entries(data.consents)) {
        await tx.consent.upsert({
          where: { userId_consentType: { userId: authUser.id, consentType } },
          update: { granted, grantedAt: new Date() },
          create: { userId: authUser.id, consentType, granted },
        });
      }

      return recordEvent(tx, { userId: authUser.id, eventType: "profile_completed" });
    },
    { timeout: 15_000 },
  );

  return NextResponse.json({ gamification });
}
