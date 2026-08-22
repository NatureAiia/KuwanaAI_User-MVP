import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { privateJson } from "@/lib/apiResponse";
import { requireUser } from "@/lib/auth";
import { AGE_RANGES } from "@/lib/onboarding-options";

const bodySchema = z.object({
  ageRange: z.enum(AGE_RANGES as [string, ...string[]]).optional(),
  occupation: z.string().trim().min(1).max(100).optional(),
  location: z.string().trim().min(1).max(100).optional(),
});

/**
 * Lets a signed-in user fill in the same optional profile fields onboarding
 * captures (ageRange/occupation/location) after the fact — see
 * ProfileNudge.tsx, the periodic post-signin prompt this backs. Onboarding
 * itself only ever creates this row once (api/onboarding/route.ts); this is
 * the first place it can be updated afterward.
 */
export async function PATCH(req: Request) {
  const user = await requireUser();
  if (!user) return privateJson({ error: "Not authenticated" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return privateJson({ error: parsed.error.flatten() }, { status: 400 });
  if (Object.keys(parsed.data).length === 0) return privateJson({ error: "Nothing to update" }, { status: 400 });

  const profile = await prisma.userProfile.upsert({
    where: { userId: user.id },
    update: parsed.data,
    create: { userId: user.id, ...parsed.data },
  });

  return privateJson({ profile });
}
