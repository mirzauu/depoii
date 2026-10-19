import type { EmailDeliverability, PermitContact, PermitContactRole } from "@/lib/types";

const GENERIC_EMAIL_PREFIXES = new Set([
  "info",
  "admin",
  "administrator",
  "office",
  "permits",
  "permit",
  "contact",
  "support",
  "sales",
  "service",
  "services",
  "billing",
  "invoices",
  "accounting",
  "estimating",
  "estimates",
  "help",
  "mail",
  "inquiry",
  "inquiries",
  "general",
  "frontdesk",
  "reception",
]);

/** Normalize phone to E.164 (+1XXXXXXXXXX) and a clean display format. */
export function normalizePhone(raw?: string | null): { phone?: string; phoneFormatted?: string } {
  if (!raw) return {};
  const trimmed = raw.trim();
  if (!trimmed) return {};

  // Check for extension and strip it from core digits
  const extMatch = trimmed.match(/(?:ext|x|#)\.?\s*(\d+)/i);
  const ext = extMatch ? ` ext. ${extMatch[1]}` : "";
  const withoutExt = extMatch ? trimmed.slice(0, extMatch.index).trim() : trimmed;

  // Strip non-digits from main phone part
  const digits = withoutExt.replace(/\D/g, "");

  let coreDigits = digits;
  if (digits.length === 11 && digits.startsWith("1")) {
    coreDigits = digits.slice(1);
  }

  if (coreDigits.length === 10) {
    const area = coreDigits.slice(0, 3);
    const mid = coreDigits.slice(3, 6);
    const last = coreDigits.slice(6, 10);
    return {
      phone: `+1${coreDigits}${extMatch ? `x${extMatch[1]}` : ""}`,
      phoneFormatted: `(${area}) ${mid}-${last}${ext}`,
    };
  }

  // If irregular length but non-empty digits
  if (digits.length >= 7) {
    return {
      phone: `+${digits}`,
      phoneFormatted: trimmed,
    };
  }

  return {};
}

/** Classifies an email address into personal or generic company mailbox. */
export function classifyEmail(email?: string | null): {
  email?: string;
  emailType?: "personal" | "generic";
  deliverability?: EmailDeliverability;
} {
  if (!email) return {};
  const clean = email.trim().toLowerCase();
  const emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;
  if (!emailRegex.test(clean)) return {};

  const localPart = clean.split("@")[0].toLowerCase();
  const isGeneric = GENERIC_EMAIL_PREFIXES.has(localPart);

  return {
    email: clean,
    emailType: isGeneric ? "generic" : "personal",
    deliverability: isGeneric ? "generic" : "unverified",
  };
}

/** Non-invasive MX deliverability verification via DNS */
export async function verifyEmailMx(
  email?: string | null,
  dnsResolver: (domain: string) => Promise<unknown[]> = async (domain) => {
    const dns = await import("node:dns/promises");
    return dns.resolveMx(domain);
  },
): Promise<EmailDeliverability> {
  const { email: clean, emailType } = classifyEmail(email);
  if (!clean) return "undeliverable";
  if (emailType === "generic") return "generic";

  const domain = clean.split("@")[1];
  try {
    const mxRecords = await dnsResolver(domain);
    return mxRecords && mxRecords.length > 0 ? "verified" : "undeliverable";
  } catch {
    return "undeliverable";
  }
}

function contactSlug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32) || "unnamed";
}

export interface ContactCandidate {
  role: PermitContactRole;
  name?: string | null;
  company?: string | null;
  phone?: string | null;
  email?: string | null;
  source?: string;
}

