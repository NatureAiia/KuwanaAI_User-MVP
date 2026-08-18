import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Stubs Next's cache primitives, which throw outside a request context.
    // See the file itself for why this is a mock rather than a real cache.
    setupFiles: ["./src/test/setup.ts"],
    // providerListingSchema's LISTING_IMAGE_URL_PREFIX needs an absolute
    // URL to build a valid z.string().url() prefix — real dev/prod get
    // this from .env; tests get a fixed stand-in so they're deterministic
    // regardless of ambient environment.
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
      AUTH_SECRET: "test-secret-not-real",
    },
  },
});
