"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Search, Sparkles } from "lucide-react";
import { clsx } from "clsx";
import { stashPendingChatImage } from "@/lib/chatHandoff";

export function NeedIntake({ enableImageSearch = false }: { enableImageSearch?: boolean }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [notSure, setNotSure] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim() || loading) return;
    setLoading(true);
    setNotSure(false);
    setError(null);

    try {
      const res = await fetch("/api/need-intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = res.ok ? await res.json() : null;

      if (data?.sectorSlug) {
        const url = data.categorySlug
          ? `/explore/${data.sectorSlug}?category=${data.categorySlug}`
          : `/explore/${data.sectorSlug}`;
        router.push(url);
      } else {
        setNotSure(true);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !file.type.startsWith("image/")) return;
    setError(null);

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const [header, data] = result.split(",");
      const mediaType = header.match(/data:(.*);base64/)?.[1] ?? file.type;
      if (!data) {
        setError("Couldn't read that photo — try another.");
        return;
      }
      // Hand off to the chat conversation — same flow as its own image
      // attach button — so the AI can reason about the photo and the user
      // can keep asking follow-up questions right there.
      stashPendingChatImage({ mediaType, data, text: query.trim() });
      router.push("/chat");
    };
    reader.onerror = () => setError("Couldn't read that photo — try another.");
    reader.readAsDataURL(file);
  }

  return (
    <div className="mt-4">
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-1 rounded-full border border-accent-teal/40 bg-bg-surface py-1.5 pl-4 pr-1.5 shadow-[0_0_0_1px_rgba(0,0,0,0.02)] transition-colors focus-within:border-accent-sky"
      >
        <Sparkles size={16} className="shrink-0 text-accent-teal" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="What do you need? e.g. &quot;a cheap data bundle&quot;"
          className="min-w-0 flex-1 bg-transparent px-2.5 py-2 text-[14px] outline-none placeholder:text-text-muted"
        />

        {enableImageSearch && (
          <>
            <button
              type="button"
              disabled={loading}
              onClick={() => fileInputRef.current?.click()}
              aria-label="Search by photo"
              title="Search by photo — ask follow-up questions in chat"
              className="tap-target flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-secondary hover:bg-bg-surface-raised disabled:opacity-50"
            >
              <Camera size={18} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handleImageChange}
            />
          </>
        )}

        <button
          type="submit"
          disabled={loading}
          className={clsx(
            "flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-gradient-to-r from-accent-teal to-accent-sky px-4 text-[13px] font-semibold text-white transition-opacity",
            loading ? "opacity-60" : "hover:opacity-90",
          )}
        >
          <Search size={14} />
          {loading ? "Searching…" : "Search"}
        </button>
      </form>

      {notSure && (
        <p className="mt-2 text-[12px] text-text-muted">
          Not sure what fits that — pick a sector below instead.
        </p>
      )}
      {error && <p className="mt-2 text-[12px] text-accent-coral">{error}</p>}
    </div>
  );
}
