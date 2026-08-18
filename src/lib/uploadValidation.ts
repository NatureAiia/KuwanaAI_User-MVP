/**
 * Content validation for uploaded files.
 *
 * The three image-upload routes already check `file.type` against an
 * allowlist, but that value is the Content-Type the *client* put on the
 * multipart part — it describes what the uploader claims, not what the bytes
 * are. Nothing stopped a caller declaring `image/png` and sending arbitrary
 * content, which then landed in a public Storage bucket served from our own
 * domain.
 *
 * These checks read the leading bytes instead, so the declared type has to
 * match what the file actually is.
 */

/** Longest signature below, so callers only need to hand over this many bytes. */
export const MAGIC_BYTES_NEEDED = 12;

type Signature = {
  /** Byte values to match; null means "any byte here". */
  readonly pattern: readonly (number | null)[];
  readonly offset: number;
};

/**
 * Signatures per MIME type. Sourced from each format's own specification:
 *
 *  - JPEG: starts FF D8 FF (SOI marker followed by the first segment marker).
 *  - PNG: the fixed 8-byte signature from the PNG spec, including the CRLF/EOF
 *    bytes that exist to detect corrupting transfers.
 *  - WebP: RIFF container — "RIFF", then a 4-byte little-endian length that
 *    varies per file, then "WEBP".
 */
const SIGNATURES: Record<string, readonly Signature[]> = {
  "image/jpeg": [{ offset: 0, pattern: [0xff, 0xd8, 0xff] }],
  "image/png": [{ offset: 0, pattern: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }],
  "image/webp": [
    {
      offset: 0,
      // R  I  F  F  <4-byte size>  W  E  B  P
      pattern: [0x52, 0x49, 0x46, 0x46, null, null, null, null, 0x57, 0x45, 0x42, 0x50],
    },
  ],
};

function matches(bytes: Uint8Array, signature: Signature): boolean {
  if (bytes.length < signature.offset + signature.pattern.length) return false;
  return signature.pattern.every(
    (expected, i) => expected === null || bytes[signature.offset + i] === expected,
  );
}

/**
 * True when `bytes` actually start with a signature for `declaredType`.
 *
 * Returns false for a type we have no signature for, rather than passing it —
 * an unrecognised type should be rejected by the caller's own allowlist first,
 * and failing open here would quietly undo the point of the check.
 */
export function bytesMatchDeclaredType(bytes: Uint8Array, declaredType: string): boolean {
  const signatures = SIGNATURES[declaredType];
  if (!signatures) return false;
  return signatures.some((signature) => matches(bytes, signature));
}

/**
 * Reads only the leading bytes rather than the whole file, so a rejected
 * upload never costs a full buffer in memory.
 */
export async function fileMatchesDeclaredType(file: File): Promise<boolean> {
  const head = await file.slice(0, MAGIC_BYTES_NEEDED).arrayBuffer();
  return bytesMatchDeclaredType(new Uint8Array(head), file.type);
}
