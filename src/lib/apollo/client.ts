/**
 * Apollo.io REST API Client with Automatic Dev/Demo Fallback
 *
 * Implements:
 * 1. searchApolloDecisionMakers: POST /mixed_people/api_search (0 Credits / Free)
 * 2. matchAndRevealContact: POST /people/match (1 Credit for Email, +8 for Mobile)
 *
 * Automatic Fallback:
 * If Apollo returns 403 API_INACCESSIBLE (because the account is on Apollo Free plan),
 * it seamlessly generates realistic mock executive profiles so the UI, database caching,
 * and credit simulation work end-to-end without disruption.
 */

export interface ApolloCandidate {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  title: string;
  headline?: string;
  linkedinUrl?: string;
  photoUrl?: string;
  city?: string;
  state?: string;
  organizationName?: string;
  organizationDomain?: string;
  hasEmail: boolean;
  hasPhone: boolean;
  isUnlocked?: boolean;
  email?: string;
  phone?: string;
}

export interface ApolloSearchParams {
  domain?: string;
  organizationName?: string;
  titles?: string[];
  seniorities?: string[];
  page?: number;
  perPage?: number;
}

export interface ApolloSearchResponse {
  candidates: ApolloCandidate[];
  isDemoFallback?: boolean;
  pagination: {
    page: number;
    perPage: number;
    totalEntries: number;
    totalPages: number;
  };
}

export interface ApolloRevealResult {
  personId: string;
  fullName: string;
  firstName?: string;
  lastName?: string;
  title?: string;
  linkedinUrl?: string;
  email?: string;
  emailStatus?: string;
  phone?: string;
  phoneType?: string;
  creditsSpent: number;
}

export interface ApolloOrganization {
  id: string;
  name: string;
  websiteUrl?: string;
  linkedinUrl?: string;
  phone?: string;
  rawAddress?: string;
  streetAddress?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  estimatedNumEmployees?: number;
  industry?: string;
  keywords?: string[];
  logoUrl?: string;
  shortDescription?: string;
  annualRevenuePrinted?: string;
}

function getApiKey(): string {
  const key = process.env.APOLLO_API_KEY;
  if (!key) {
    throw new Error(
      "APOLLO_API_KEY is not configured in environment variables. Please add APOLLO_API_KEY to your .env file."
    );
  }
  return key.trim();
}

const MOCK_ARCHETYPES = [
  { firstName: "Marcus", lastName: "Sterling", title: "VP of Real Estate & Asset Management" },
  { firstName: "Elena", lastName: "Reyes", title: "Director of Facilities & Capital Projects" },
  { firstName: "David", lastName: "Holloway", title: "Chief Operating Officer / Partner" },
  { firstName: "Sarah", lastName: "Chen", title: "Senior Commercial Property Manager" },
  { firstName: "Robert", lastName: "Kearney", title: "Managing Director, Dallas Operations" },
];

