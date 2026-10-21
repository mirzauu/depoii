import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { signUp } from "@/lib/auth";

describe("signup is invite-only", () => {
  beforeEach(() => {
    delete process.env.DEPOII_INVITE_CODE;
  });

  afterEach(() => {
    delete process.env.DEPOII_INVITE_CODE;
  });

  it("rejects public signup when no invite code is set", async () => {
    const result = await signUp({
      name: "Test Owner",
      organization: "Test Roofing",
      email: "owner@example.com",
      password: "password1",
    });
    expect(result).toEqual({ error: "Signup is closed. Ask for a pilot invite." });
  });

  it("rejects a wrong invite code", async () => {
    process.env.DEPOII_INVITE_CODE = "pilot-only";
    const result = await signUp({
      name: "Test Owner",
      organization: "Test Roofing",
      email: "owner@example.com",
      password: "password1",
      invite: "wrong",
    });
    expect(result).toEqual({ error: "Signup is closed. Ask for a pilot invite." });
  });

  it("accepts a matching invite code", async () => {
    process.env.DEPOII_INVITE_CODE = "pilot-only";
    const result = await signUp({
      name: "Test Owner",
      organization: "Test Roofing",
      email: "owner@example.com",
      password: "password1",
      invite: "pilot-only",
    });
    expect("user" in result).toBe(true);
    if ("user" in result) {
      expect(result.user.email).toBe("owner@example.com");
      expect(result.user.orgName).toBe("Test Roofing");
    }
  });
});
