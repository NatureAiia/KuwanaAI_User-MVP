import { z } from "zod";
import { SECTORS } from "@/lib/sectors";

/**
 * One sector enum, derived from SECTORS, instead of the hand-copied string
 * unions that had already drifted: /api/events and /api/footprint both
 * omitted `electronics` and `fashion` long after those sectors went live,
 * so a footprint or event in either sector was rejected with a 400 that
 * looked like a client bug. Deriving it means adding a sector to SECTORS
 * can never again leave a route silently behind.
 */
export const sectorEnum = z.enum(
  Object.keys(SECTORS) as [keyof typeof SECTORS, ...(keyof typeof SECTORS)[]],
);

/**
 * A JSON object accepted from a client and stored verbatim in a `Json`
 * column (footprint data, listing attributes, event metadata).
 *
 * Unbounded, these are a free write-amplification primitive: one authorised
 * user can push megabytes per request into Postgres until the disk fills.
 * Capping key count and serialized size costs nothing for honest payloads —
 * the largest real one in the app (a listing's attributes) is a few hundred
 * bytes.
 */
export function boundedJsonRecord(maxKeys: number, maxSerializedBytes: number) {
  return z
    .record(z.string().max(120), z.unknown())
    .refine((value) => Object.keys(value).length <= maxKeys, {
      message: `Too many fields (max ${maxKeys})`,
    })
    .refine((value) => JSON.stringify(value).length <= maxSerializedBytes, {
      message: `Payload too large (max ${maxSerializedBytes} bytes)`,
    });
}

/** Free-text fields a client supplies that end up rendered back to users or sent to Claude. */
export const shortText = z.string().trim().min(1).max(200);
