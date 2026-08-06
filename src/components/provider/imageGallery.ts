// Shared between the client gallery field and the server upload route, so
// both enforce the exact same limits.
export const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGES = 8;

/** Moves the image at `from` to `to`, shifting the rest — index 0 is the cover. */
export function reorder(images: string[], from: number, to: number): string[] {
  if (from < 0 || from >= images.length || to < 0 || to >= images.length) return images;
  const next = [...images];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/** Promotes the image at `index` to the cover slot (index 0). */
export function setCover(images: string[], index: number): string[] {
  if (index <= 0 || index >= images.length) return images;
  return reorder(images, index, 0);
}

export function removeAt(images: string[], index: number): string[] {
  if (index < 0 || index >= images.length) return images;
  return [...images.slice(0, index), ...images.slice(index + 1)];
}
