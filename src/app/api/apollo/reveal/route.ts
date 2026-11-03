import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { query, queryOne } from "@/lib/pg";
import { recordActivity } from "@/lib/activity";
import { revealApolloContact } from "@/lib/apollo/client";

export const dynamic = "force-dynamic";

interface RevealedRow {
  id: string;
  apollo_person_id: string;
  org_id: string;
  parcel_id: string | null;
  organization_name: string | null;
  organization_domain: string | null;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  title: string | null;
  linkedin_url: string | null;
  city: string | null;
  state: string | null;
  photo_url: string | null;
  email: string | null;
  email_status: string | null;
  phone: string | null;
  phone_type: string | null;
  credits_spent: number;
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json().catch(() => ({}));

    const {
      personId,
      parcelId,
      organizationName,
      organizationDomain,
      revealPhone = false,
    } = body;

    if (!personId) {
      return NextResponse.json({ error: "Missing personId" }, { status: 400 });
    }

    // 1. Check if contact is ALREADY revealed for this org in our database cache
    const existing = await queryOne<RevealedRow>(
      `select * from app.apollo_revealed_contacts 
       where org_id = $1 and apollo_person_id = $2`,
      [user.orgId, personId]
    );

    // If existing and doesn't require phone or already has phone, return cached (0 credits!)
    if (existing && (!revealPhone || existing.phone)) {
      return NextResponse.json({
        success: true,
        cached: true,
        creditsConsumed: 0,
        contact: {
          personId: existing.apollo_person_id,
          fullName: existing.full_name,
          firstName: existing.first_name,
          lastName: existing.last_name,
          title: existing.title,
          linkedinUrl: existing.linkedin_url,
          email: existing.email,
          emailStatus: existing.email_status,
          phone: existing.phone,
          phoneType: existing.phone_type,
          city: existing.city,
          state: existing.state,
          photoUrl: existing.photo_url,
        },
      });
    }

    // 2. Not cached: Call Apollo to enrich & reveal contact
    const revealed = await revealApolloContact({
      personId,
      revealPhone: Boolean(revealPhone),
    });

    // 3. Save into app.apollo_revealed_contacts table for org-wide caching
    const saved = await queryOne<RevealedRow>(
      `insert into app.apollo_revealed_contacts (
        apollo_person_id,
        org_id,
        parcel_id,
        organization_name,
        organization_domain,
        full_name,
        first_name,
        last_name,
        title,
        linkedin_url,
        email,
        email_status,
        phone,
        phone_type,
        credits_spent,
        revealed_by_user_id
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      on conflict (org_id, apollo_person_id) do update set
        email = coalesce(excluded.email, app.apollo_revealed_contacts.email),
        email_status = coalesce(excluded.email_status, app.apollo_revealed_contacts.email_status),
        phone = coalesce(excluded.phone, app.apollo_revealed_contacts.phone),
        phone_type = coalesce(excluded.phone_type, app.apollo_revealed_contacts.phone_type),
        credits_spent = app.apollo_revealed_contacts.credits_spent + excluded.credits_spent,
        updated_at = now()
      returning *`,
      [
        revealed.personId,
        user.orgId,
        parcelId || null,
        organizationName || null,
        organizationDomain || null,
        revealed.fullName,
        revealed.firstName || null,
        revealed.lastName || null,
        revealed.title || null,
        revealed.linkedinUrl || null,
        revealed.email || null,
        revealed.emailStatus || null,
        revealed.phone || null,
        revealed.phoneType || null,
        revealed.creditsSpent,
        user.id,
      ]
    );

    // Record activity audit log if available
    try {
      await recordActivity({
        actorId: user.id,
        orgId: user.orgId,
        action: "apollo_contact_revealed",
        targetId: revealed.personId,
        targetType: "contact",
        detail: {
          fullName: revealed.fullName,
          title: revealed.title,
          parcelId,
          creditsSpent: revealed.creditsSpent,
          hasEmail: Boolean(revealed.email),
          hasPhone: Boolean(revealed.phone),
        },
      });
    } catch {
      // Activity logging is non-blocking
    }

    return NextResponse.json({
      success: true,
      cached: false,
      creditsConsumed: revealed.creditsSpent,
      contact: {
        personId: saved?.apollo_person_id || revealed.personId,
        fullName: saved?.full_name || revealed.fullName,
        firstName: saved?.first_name || revealed.firstName,
        lastName: saved?.last_name || revealed.lastName,
        title: saved?.title || revealed.title,
        linkedinUrl: saved?.linkedin_url || revealed.linkedinUrl,
        email: saved?.email || revealed.email,
        emailStatus: saved?.email_status || revealed.emailStatus,
        phone: saved?.phone || revealed.phone,
        phoneType: saved?.phone_type || revealed.phoneType,
      },
    });
  } catch (error: any) {
    console.error("[Apollo Reveal Error]:", error);
    const status = error.status || 500;
    return NextResponse.json(
      { error: error.message || "Failed to reveal Apollo contact details." },
      { status: status === 401 ? 401 : status === 402 ? 402 : 500 }
    );
  }
}
