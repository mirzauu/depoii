import fs from 'node:fs/promises';
import path from 'node:path';

const BATCH_SIZE = 5;
const BATCH_NUM = 21; // Batch 21 (Buildings 101 - 105)

async function fetchCityPermitsForAddress(streetNumber, streetName) {
  try {
    const q = `${streetNumber} ${streetName}`;
    const url = `https://www.dallasopendata.com/resource/e7gq-4sah.json?$q=${encodeURIComponent(q)}&$limit=200&$order=issued_date%20DESC`;
    const res = await fetch(url, { headers: { 'User-Agent': 'DepoiiAudit/1.0' } });
    if (!res.ok) return [];
    const list = await res.json();
    if (!Array.isArray(list)) return [];

    return list.filter(p => {
      const addr = (p.street_address || '').toUpperCase().trim();
      return addr.startsWith(streetNumber.toUpperCase() + ' ');
    });
  } catch (err) {
    console.error(`Error querying Dallas API for ${streetNumber} ${streetName}:`, err.message);
    return [];
  }
}

async function main() {
  const remaining = JSON.parse(await fs.readFile('data/remaining_40_leads.json', 'utf8'));
  const batchOffset = (BATCH_NUM - 14) * BATCH_SIZE;
  const batchLeads = remaining.slice(batchOffset, batchOffset + BATCH_SIZE);

  console.log(`Processing Batch ${BATCH_NUM} (${batchLeads.length} buildings, global # ${65 + batchOffset + 1} to ${65 + batchOffset + batchLeads.length}):\n`);

  const results = [];

  for (let i = 0; i < batchLeads.length; i++) {
    const lead = batchLeads[i];
    const match = lead.address.match(/^(\d+)\s+(.+)$/);
    const streetNumber = match ? match[1] : '';
    const fullStreet = match ? match[2] : lead.address;
    const streetRoot = fullStreet.split(/\s+/)[0];

    console.log(`[${i + 1}/${batchLeads.length}] Querying permits for: ${lead.address} (${lead.parcel_id})...`);

    const cityPermits = await fetchCityPermitsForAddress(streetNumber, streetRoot);
    console.log(`  -> Found ${cityPermits.length} municipal permit record(s) in city feeds.`);

    results.push({
      leadNumber: 65 + batchOffset + i + 1,
      parcelId: lead.parcel_id,
      address: lead.address,
      zip: lead.zip_code,
      owner: lead.owner_name,
      propertyType: lead.property_type,
      yearBuilt: lead.year_built,
      valuation: lead.cad_total_valuation,
      dcadLastReroofDate: lead.last_reroof_date,
      dcadLastReroofPermitNo: lead.last_reroof_permit_no,
      permitsCount: cityPermits.length,
      permits: cityPermits.map(p => ({
        permitNumber: p.permit_number,
        issueDate: p.issued_date,
        type: p.permit_type,
        valuation: p.value ? `$${Number(p.value).toLocaleString()}` : 'N/A',
        contractor: p.contractor || 'Owner / Not Listed',
        workDescription: p.work_description || 'N/A',
        landUse: p.land_use || 'Commercial'
      }))
    });
  }

  const outFile = path.join('data', `permits_batch_${BATCH_NUM}.json`);
  await fs.writeFile(outFile, JSON.stringify(results, null, 2));
  console.log(`\nBatch ${BATCH_NUM} results saved to: ${outFile}`);
}

main().catch(console.error);

