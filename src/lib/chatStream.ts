// Sentinels separating the live text stream from the trailing JSON footer
// (conversationId/gamification/listings) — shared between the streaming
// route handler and the client reader so they can't drift out of sync.
export const STREAM_META_MARKER = " KUWANA_META ";
export const STREAM_ERROR_MARKER = " KUWANA_ERROR ";

// Wraps a short mid-stream status event (e.g. "escalating" when a cheap
// model rung fails before producing output) — self-delimited by a repeated
// marker rather than JSON, since unlike STREAM_META_MARKER this isn't
// guaranteed to be the last thing in the stream.
export const STREAM_STATUS_MARKER = " KUWANA_STATUS ";
