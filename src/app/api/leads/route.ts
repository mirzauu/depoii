import { recordActivity } from "@/lib/activity";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

const STAGES = ["New", "Contacted", "Inspected", "Bid", "Won", "Lost"] as const;

type LeadRow = {
  id: string;
  parcel_id: string;
  storm_id: string;
  address: string;
  city: string;
  stage: string;
  assignee: string;
  notes: string;
  score: number;
  hail: number;
  price: number;
  updated_at: string;
};

function mapLead(row: LeadRow) {
  return {
    id: row.id,
    parcelId: row.parcel_id,
    stormId: row.storm_id,
    address: row.address,
    city: row.city,
    stage: row.stage,
    assignee: row.assignee,
    notes: row.notes,
    score: row.score,
    hail: row.hail,
    price: row.price,
    updatedAt: row.updated_at,
  };
}

const PILOT_ORG_ID = "19b8a9bce1316429";

export async function GET() {
  try {
    const user = await requireUser();
    const db = getDb();
    let rows = db.prepare(`SELECT * FROM leads WHERE org_id = ? ORDER BY updated_at DESC`).all(user.orgId) as LeadRow[];
    // Super-admin (Depoii org) should still see the Dallas pilot book during demos.
    if (user.platformRole === "superadmin" && user.orgId !== PILOT_ORG_ID) {
      const pilot = db.prepare(`SELECT * FROM leads WHERE org_id = ? ORDER BY updated_at DESC`).all(PILOT_ORG_ID) as LeadRow[];
      if (pilot.length && rows.length === 0) rows = pilot;
      else if (pilot.length) {
        const seen = new Set(rows.map((r) => `${r.parcel_id}|${r.storm_id}`));
        for (const row of pilot) {
          const key = `${row.parcel_id}|${row.storm_id}`;
          if (!seen.has(key)) rows.push(row);
        }
      }
    }
    return Response.json(rows.map(mapLead));
  } catch {
    return Response.json({ error: "Sign in required." }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = (await req.json()) as {
      parcelId?: string;
      stormId?: string;
      address?: string;
      city?: string;
      stage?: string;
      assignee?: string;
      notes?: string;
      score?: number;
      hail?: number;
      price?: number;
    };
    if (!body.parcelId) return Response.json({ error: "A lead needs a parcel id." }, { status: 400 });
    const stage = STAGES.includes(body.stage as (typeof STAGES)[number]) ? body.stage! : "New";
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    getDb().prepare(`
      INSERT INTO leads (id, org_id, parcel_id, storm_id, address, city, stage, assignee, notes, score, hail, price, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(org_id, parcel_id, storm_id) DO UPDATE SET
        address = excluded.address, city = excluded.city, stage = excluded.stage, assignee = excluded.assignee,
        notes = excluded.notes, score = excluded.score, hail = excluded.hail, price = excluded.price, updated_at = excluded.updated_at
    `).run(id, user.orgId, body.parcelId, body.stormId || "", body.address || "", body.city || "", stage, body.assignee || user.name, body.notes || "", body.score || 0, body.hail || 0, body.price || 0, now);
    const row = getDb().prepare(`SELECT * FROM leads WHERE org_id = ? AND parcel_id = ? AND storm_id = ?`).get(user.orgId, body.parcelId, body.stormId || "") as LeadRow;
    recordActivity({
      actorId: user.id,
      orgId: user.orgId,
      action: "lead.save",
      targetType: "lead",
      targetId: row.id,
      detail: { parcelId: row.parcel_id, stage: row.stage, address: row.address },
    });
    return Response.json({ ...mapLead(row), promptOutcome: stage === "Inspected" });
  } catch {
    return Response.json({ error: "Sign in required." }, { status: 401 });
  }
}
