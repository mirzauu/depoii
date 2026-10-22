/** Customer reads. A new account uses this same filter. Unreleased rows never pass. */

export { RELEASED_PARCEL_IDS } from "./released-parcels";
import { RELEASED_PARCEL_IDS } from "./released-parcels";

const MAX_HAIL_MILES = 15;

type Row = Record<string, unknown>;

export function normalizeParcelId(value: unknown) {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw) return "";
  const match = raw.match(/(?:DCAD|TAD)-PARCEL-(.+)$/);
  return match ? match[1] : raw;
}

function cityOf(row: Row) {
  return String(row.city || "").trim().toLowerCase();
}

function milesOf(row: Row) {
  const value = row.hail_distance_mi ?? row.nearest_hail_distance_mi ?? row.hailDistance;
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() && !Number.isNaN(Number(value))) return Number(value);
  return null;
}

const RELEASED_NORMALIZED = new Set([...RELEASED_PARCEL_IDS].map(normalizeParcelId));

export function keepCustomerLead(row: Row) {
  const id = normalizeParcelId(row.parcel_id ?? row.parcelId);
  if (!id || !RELEASED_NORMALIZED.has(id)) return false;
  const city = cityOf(row);
  if (city && city !== "dallas" && city !== "fort worth") return false;
  const miles = milesOf(row);
  if (miles != null && miles > MAX_HAIL_MILES) return false;
  return true;
}

export function filterCustomerPayload(body: unknown) {
  if (!body || typeof body !== "object") return body;
  const row = body as Row;
  const next = { ...row };
  let changed = false;
  if (Array.isArray(row.leads)) {
    const leads = row.leads.filter((item) => keepCustomerLead(item as Row));
    next.leads = leads;
    next.total_matching = leads.length;
    changed = true;
  }
  if (Array.isArray(row.opportunities)) {
    const opportunities = row.opportunities.filter((item) => keepCustomerLead(item as Row));
    next.opportunities = opportunities;
    next.total_opportunities = opportunities.length;
    changed = true;
  }
  return changed ? next : body;
}
