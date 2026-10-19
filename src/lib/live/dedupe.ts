import type { Permit, PermitContact } from "@/lib/types";

function richness(p: Permit) {
  return (p.address ? 8 : 0) + Math.min(p.scope.length, 80) + (p.valuation ? 40 : 0) + (p.contractorId ? 20 : 0) + (p.contacts?.length ? p.contacts.length * 25 : 0);
}

function mergeContacts(a?: PermitContact[], b?: PermitContact[]): PermitContact[] | undefined {
  if (!a && !b) return undefined;
  if (!a) return b;
  if (!b) return a;
  const map = new Map<string, PermitContact>();
  for (const c of [...a, ...b]) {
    map.set(c.id, c);
  }
  return [...map.values()];
}

/** The permit layer repeats a permit number once per related record. Keep one row, the one with more of the filing filled in. */
export function dedupePermits(rows: Permit[]): Permit[] {
  const byNo = new Map<string, Permit>();
  for (const row of rows) {
    const key = `${row.market}:${row.permitNo}`;
    const prev = byNo.get(key);
    if (!prev) {
      byNo.set(key, row);
    } else if (richness(row) > richness(prev)) {
      row.contacts = mergeContacts(prev.contacts, row.contacts);
      byNo.set(key, row);
    } else {
      prev.contacts = mergeContacts(prev.contacts, row.contacts);
    }
  }
  return [...byNo.values()];
}
