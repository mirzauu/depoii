import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'node:fs/promises';
dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

function parseDate(dStr) {
  if (!dStr) return null;
  dStr = String(dStr).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(dStr)) return dStr;
  const match = dStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (match) {
    let [_, m, d, y] = match;
    m = m.padStart(2, '0');
    d = d.padStart(2, '0');
    if (y.length === 2) {
      const yrNum = parseInt(y, 10);
      y = yrNum > 50 ? `19${y}` : `20${y}`;
    }
    return `${y}-${m}-${d}`;
  }
  const dt = new Date(dStr);
  if (!isNaN(dt.getTime())) {
    return dt.toISOString().slice(0, 10);
  }
  return null;
}

function parseValuation(valStr) {
  if (!valStr || valStr === 'N/A') return { num: null, formatted: null };
  const cleaned = String(valStr).replace(/[^0-9.]/g, '');
  const num = parseFloat(cleaned);
  if (isNaN(num)) return { num: null, formatted: null };
  return { num, formatted: `$${num.toLocaleString()}` };
}

async function testSample() {
  const data = JSON.parse(await fs.readFile('data/zone5_all_permits_audit.json', 'utf8'));
  const manana = data.find(d => d.address && d.address.includes('MANANA'));
  console.log('Testing ingestion for Manana:', manana.address, 'Permits:', manana.permits.length);

  for (const p of manana.permits) {
    const issueDate = parseDate(p.issueDate);
    const { num: valNum, formatted: valFmt } = parseValuation(p.valuation);
    const isAddison = manana.zip === '75001' || manana.parcelId.startsWith('DCAD-PARCEL-1000');
    const sourceSystem = isAddison ? 'Town of Addison EnerGov CSS' : 'City of Dallas Open Data (Socrata e7gq-4sah)';
    const sourceUrl = isAddison 
      ? 'https://developmentservices.addisontx.gov/' 
      : `https://www.dallasopendata.com/resource/e7gq-4sah.json?permit_number=${encodeURIComponent(p.permitNumber)}`;

    console.log(`Permit: ${p.permitNumber} | Date: ${issueDate} | Val: ${valFmt} | Source: ${sourceSystem}`);
  }

  await pool.end();
}

testSample().catch(console.error);

