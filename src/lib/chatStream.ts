// Sentinels separating the live text stream from the trailing JSON footer
// (conversationId/gamification/listings) — shared between the streaming
// route handler and the client reader so they can't drift out of sync.
export const STREAM_META_MARKER = " KUWANA_META ";
export const STREAM_ERROR_MARKER = " KUWANA_ERROR ";
