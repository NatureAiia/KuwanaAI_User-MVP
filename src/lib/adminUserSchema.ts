import { z } from "zod";

// The only admin-gated path that can move a user into corporate/regulator/
// provider, or suspend/reactivate their account — see
// src/app/api/admin/users/[id]/route.ts. Kept in its own module for the same
// reason as onboardingSchema.ts: route files only permit specific recognized
// exports, and this way it's unit-testable. Both fields are optional (rather
// than a discriminated union) since a single PATCH only ever sends one of
// them today — UserRoleSelect sends `role`, UserStatusToggle sends
// `accountStatus`/`suspendedReason` — but nothing stops both at once later.
export const adminUserUpdateSchema = z
  .object({
    role: z.enum(["consumer", "corporate", "regulator", "provider"]).optional(),
    accountStatus: z.enum(["active", "suspended"]).optional(),
    suspendedReason: z.string().trim().max(500).optional(),
  })
  .refine((data) => data.role !== undefined || data.accountStatus !== undefined, {
    message: "Provide at least a role or an accountStatus",
  });