/** Constructs a clean PermitContact object or null if name/contact info is missing. */
export function createPermitContact(permitId: string, candidate: ContactCandidate, defaultSource: string): PermitContact | null {
  const name = (candidate.name || candidate.company || "").trim();
  if (!name || /^unknown|none|n\/a$/i.test(name)) return null;

  const { phone, phoneFormatted } = normalizePhone(candidate.phone);
  const { email, emailType, deliverability } = classifyEmail(candidate.email);

  // If there's neither phone, email, nor company name beyond the name, only keep if it's a identified contractor or applicant
  const company = candidate.company?.trim() || undefined;
  const slugPart = contactSlug(name);
  const id = `${permitId}:${candidate.role}:${slugPart}`;

  return {
    id,
    permitId,
    role: candidate.role,
    name,
    company: company && company !== name ? company : undefined,
    phone,
    phoneFormatted,
    email,
    emailType,
    deliverability,
    source: candidate.source || defaultSource,
  };
}

/** Extracts candidate contacts from generic attribute record (e.g. from ArcGIS or Depoii Engine row). */
export function extractContactsFromRecord(
  permitId: string,
  record: Record<string, unknown>,
  source: string,
): PermitContact[] {
  const contacts: PermitContact[] = [];

  const pick = (keys: string[]): string | undefined => {
    for (const k of keys) {
      const v = record[k];
      if (v != null && String(v).trim()) return String(v).trim();
    }
    return undefined;
  };

  // 1. Applicant contact
  const applicantName = pick(["applicant_name", "applicantName", "applicant", "B1_APPLICANT_NAME", "APPLICANT_NAME"]);
  const applicantCompany = pick(["applicant_company", "applicantCompany", "B1_APPLICANT_ORG", "APPLICANT_ORG"]);
  const applicantPhone = pick(["applicant_phone", "applicantPhone", "B1_APPLICANT_PHONE", "APPLICANT_PHONE", "phone", "Phone"]);
  const applicantEmail = pick(["applicant_email", "applicantEmail", "B1_APPLICANT_EMAIL", "APPLICANT_EMAIL", "email", "Email"]);

  if (applicantName || applicantPhone || applicantEmail) {
    const contact = createPermitContact(
      permitId,
      {
        role: "applicant",
        name: applicantName || applicantCompany || "Permit Applicant",
        company: applicantCompany,
        phone: applicantPhone,
        email: applicantEmail,
        source,
      },
      source,
    );
    if (contact) contacts.push(contact);
  }

  // 2. Contractor contact
  const contractorName = pick(["contractor", "contractor_name", "contractorName", "B1_SPECIAL_TEXT", "CONTRACTOR_NAME"]);
  const contractorCompany = pick(["contractor_company", "contractorCompany", "B1_CONTRACTOR_ORG"]);
  const contractorPhone = pick(["contractor_phone", "contractorPhone", "B1_CONTRACTOR_PHONE", "CONTRACTOR_PHONE"]);
  const contractorEmail = pick(["contractor_email", "contractorEmail", "B1_CONTRACTOR_EMAIL", "CONTRACTOR_EMAIL"]);

  if (contractorName && !/Contractor not named/i.test(contractorName)) {
    const contact = createPermitContact(
      permitId,
      {
        role: "contractor",
        name: contractorName,
        company: contractorCompany,
        phone: contractorPhone,
        email: contractorEmail,
        source,
      },
      source,
    );
    if (contact) contacts.push(contact);
  }

  // 3. Property Owner contact
  const ownerName = pick(["owner", "owner_name", "ownerName", "B1_OWNER_NAME", "OWNER_NAME"]);
  const ownerPhone = pick(["owner_phone", "ownerPhone", "B1_OWNER_PHONE", "OWNER_PHONE"]);
  const ownerEmail = pick(["owner_email", "ownerEmail", "B1_OWNER_EMAIL", "OWNER_EMAIL"]);

  if (ownerName && !/Owner name blank/i.test(ownerName)) {
    const contact = createPermitContact(
      permitId,
      {
        role: "owner_rep",
        name: ownerName,
        phone: ownerPhone,
        email: ownerEmail,
        source,
      },
      source,
    );
    if (contact) contacts.push(contact);
  }

  return contacts;
}
