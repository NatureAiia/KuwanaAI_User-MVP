import type { DefaultSession } from "next-auth";

// authorize() only ever returns { id, email } (see src/lib/nextAuth.ts) — no
// name/image, and id is required, not optional like the library default.
declare module "next-auth" {
  interface User {
    id: string;
    email: string;
  }

  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    sub: string;
  }
}
