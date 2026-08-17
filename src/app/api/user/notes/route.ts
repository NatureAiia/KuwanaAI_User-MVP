import { privateJson } from "@/lib/apiResponse";
import { z } from "zod";
import { requireConsumer } from "@/lib/auth";
import { getUserNote, listUserNotes, saveUserNote, deleteUserNote } from "@/lib/userNotes";
import { Sector } from "@prisma/client";

const SECTOR_VALUES = Object.values(Sector) as [string, ...string[]];

// GET ?sector=&category= returns one note; GET with no params lists every
// note the user has saved (used by the /profile/notes page).
export async function GET(req: Request) {
  const auth = await requireConsumer();
  if ("response" in auth) return auth.response;
  const { user } = auth;

  const { searchParams } = new URL(req.url);
  const sector = searchParams.get("sector");
  const category = searchParams.get("category");

  if (!sector) {
    const notes = await listUserNotes(user.id);
    return privateJson({ notes });
  }

  const parsedSector = z.enum(SECTOR_VALUES).safeParse(sector);
  if (!parsedSector.success) return privateJson({ error: "Invalid sector" }, { status: 400 });

  const note = await getUserNote(user.id, parsedSector.data as Sector, category);
  return privateJson({ note });
}

const answerSchema = z.object({ question: z.string().trim().min(1).max(200), answer: z.string().trim().min(1).max(500) });

const postSchema = z.object({
  sector: z.enum(SECTOR_VALUES),
  category: z.string().trim().max(100).optional(),
  content: z.array(answerSchema).min(1).max(10),
});

export async function POST(req: Request) {
  const auth = await requireConsumer();
  if ("response" in auth) return auth.response;
  const { user } = auth;

  const parsed = postSchema.safeParse(await req.json());
  if (!parsed.success) return privateJson({ error: parsed.error.flatten() }, { status: 400 });

  const note = await saveUserNote(
    user.id,
    parsed.data.sector as Sector,
    parsed.data.category,
    parsed.data.content,
  );
  return privateJson({ note });
}

const deleteSchema = z.object({ sector: z.enum(SECTOR_VALUES), category: z.string().trim().max(100).optional() });

export async function DELETE(req: Request) {
  const auth = await requireConsumer();
  if ("response" in auth) return auth.response;
  const { user } = auth;

  const parsed = deleteSchema.safeParse(await req.json());
  if (!parsed.success) return privateJson({ error: parsed.error.flatten() }, { status: 400 });

  await deleteUserNote(user.id, parsed.data.sector as Sector, parsed.data.category);
  return privateJson({ ok: true });
}
