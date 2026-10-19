import { describe, expect, it } from "vitest";
import { parseAccelaHtml } from "./scraper";

describe("parseAccelaHtml", () => {
  it("parses applicant and contractor contact cards from Accela HTML snippet", () => {
    const html = `
      <div class="portlet-content">
        <h3>Applicant Information</h3>
        <table>
          <tr><td>Name:</td><td>Robert Johnson</td></tr>
          <tr><td>Phone:</td><td>(817) 555-9012 ext. 4</td></tr>
          <tr><td>Email:</td><td>rjohnson@industrialrealty.com</td></tr>
        </table>

        <h3>Licensed Professional</h3>
        <table>
          <tr><td>Contractor:</td><td>Lonestar Commercial Roofing LLC</td></tr>
          <tr><td>Phone:</td><td>214-555-4321</td></tr>
          <tr><td>Email:</td><td>office@lonestarroofs.com</td></tr>
        </table>
      </div>
    `;

    const contacts = parseAccelaHtml("PB26-789", html, "https://aca-prod.accela.com/CFW");
    expect(contacts).toHaveLength(2);

    const applicant = contacts.find((c) => c.role === "applicant");
    expect(applicant).toMatchObject({
      role: "applicant",
      name: "Robert Johnson",
      phone: "+18175559012x4",
      phoneFormatted: "(817) 555-9012 ext. 4",
      email: "rjohnson@industrialrealty.com",
    });

    const contractor = contacts.find((c) => c.role === "contractor");
    expect(contractor).toMatchObject({
      role: "contractor",
      name: "Lonestar Commercial Roofing LLC",
      phone: "+12145554321",
      email: "office@lonestarroofs.com",
    });
  });

  it("returns empty array when HTML contains no contact blocks", () => {
    const contacts = parseAccelaHtml("PB26-000", "<html><body>No data here</body></html>", "test");
    expect(contacts).toEqual([]);
  });
});
