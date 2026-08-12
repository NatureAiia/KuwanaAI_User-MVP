import { privateJson } from "@/lib/apiResponse";
import { prisma } from "@/lib/prisma";
import { requireConsumer } from "@/lib/auth";

const LEADERBOARD_SIZE = 50;

export async function GET() {
  const auth = await requireConsumer();
  if ("response" in auth) return auth.response;
  const { user } = auth;

  const consent = await prisma.consent.findUnique({
    where: { userId_consentType: { userId: user.id, consentType: "leaderboard_participation" } },
  });

  if (!consent?.granted) {
    return privateJson({ optedIn: false, entries: [] });
  }

  // Previously two queries: load *every* opted-in user id, then pass the
  // whole list back as an `IN (...)`. That is fine at one user and a
  // multi-megabyte query string at a hundred thousand — the array grows with
  // total signups, not with the 50 rows actually returned.
  //
  // Expressed as a relation filter instead, so Postgres does the join, uses
  // the (consent_type, granted) index, and the LIMIT 50 applies before
  // anything is materialised.
  const entries = await prisma.userXp.findMany({
    where: {
      user: {
        consents: { some: { consentType: "leaderboard_participation", granted: true } },
      },
    },
    include: { user: { include: { profile: true } } },
    orderBy: { totalXp: "desc" },
    take: LEADERBOARD_SIZE,
  });

  return privateJson({
    optedIn: true,
    entries: entries.map((e, i) => ({
      rank: i + 1,
      nickname: e.user.profile?.nickname || `Player${e.userId.slice(0, 4)}`,
      totalXp: e.totalXp,
      level: e.level,
      isYou: e.userId === user.id,
    })),
  });
}
