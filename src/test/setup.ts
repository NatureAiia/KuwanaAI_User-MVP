import { vi } from "vitest";

/**
 * Next's cache primitives need a request context that unit tests don't have.
 *
 * `unstable_cache` does not degrade gracefully outside the Next server — it
 * throws `Invariant: incrementalCache missing`, which would fail every test
 * that touches src/lib/catalog.ts, plus everything importing it transitively
 * (notifications, alerts, shorts, the intake classifier). `revalidateTag` is
 * the same story from the write side.
 *
 * So both are replaced here with the identity/no-op behaviour a unit test
 * wants: the cached function is simply called. That means these tests assert
 * the *query logic*, and never accidentally assert cache behaviour — which is
 * the right split, because whether a value is genuinely shared across
 * replicas is only answerable against a real store, not a mock. That part is
 * covered by the Redis integration check instead.
 *
 * Spread from the real module so the other exports (revalidatePath,
 * unstable_noStore, …) keep working untouched.
 */
vi.mock("next/cache", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/cache")>();
  return {
    ...actual,
    unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
    revalidateTag: vi.fn(),
    revalidatePath: vi.fn(),
  };
});
