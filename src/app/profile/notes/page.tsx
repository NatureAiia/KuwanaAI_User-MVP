import { requireUser } from "@/lib/auth";
import { listUserNotes } from "@/lib/userNotes";
import { BottomTabBar } from "@/components/BottomTabBar";
import { Header } from "@/components/Header";
import { BackButton } from "@/components/ui/BackButton";
import { SECTORS } from "@/lib/sectors";
import { NoteDeleteButton } from "@/components/profile/NoteDeleteButton";

export default async function NotesPage() {
  const user = await requireUser();
  if (!user) return null;

  const notes = await listUserNotes(user.id);

  return (
    <div id="main-content" tabIndex={-1} className="flex flex-1 flex-col px-5 pb-24 pt-6 md:px-10">
      <Header />
      <div className="mt-4 flex items-center gap-2">
        <BackButton fallbackHref="/profile" />
        <h1 className="font-display text-[24px] font-bold">My notes</h1>
      </div>
      <p className="mt-1 text-[13px] text-text-secondary">
        Context you&apos;ve shared for specific categories (like Insurance) — Kuwana uses these to tailor future
        recommendations. Answer the questions again on a compare page anytime to update a note.
      </p>

      {notes.length === 0 ? (
        <p className="mt-6 text-[13px] text-text-muted">
          No notes yet — they&apos;re captured when you ask for an AI recommendation on a category like Insurance.
        </p>
      ) : (
        <ul className="mt-5 space-y-3">
          {notes.map((note) => {
            const sectorName = SECTORS[note.sector as keyof typeof SECTORS]?.name ?? note.sector;
            const content = Array.isArray(note.content) ? (note.content as { question: string; answer: string }[]) : [];
            return (
              <li key={note.id} className="rounded-xl border border-border bg-bg-surface p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[14px] font-semibold">
                      {sectorName}
                      {note.category && <span className="text-text-muted"> · {note.category}</span>}
                    </p>
                    <p className="mt-0.5 text-[11px] text-text-muted">
                      Updated {note.updatedAt.toLocaleDateString()}
                    </p>
                  </div>
                  <NoteDeleteButton sector={note.sector} category={note.category} />
                </div>
                <ul className="mt-2.5 space-y-1.5">
                  {content.map((qa, i) => (
                    <li key={i} className="text-[13px] leading-snug text-text-secondary">
                      <span className="text-text-muted">{qa.question}</span> {qa.answer}
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      )}

      <BottomTabBar />
    </div>
  );
}