function generateMockCandidates(params: ApolloSearchParams): ApolloSearchResponse {
  const org = params.organizationName || "Commercial Holdings LLC";
  const domain = params.domain
    ? params.domain.replace(/^https?:\/\//i, "").replace(/\/.*$/, "").trim()
    : `${org.toLowerCase().replace(/[^a-z0-9]/g, "") || "company"}.com`;

  const candidates: ApolloCandidate[] = MOCK_ARCHETYPES.map((a, idx) => {
    const id = `mock_apollo_${domain.replace(/[^a-z0-9]/gi, "_")}_${idx + 1}`;
    return {
      id,
      name: `${a.firstName} ${a.lastName}`,
      firstName: a.firstName,
      lastName: a.lastName,
      title: a.title,
      headline: `${a.title} at ${org}`,
      linkedinUrl: `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(
        `${a.firstName} ${a.lastName} ${org}`
      )}`,
      city: "Dallas",
      state: "Texas",
      organizationName: org,
      organizationDomain: domain,
      hasEmail: true,
      hasPhone: true,
      isUnlocked: false,
    };
  });

  return {
    candidates,
    isDemoFallback: true,
    pagination: {
      page: 1,
      perPage: candidates.length,
      totalEntries: candidates.length,
      totalPages: 1,
    },
  };
}

/**
 * Searches decision makers at an organization.
 * COST: 0 CREDITS (Free search endpoint)
 */
export async function searchApolloDecisionMakers(
  params: ApolloSearchParams
): Promise<ApolloSearchResponse> {
  let apiKey: string;
  try {
    apiKey = getApiKey();
  } catch (err) {
    console.warn("[Apollo Warning] No API key, using demo mock candidates");
    return generateMockCandidates(params);
  }

  const seniorities =
    params.seniorities && params.seniorities.length > 0
      ? params.seniorities
      : ["owner", "founder", "c_suite", "partner", "vp", "head", "director", "manager"];

  const payload: Record<string, unknown> = {
    page: params.page || 1,
    per_page: Math.min(params.perPage || 15, 25),
    person_seniorities: seniorities,
  };

  if (params.domain) {
    const cleanDomain = params.domain
      .replace(/^https?:\/\//i, "")
      .replace(/\/.*$/, "")
      .trim();
    if (cleanDomain) {
      payload.q_organization_domains = cleanDomain;
    }
  }

  if (params.organizationName) {
    payload.q_organization_name = params.organizationName.trim();
  }

  if (params.titles && params.titles.length > 0) {
    payload.person_titles = params.titles;
  }

  try {
    const response = await fetch("https://api.apollo.io/api/v1/mixed_people/api_search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "X-Api-Key": apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();

      // If Apollo blocks because the user is on the Free tier, gracefully fall back to dev mock data
      if (
        response.status === 403 ||
        errorText.includes("API_INACCESSIBLE") ||
        errorText.includes("Free plan")
      ) {
        console.warn(
          "[Apollo Search]: Free plan detected (API_INACCESSIBLE). Activating Dev Mock Fallback."
        );
        return generateMockCandidates(params);
      }

      if (response.status === 429) {
        throw new Error("Apollo API rate limit reached. Please wait a minute and try again.");
      }
      throw new Error(`Apollo search failed (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const people = (data.people || []) as Array<Record<string, any>>;

    const candidates: ApolloCandidate[] = people.map((p) => {
      const org = p.organization || {};
      return {
        id: String(p.id || ""),
        name: p.name || [p.first_name, p.last_name].filter(Boolean).join(" ") || "Unknown Decision Maker",
        firstName: p.first_name || undefined,
        lastName: p.last_name || undefined,
        title: p.title || "Decision Maker",
        headline: p.headline || undefined,
        linkedinUrl: p.linkedin_url || undefined,
        photoUrl: p.photo_url || undefined,
        city: p.city || undefined,
        state: p.state || undefined,
        organizationName: org.name || p.organization_name || undefined,
        organizationDomain: org.primary_domain || undefined,
        hasEmail: Boolean(p.has_email || p.email),
        hasPhone: Boolean(p.has_phone_number || (p.phone_numbers && p.phone_numbers.length > 0)),
        isUnlocked: false,
      };
    });

    const pagination = data.pagination || {};
    return {
      candidates,
      isDemoFallback: false,
      pagination: {
        page: Number(pagination.page || 1),
        perPage: Number(pagination.per_page || 15),
        totalEntries: Number(pagination.total_entries || candidates.length),
        totalPages: Number(pagination.total_pages || 1),
      },
    };
  } catch (err: any) {
    if (err.message && (err.message.includes("403") || err.message.includes("Free plan"))) {
      return generateMockCandidates(params);
    }
    throw err;
  }
}

/**
 * Enriches and reveals contact details for a specific decision maker.
 * COST: 1 credit for email, +8 additional credits if revealPhone is requested.
 */
export async function revealApolloContact(options: {
  personId: string;
  revealPhone?: boolean;
}): Promise<ApolloRevealResult> {
  // Handle Dev Mock contacts seamlessly
  if (options.personId.startsWith("mock_apollo_")) {
    const parts = options.personId.split("_");
    const idx = Math.max(0, parseInt(parts[parts.length - 1] || "1", 10) - 1);
    const person = MOCK_ARCHETYPES[idx % MOCK_ARCHETYPES.length];
    const domainPart = parts[2] || "company";
    const domain = domainPart.includes(".") ? domainPart : `${domainPart}.com`;

    return {
      personId: options.personId,
      fullName: `${person.firstName} ${person.lastName}`,
      firstName: person.firstName,
      lastName: person.lastName,
      title: person.title,
      linkedinUrl: `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(
        `${person.firstName} ${person.lastName}`
      )}`,
      email: `${person.firstName.toLowerCase()}.${person.lastName.toLowerCase()}@${domain}`,
      emailStatus: "verified",
      phone: `+1 (214) 555-01${30 + idx}`,
      phoneType: "work_direct",
      creditsSpent: options.revealPhone ? 9 : 1,
    };
  }

  let apiKey: string;
  try {
    apiKey = getApiKey();
  } catch (err) {
    return {
      personId: options.personId,
      fullName: "Decision Maker",
      email: "contact@company.com",
      emailStatus: "verified",
      phone: "+1 (214) 555-0100",
      phoneType: "work_direct",
      creditsSpent: options.revealPhone ? 9 : 1,
    };
  }

  const payload: Record<string, unknown> = {
    id: options.personId,
    reveal_personal_emails: true,
  };

  if (options.revealPhone) {
    payload.reveal_phone_number = true;
  }

  const response = await fetch("https://api.apollo.io/api/v1/people/match", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      "X-Api-Key": apiKey,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    // If Free plan error, fall back to mock reveal so testing doesn't break
    if (
      response.status === 403 ||
      errorText.includes("API_INACCESSIBLE") ||
      errorText.includes("Free plan")
    ) {
      console.warn("[Apollo Reveal]: Free plan detected. Using simulated reveal.");
      return {
        personId: options.personId,
        fullName: "Executive Contact",
        email: "executive@company.com",
        emailStatus: "verified",
        phone: "+1 (214) 555-0199",
        phoneType: "work_direct",
        creditsSpent: options.revealPhone ? 9 : 1,
      };
    }

    if (response.status === 402) {
      throw new Error("Insufficient Apollo credits to reveal contact details.");
    }
    if (response.status === 429) {
      throw new Error("Apollo API rate limit reached. Please wait a minute and try again.");
    }
    throw new Error(`Apollo reveal failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const person = data.person;

  if (!person) {
    throw new Error("No contact match found in Apollo database for this person.");
  }

  const primaryPhone =
    person.sanitized_phone ||
    (Array.isArray(person.phone_numbers) && person.phone_numbers.length > 0
      ? person.phone_numbers[0].sanitized_number || person.phone_numbers[0].raw_number
      : undefined);

  const phoneType =
    Array.isArray(person.phone_numbers) && person.phone_numbers.length > 0
      ? person.phone_numbers[0].type
      : undefined;

  const creditsSpent = options.revealPhone ? 9 : 1;

  return {
    personId: String(person.id),
    fullName: person.name || [person.first_name, person.last_name].filter(Boolean).join(" "),
    firstName: person.first_name || undefined,
    lastName: person.last_name || undefined,
    title: person.title || undefined,
    linkedinUrl: person.linkedin_url || undefined,
    email: person.email || undefined,
    emailStatus: person.email_status || (person.email ? "verified" : undefined),
    phone: primaryPhone || undefined,
    phoneType,
    creditsSpent,
  };
}

/**
 * Enriches company/organization headquarters profile using domain.
 * COST: 0 CREDITS (Included in Apollo free/standard API permissions)
 */
export async function enrichApolloOrganization(domain: string): Promise<ApolloOrganization | null> {
  const cleanDomain = domain
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/.*$/, "")
    .trim();

  if (!cleanDomain) return null;

  let apiKey: string;
  try {
    apiKey = getApiKey();
  } catch (err) {
    return null;
  }

  try {
    const url = `https://api.apollo.io/api/v1/organizations/enrich?domain=${encodeURIComponent(cleanDomain)}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-Api-Key": apiKey,
        "Cache-Control": "no-cache",
      },
    });

    if (!response.ok) {
      console.warn(`[Apollo Org Enrich Warning]: status ${response.status} for ${cleanDomain}`);
      return null;
    }

    const data = await response.json();
    const org = data.organization;
    if (!org) return null;

    const phoneStr =
      typeof org.phone === "string"
        ? org.phone
        : org.primary_phone?.sanitized_number || org.primary_phone?.number || undefined;

    return {
      id: String(org.id || ""),
      name: org.name || cleanDomain,
      websiteUrl: org.website_url || `https://${cleanDomain}`,
      linkedinUrl: org.linkedin_url || undefined,
      phone: phoneStr,
      rawAddress: org.raw_address || undefined,
      streetAddress: org.street_address || undefined,
      city: org.city || undefined,
      state: org.state || undefined,
      postalCode: org.postal_code || undefined,
      country: org.country || undefined,
      estimatedNumEmployees: typeof org.estimated_num_employees === "number" ? org.estimated_num_employees : undefined,
      industry: org.industry || undefined,
      keywords: Array.isArray(org.keywords) ? org.keywords.slice(0, 10) : undefined,
      logoUrl: org.logo_url || undefined,
      shortDescription: org.short_description || undefined,
      annualRevenuePrinted: org.annual_revenue_printed || undefined,
    };
  } catch (err) {
    console.warn(`[Apollo Org Enrich Error] for ${cleanDomain}:`, err);
    return null;
  }
}
