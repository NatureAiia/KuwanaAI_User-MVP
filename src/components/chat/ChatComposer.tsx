"use client";

import { useRef, useState } from "react";
import { clsx } from "clsx";
import { ImagePlus, Mic, MicOff, Send, X } from "lucide-react";
import { useSpeechRecognition } from "@/lib/useSpeechRecognition";

export type ComposerImage = { mediaType: string; data: string };

export function ChatComposer({
  onSend,
  disabled,
}: {
  onSend: (content: string, image?: ComposerImage) => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState("");
  const [image, setImage] = useState<{ mediaType: string; data: string; previewUrl: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    supported: speechSupported,
    listening,
    toggle: toggleListening,
  } = useSpeechRecognition((transcript) => setValue(transcript));

  function submit() {
    const trimmed = value.trim();
    if ((!trimmed && !image) || disabled) return;
    onSend(trimmed, image ? { mediaType: image.mediaType, data: image.data } : undefined);
    setValue("");
    setImage(null);
  }

  function handleFile(file: File) {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const [header, data] = result.split(",");
      const mediaType = header.match(/data:(.*);base64/)?.[1] ?? file.type;
      if (data) setImage({ mediaType, data, previewUrl: result });
    };
    reader.readAsDataURL(file);
  }

  const canSend = !disabled && (!!value.trim() || !!image);
  const showMic = speechSupported && !value.trim() && !image;

  return (
    <div>
      {image && (
        <div className="mb-2 flex items-center gap-2 rounded-xl border border-border bg-bg-surface-raised p-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- ephemeral client-side data-URL preview, not an optimizable asset */}
          <img src={image.previewUrl} alt="Attached" className="h-10 w-10 rounded-lg object-cover" />
          <p className="flex-1 text-[12px] text-text-secondary">Image attached</p>
          <button
            type="button"
            onClick={() => setImage(null)}
            aria-label="Remove image"
            className="tap-target text-text-muted"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div className="flex items-center gap-1 rounded-full border border-border bg-bg-surface-raised px-2 py-1.5">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
          // Chromium applies its own caret-color to disabled inputs after
          // hydration, which React then reports as a mismatch — harmless.
          suppressHydrationWarning
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          aria-label="Attach an image"
          className="tap-target flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-text-muted disabled:opacity-40"
        >
          <ImagePlus size={17} />
        </button>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={listening ? "Listening…" : "Ask the Kuwana Assistant…"}
          disabled={disabled}
          className="flex-1 bg-transparent px-1 text-[13.5px] text-text-primary placeholder:text-text-muted focus:outline-none"
          suppressHydrationWarning
        />
        {showMic ? (
          <button
            type="button"
            onClick={toggleListening}
            disabled={disabled}
            aria-label={listening ? "Stop voice input" : "Start voice input"}
            className={clsx(
              "tap-target flex h-9 w-9 shrink-0 items-center justify-center rounded-full border disabled:opacity-40",
              listening
                ? "animate-pulse border-accent-coral bg-accent-coral text-white"
                : "border-border bg-bg-surface text-accent-sky",
            )}
          >
            {listening ? <MicOff size={16} /> : <Mic size={16} />}
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={!canSend}
            aria-label="Send message"
            className="tap-target flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-sky text-[var(--text-on-accent-sky)] disabled:opacity-40"
          >
            <Send size={16} />
          </button>
        )}
      </div>
      <p className="mt-2 text-center text-[10.5px] text-text-muted">
        AI-assisted. Not financial advice — verify details before deciding.
      </p>
    </div>
  );
}
