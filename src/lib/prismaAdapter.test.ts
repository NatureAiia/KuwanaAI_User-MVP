import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Guards the fix for a silent 2x overshoot of the deployed connection budget.
 *
 * `pg.Pool` ignores the `connection_limit` parameter the Helm chart puts on the
 * database URL — that is Prisma-engine syntax — and defaults to `max: 10`. The
 * chart meanwhile refuses to render a release whose `replicas x connectionLimit`
 * exceeds `max_connections`, so the guard asserted a budget nothing enforced
 * and every pod opened twice its allocation.
 *
 * These assert on the options handed to `pg.Pool`, because that is the only
 * place the real number is decided.
 */
const poolConstructor = vi.fn();

vi.mock("pg", () => ({
  Pool: class {
    constructor(options: unknown) {
      poolConstructor(options);
    }
  },
}));

vi.mock("@prisma/adapter-pg", () => ({
  PrismaPg: class {
    constructor(public pool: unknown) {}
  },
}));

const { createPrismaAdapter } = await import("@/lib/prismaAdapter");

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  poolConstructor.mockReset();
  process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/db";
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

function optionsFromLastPool(): Record<string, unknown> {
  createPrismaAdapter();
  return poolConstructor.mock.calls.at(-1)![0] as Record<string, unknown>;
}

describe("createPrismaAdapter pool sizing", () => {
  it("uses DATABASE_POOL_MAX when the chart sets it", () => {
    process.env.DATABASE_POOL_MAX = "5";
    expect(optionsFromLastPool().max).toBe(5);
  });

  it("never leaves max unset — an unset max is pg's default of 10, i.e. double the budget", () => {
    delete process.env.DATABASE_POOL_MAX;
    const options = optionsFromLastPool();

    expect(options.max).toBeDefined();
    expect(options.max).toBe(5);
  });

  it.each([
    ["an empty string", ""],
    ["a non-numeric value", "many"],
    ["zero", "0"],
    ["a negative number", "-1"],
    ["a fractional number", "2.5"],
  ])("falls back to the safe default rather than a nonsense pool for %s", (_label, value) => {
    process.env.DATABASE_POOL_MAX = value;
    expect(optionsFromLastPool().max).toBe(5);
  });

  it("honours a raised limit for a deployment with a bigger database", () => {
    process.env.DATABASE_POOL_MAX = "20";
    expect(optionsFromLastPool().max).toBe(20);
  });

  it("bounds how long a request waits for a free connection", () => {
    const options = optionsFromLastPool();
    expect(options.connectionTimeoutMillis).toBeGreaterThan(0);
  });

  it("releases idle connections instead of pinning them for the pod's lifetime", () => {
    const options = optionsFromLastPool();
    expect(options.idleTimeoutMillis).toBeGreaterThan(0);
  });

  it("still passes the connection string through", () => {
    expect(optionsFromLastPool().connectionString).toBe("postgresql://user:pass@localhost:5432/db");
  });
});
