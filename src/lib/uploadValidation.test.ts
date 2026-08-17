import { describe, expect, it } from "vitest";
import { bytesMatchDeclaredType, MAGIC_BYTES_NEEDED } from "@/lib/uploadValidation";

/** Real leading bytes for each format, per their specifications. */
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d];
// RIFF, then a size that differs per file, then WEBP.
const WEBP = [0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50];

const bytes = (values: number[]) => new Uint8Array(values);

describe("bytesMatchDeclaredType", () => {
  it("accepts a real JPEG declared as image/jpeg", () => {
    expect(bytesMatchDeclaredType(bytes(JPEG), "image/jpeg")).toBe(true);
  });

  it("accepts a real PNG declared as image/png", () => {
    expect(bytesMatchDeclaredType(bytes(PNG), "image/png")).toBe(true);
  });

  it("accepts a real WebP declared as image/webp", () => {
    expect(bytesMatchDeclaredType(bytes(WEBP), "image/webp")).toBe(true);
  });

  it("ignores the WebP size field, which differs per file", () => {
    const other = [...WEBP];
    other[4] = 0xff;
    other[5] = 0xee;
    other[6] = 0xdd;
    other[7] = 0xcc;
    expect(bytesMatchDeclaredType(bytes(other), "image/webp")).toBe(true);
  });

  // The whole point: the declared type is the client's claim about the bytes.
  it("rejects HTML sent under an image/png label", () => {
    const html = new TextEncoder().encode("<html><script>alert(1)</script>");
    expect(bytesMatchDeclaredType(html, "image/png")).toBe(false);
  });

  it("rejects SVG sent under an image/png label", () => {
    const svg = new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'>");
    expect(bytesMatchDeclaredType(svg, "image/png")).toBe(false);
  });

  it("rejects a real JPEG mislabelled as image/png", () => {
    expect(bytesMatchDeclaredType(bytes(JPEG), "image/png")).toBe(false);
  });

  it("rejects a real PNG mislabelled as image/webp", () => {
    expect(bytesMatchDeclaredType(bytes(PNG), "image/webp")).toBe(false);
  });

  it("rejects RIFF that is not WebP — a .wav renamed", () => {
    const wav = [...WEBP];
    // "WAVE" where "WEBP" should be.
    wav[8] = 0x57;
    wav[9] = 0x41;
    wav[10] = 0x56;
    wav[11] = 0x45;
    expect(bytesMatchDeclaredType(bytes(wav), "image/webp")).toBe(false);
  });

  it("rejects a type it has no signature for rather than passing it through", () => {
    // Failing open here would quietly undo the check for anything the caller's
    // own allowlist ever gains.
    expect(bytesMatchDeclaredType(bytes(PNG), "image/gif")).toBe(false);
    expect(bytesMatchDeclaredType(bytes(PNG), "application/octet-stream")).toBe(false);
    expect(bytesMatchDeclaredType(bytes(PNG), "")).toBe(false);
  });

  it("rejects a truncated file rather than reading past the end", () => {
    expect(bytesMatchDeclaredType(bytes(PNG.slice(0, 3)), "image/png")).toBe(false);
    expect(bytesMatchDeclaredType(new Uint8Array(), "image/png")).toBe(false);
  });

  it("needs no more than MAGIC_BYTES_NEEDED bytes to decide", () => {
    // The route only slices this many off the file, so any signature longer
    // than this would silently never match.
    expect(bytesMatchDeclaredType(bytes(PNG.slice(0, MAGIC_BYTES_NEEDED)), "image/png")).toBe(true);
    expect(bytesMatchDeclaredType(bytes(WEBP.slice(0, MAGIC_BYTES_NEEDED)), "image/webp")).toBe(true);
    expect(bytesMatchDeclaredType(bytes(JPEG.slice(0, MAGIC_BYTES_NEEDED)), "image/jpeg")).toBe(true);
  });
});
