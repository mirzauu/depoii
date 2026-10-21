import { readPermitContacts, upsertPermitContacts } from "@/lib/db";
import type { PermitContact, PermitContactRole } from "@/lib/types";
import { createPermitContact, verifyEmailMx } from "./hygiene";

const UA = "Depoii/1.0 (public-records dashboard)";

/** Parses contact sections from Accela / Municipal public permit HTML pages. */
export function parseAccelaHtml(permitId: string, html: string, source: string): PermitContact[] {
  const contacts: PermitContact[] = [];

  // 1. Applicant Section
  const applicantSection = html.match(/(?:Applicant|APPLICANT)[\s\S]{1,800}?(?=(?:Licensed Professional|Contractor|Owner|Detail Information|$))/i);
  if (applicantSection) {
    const text = applicantSection[0].replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ");
    const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    const phoneMatch = text.match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}(?:\s*(?:ext|x|#)\.?\s*\d+)?/i);
    const nameMatch = text.match(/(?:Name|Applicant):\s*([A-Za-z\s,.'-]{3,40}?)(?=\s*(?:Phone|Email|Tel|Cell|Fax|\b\d{3}\b|$))/i) || text.match(/\b([A-Z][a-z]+ [A-Z][a-z]+)\b/);

    const contact = createPermitContact(
      permitId,
      {
        role: "applicant",
        name: nameMatch ? nameMatch[1].trim() : "Permit Applicant",
        phone: phoneMatch ? phoneMatch[0] : undefined,
        email: emailMatch ? emailMatch[0] : undefined,
        source,
      },
      source,
    );
    if (contact && (contact.phone || contact.email)) contacts.push(contact);
  }

  // 2. Contractor / Licensed Professional Section
  const contractorSection = html.match(/(?:Licensed Professional|Contractor|CONTRACTOR)[\s\S]{1,800}?(?=(?:Applicant|Owner|Detail Information|$))/i);
  if (contractorSection) {
    const text = contractorSection[0].replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ");
    const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    const phoneMatch = text.match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}(?:\s*(?:ext|x|#)\.?\s*\d+)?/i);
    const nameMatch = text.match(/(?:Business Name|Contractor|Name):\s*([A-Za-z0-9\s,.'-]{3,50}?)(?=\s*(?:Phone|Email|Tel|Cell|Fax|\b\d{3}\b|$))/i) || text.match(/\b([A-Z][A-Za-z0-9\s&]{3,40}(?:Roofing|Construction|Contractor|LLC|Inc|Corp))\b/i);

    const contact = createPermitContact(
      permitId,
      {
        role: "contractor",
        name: nameMatch ? nameMatch[1].trim() : "Contractor",
        phone: phoneMatch ? phoneMatch[0] : undefined,
        email: emailMatch ? emailMatch[0] : undefined,
        source,
      },
      source,
    );
    if (contact && (contact.phone || contact.email || contact.company)) contacts.push(contact);
  }

  // 3. Owner Section
  const ownerSection = html.match(/(?:Property Owner|Owner Name|Owner:)[\s\S]{1,800}?(?=(?:Applicant|Contractor|Licensed Professional|$))/i);
  if (ownerSection) {
    const text = ownerSection[0].replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ");
    const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    const phoneMatch = text.match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}(?:\s*(?:ext|x|#)\.?\s*\d+)?/i);
    const nameMatch = text.match(/(?:Owner|Name):\s*([A-Za-z0-9\s,.'-]{3,50}?)(?=\s*(?:Phone|Email|Tel|Cell|Fax|\b\d{3}\b|$))/i);

    const contact = createPermitContact(
      permitId,
      {
        role: "owner_rep",
        name: nameMatch ? nameMatch[1].trim() : "Property Owner",
        phone: phoneMatch ? phoneMatch[0] : undefined,
        email: emailMatch ? emailMatch[0] : undefined,
        source,
      },
      source,
    );
    if (contact && (contact.phone || contact.email)) contacts.push(contact);
  }

  return contacts;
}

/** Fetches on-demand contacts for a permit or returns cached records from SQLite. */
export async function fetchPermitContactsOnDemand(
  permitId: string,
  recordUrl?: string | null,
  fetchImpl: typeof fetch = fetch,
): Promise<PermitContact[]> {
  // Check cache first
  const existing = await readPermitContacts(permitId);
  if (existing.length > 0) return existing;

  if (!recordUrl || !/^https?:\/\//i.test(recordUrl)) {
    return [];
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetchImpl(recordUrl, {
      headers: { "User-Agent": UA, Accept: "text/html" },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return [];
    const html = await res.text();
    const parsed = parseAccelaHtml(permitId, html, recordUrl);

    if (parsed.length === 0) return [];

    // Run email deliverability verification
    for (const c of parsed) {
      if (c.email) {
        c.deliverability = await verifyEmailMx(c.email);
      }
    }

    // Persist to database
    const now = new Date().toISOString();
    await upsertPermitContacts(
      parsed.map((contact) => ({ ...contact, permitId })),
      now,
    );

    return parsed;
  } catch {
    return [];
  }
}
