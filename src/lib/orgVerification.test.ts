import { describe, expect, it } from "vitest";
import { emailMatchesRegulator, isPersonalEmailDomain } from "@/lib/orgVerification";

describe("isPersonalEmailDomain", () => {
  it.each(["a@gmail.com", "a@yahoo.com", "a@hotmail.com", "a@icloud.com"])(
    "rejects %s as a Corporate email",
    (email) => {
      expect(isPersonalEmailDomain(email)).toBe(true);
    },
  );

  it("accepts a company domain", () => {
    expect(isPersonalEmailDomain("a@cbz.co.zw")).toBe(false);
  });

  it("treats a malformed email as personal (fails closed)", () => {
    expect(isPersonalEmailDomain("not-an-email")).toBe(true);
  });
});

describe("emailMatchesRegulator", () => {
  it("matches the correct regulator's domain", () => {
    expect(emailMatchesRegulator("a@potraz.gov.zw", "POTRAZ")).toBe(true);
  });

  it("rejects a different regulator's domain", () => {
    expect(emailMatchesRegulator("a@rbz.co.zw", "POTRAZ")).toBe(false);
  });

  it("rejects an unrecognized regulator name", () => {
    expect(emailMatchesRegulator("a@potraz.gov.zw", "NOT_REAL")).toBe(false);
  });

  it("rejects any non-regulator domain, e.g. a personal email", () => {
    expect(emailMatchesRegulator("a@gmail.com", "POTRAZ")).toBe(false);
  });
});
