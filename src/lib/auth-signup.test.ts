import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const file = path.join(os.tmpdir(), `depoii-auth-${process.pid}.sqlite`);

describe("signup is invite-only", () => {
  beforeEach(() => {
    process.env.DEPOII_DB = file;
    delete process.env.DEPOII_INVITE_CODE;
    if (fs.existsSync(file)) fs.unlinkSync(file);
  });

  afterEach(async () => {
    const { closeDb } = await import("@/lib/db");
    closeDb();
    if (fs.existsSync(file)) fs.unlinkSync(file);
    delete process.env.DEPOII_INVITE_CODE;
  });

  it("rejects public signup when no invite code is set", async () => {
    const { signUp } = await import("@/lib/auth");
    const result = signUp({
      name: "Test Owner",
      organization: "Test Roofing",
      email: "owner@example.com",
      password: "password1",
    });
    expect(result).toEqual({ error: "Signup is closed. Ask for a pilot invite." });
  });

  it("rejects a wrong invite code", async () => {
    process.env.DEPOII_INVITE_CODE = "pilot-only";
    const { signUp } = await import("@/lib/auth");
    const result = signUp({
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
    const { signUp } = await import("@/lib/auth");
    const result = signUp({
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
