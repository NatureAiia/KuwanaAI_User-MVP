import { prisma } from "@/lib/prisma";
import type { Sector } from "@prisma/client";

export type UserNoteAnswer = { question: string; answer: string };

/**
 * "" means sector-general notes not tied to a specific category — see the
 * @@unique([userId, sector, category]) constraint on UserNote, which needs a
 * concrete (non-null) value to work as a single upsert target.
 */
function normalizeCategory(category?: string | null): string {
  return category ?? "";
}

export async function getUserNote(userId: string, sector: Sector, category?: string | null) {
  return prisma.userNote.findUnique({
    where: { userId_sector_category: { userId, sector, category: normalizeCategory(category) } },
  });
}

export async function listUserNotes(userId: string) {
  return prisma.userNote.findMany({ where: { userId }, orderBy: { updatedAt: "desc" } });
}

export async function saveUserNote(
  userId: string,
  sector: Sector,
  category: string | null | undefined,
  content: UserNoteAnswer[],
  source = "intake",
) {
  const normalizedCategory = normalizeCategory(category);
  return prisma.userNote.upsert({
    where: { userId_sector_category: { userId, sector, category: normalizedCategory } },
    update: { content, source },
    create: { userId, sector, category: normalizedCategory, content, source },
  });
}

export async function deleteUserNote(userId: string, sector: Sector, category?: string | null) {
  await prisma.userNote.delete({
    where: { userId_sector_category: { userId, sector, category: normalizeCategory(category) } },
  });
}
