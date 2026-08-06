// Hands an image (and optional question) from the dashboard search bar's
// camera button off to the chat page, which sends it into the user's
// ongoing conversation — same Claude call the chat composer's own image
// attach button uses, so the user can ask follow-up questions afterwards
// exactly like a normal chat message. sessionStorage (not a query param)
// because a base64 image is far too large for a URL and disappears the
// instant it's read.
const KEY = "kuwana:pendingChatImage";

export type PendingChatImage = { mediaType: string; data: string; text: string };

export function stashPendingChatImage(payload: PendingChatImage) {
  sessionStorage.setItem(KEY, JSON.stringify(payload));
}

export function takePendingChatImage(): PendingChatImage | null {
  const raw = sessionStorage.getItem(KEY);
  if (!raw) return null;
  sessionStorage.removeItem(KEY);
  try {
    return JSON.parse(raw) as PendingChatImage;
  } catch {
    return null;
  }
}
