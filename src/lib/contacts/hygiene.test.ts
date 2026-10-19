import { describe, expect, it } from "vitest";
import {
  classifyEmail,
  createPermitContact,
  extractContactsFromRecord,
  normalizePhone,
  verifyEmailMx,
} from "./hygiene";

describe("normalizePhone", () => {
  it("formats standard 10-digit US phone numbers", () => {
    expect(normalizePhone("8175550199")).toEqual({
      phone: "+18175550199",
      phoneFormatted: "(817) 555-0199",
    });
    expect(normalizePhone("(214) 777-8888")).toEqual({
      phone: "+12147778888",
      phoneFormatted: "(214) 777-8888",
    });
  });

  it("handles leading 1 prefix and extensions", () => {
    expect(normalizePhone("1-817-555-0199 ext. 42")).toEqual({
      phone: "+18175550199x42",
      phoneFormatted: "(817) 555-0199 ext. 42",
    });
    expect(normalizePhone("817.555.0199 x101")).toEqual({
      phone: "+18175550199x101",
      phoneFormatted: "(817) 555-0199 ext. 101",
    });
  });

  it("returns empty object for empty or missing input", () => {
    expect(normalizePhone("")).toEqual({});
    expect(normalizePhone(null)).toEqual({});
    expect(normalizePhone("   ")).toEqual({});
  });
});

describe("classifyEmail", () => {
  it("classifies personal emails as unverified", () => {
    expect(classifyEmail("john.smith@cbre.com")).toEqual({
      email: "john.smith@cbre.com",
      emailType: "personal",
      deliverability: "unverified",
    });
  });

  it("classifies generic mailboxes with deliverability generic", () => {
    expect(classifyEmail("permits@northtexasroofing.com")).toEqual({
      email: "permits@northtexasroofing.com",
      emailType: "generic",
      deliverability: "generic",
    });
    expect(classifyEmail("INFO@PROLOGIS.COM")).toEqual({
      email: "info@prologis.com",
      emailType: "generic",
      deliverability: "generic",
    });
  });

  it("rejects invalid emails", () => {
    expect(classifyEmail("not-an-email")).toEqual({});
    expect(classifyEmail("@company.com")).toEqual({});
  });
});

describe("verifyEmailMx", () => {
  it("returns verified when domain has MX records", async () => {
    const mockResolver = async () => [{ exchange: "mail.cbre.com", priority: 10 }];
    const status = await verifyEmailMx("john.smith@cbre.com", mockResolver);
    expect(status).toBe("verified");
  });

  it("returns generic when email is generic prefix regardless of MX", async () => {
    const mockResolver = async () => [{ exchange: "mail.company.com", priority: 10 }];
    const status = await verifyEmailMx("permits@company.com", mockResolver);
    expect(status).toBe("generic");
  });

  it("returns undeliverable when domain has no MX records or throws DNS error", async () => {
    const failingResolver = async () => {
      throw new Error("ENOTFOUND");
    };
    const status = await verifyEmailMx("someone@invalid-nonexistent-domain.xyz", failingResolver);
    expect(status).toBe("undeliverable");
  });
});

describe("createPermitContact", () => {
  it("creates a well-formed contact and assigns a deterministic slug ID", () => {
    const contact = createPermitContact(
      "PB-100",
      {
        role: "applicant",
        name: "Jane Doe",
        company: "Transwestern",
        phone: "2145551212",
        email: "jdoe@transwestern.com",
      },
      "Test Feed",
    );
    expect(contact).toEqual({
      id: "PB-100:applicant:jane-doe",
      permitId: "PB-100",
      role: "applicant",
      name: "Jane Doe",
      company: "Transwestern",
      phone: "+12145551212",
      phoneFormatted: "(214) 555-1212",
      email: "jdoe@transwestern.com",
      emailType: "personal",
      deliverability: "unverified",
      source: "Test Feed",
    });
  });

  it("returns null if name is placeholder or missing", () => {
    expect(createPermitContact("PB-101", { role: "applicant", name: "Unknown" }, "Test")).toBeNull();
    expect(createPermitContact("PB-101", { role: "applicant", name: "" }, "Test")).toBeNull();
  });
});

describe("extractContactsFromRecord", () => {
  it("extracts applicant, contractor, and owner contacts from permit records", () => {
    const record = {
      B1_APPLICANT_NAME: "Sarah Miller",
      B1_APPLICANT_PHONE: "817-555-1234",
      B1_APPLICANT_EMAIL: "smiller@apexdevelopments.com",
      B1_SPECIAL_TEXT: "Fort Worth Roofing Co",
      B1_OWNER_NAME: "North Texas Logistics LLC",
    };

    const contacts = extractContactsFromRecord("PB26-001", record, "Fort Worth CIVIC");
    expect(contacts).toHaveLength(3);

    const applicant = contacts.find((c) => c.role === "applicant");
    expect(applicant).toMatchObject({
      role: "applicant",
      name: "Sarah Miller",
      phone: "+18175551234",
      phoneFormatted: "(817) 555-1234",
      email: "smiller@apexdevelopments.com",
      emailType: "personal",
    });

    const contractor = contacts.find((c) => c.role === "contractor");
    expect(contractor).toMatchObject({
      role: "contractor",
      name: "Fort Worth Roofing Co",
    });

    const owner = contacts.find((c) => c.role === "owner_rep");
    expect(owner).toMatchObject({
      role: "owner_rep",
      name: "North Texas Logistics LLC",
    });
  });

  it("ignores placeholder names like Unknown or Contractor not named", () => {
    const record = {
      contractor: "Contractor not named on the permit",
      owner: "Owner name blank on the roll",
    };
    const contacts = extractContactsFromRecord("PB26-002", record, "Test");
    expect(contacts).toHaveLength(0);
  });
});
