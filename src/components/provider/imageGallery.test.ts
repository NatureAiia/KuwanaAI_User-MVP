import { describe, expect, it } from "vitest";
import { reorder, removeAt, setCover } from "@/components/provider/imageGallery";

describe("reorder", () => {
  it("moves an item from one index to another", () => {
    expect(reorder(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(reorder(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
  });

  it("is a no-op on an empty array", () => {
    expect(reorder([], 0, 0)).toEqual([]);
  });

  it("ignores out-of-bounds indices", () => {
    expect(reorder(["a", "b"], -1, 1)).toEqual(["a", "b"]);
    expect(reorder(["a", "b"], 0, 5)).toEqual(["a", "b"]);
  });

  it("is a no-op on a single-item array", () => {
    expect(reorder(["a"], 0, 0)).toEqual(["a"]);
  });
});

describe("setCover", () => {
  it("promotes the given index to the front", () => {
    expect(setCover(["a", "b", "c"], 2)).toEqual(["c", "a", "b"]);
  });

  it("is a no-op when already the cover", () => {
    expect(setCover(["a", "b"], 0)).toEqual(["a", "b"]);
  });

  it("ignores out-of-bounds indices", () => {
    expect(setCover(["a", "b"], 5)).toEqual(["a", "b"]);
    expect(setCover(["a", "b"], -1)).toEqual(["a", "b"]);
  });

  it("is a no-op on an empty array", () => {
    expect(setCover([], 0)).toEqual([]);
  });
});

describe("removeAt", () => {
  it("removes the item at the given index", () => {
    expect(removeAt(["a", "b", "c"], 1)).toEqual(["a", "c"]);
  });

  it("removes the only item, leaving an empty array", () => {
    expect(removeAt(["a"], 0)).toEqual([]);
  });

  it("ignores out-of-bounds indices", () => {
    expect(removeAt(["a", "b"], 5)).toEqual(["a", "b"]);
    expect(removeAt(["a", "b"], -1)).toEqual(["a", "b"]);
  });

  it("is a no-op on an empty array", () => {
    expect(removeAt([], 0)).toEqual([]);
  });
});
