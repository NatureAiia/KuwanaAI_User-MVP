import { z } from "zod";

// The only admin-gated path that can move a user into corporate/regulator/
// provider — see src/app/api/admin/users/[id]/route.ts. Kept in its own
// module for the same reason as onboardingSchema.ts: route files only
// permit specific recognized exports, and this way it's unit-testable.
export const adminUserUpdateSchema = z.object({
  role: z.enum(["consumer", "corporate", "regulator", "provider"]),
});
