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

// Wraps a clarifying-question turn — sent instead of a normal streamed
// answer when resolveChatIntent() (intakeClassifier.ts) decides the user's
// question is too under-specified to answer well. Same self-delimited-JSON-
// at-end shape as STREAM_META_MARKER (it's always the last thing in this
// short-circuited stream too). Payload: { conversationId, message: { id,
// role: "assistant", content, clarify: { fields: [{ key, question,
// options? }] } } } — see Message.clarify in prisma/schema.prisma.
export const STREAM_CLARIFY_MARKER = " KUWANA_CLARIFY ";
