import fs from 'node:fs/promises';
import path from 'node:path';

async function mergeAll() {
  const allBuildings = [];
  let totalPermits = 0;
  let buildingsWithRoofPermits = 0;

  for (let b = 1; b <= 21; b++) {
    const filePath = path.join('data', `permits_batch_${b}.json`);
    try {
      const data = JSON.parse(await fs.readFile(filePath, 'utf8'));
      for (const item of data) {
        allBuildings.push(item);
        totalPermits += item.permitsCount;
        const hasRoof = item.permits.some(p => 
          (p.type || '').toLowerCase().includes('roof') || 
          (p.workDescription || '').toLowerCase().includes('roof')
        );
        if (hasRoof) buildingsWithRoofPermits++;
      }
    } catch (e) {
      console.warn(`Could not read batch ${b}:`, e.message);
    }
  }

  const masterPath = path.join('data', 'zone5_all_permits_audit.json');
  await fs.writeFile(masterPath, JSON.stringify(allBuildings, null, 2));

  console.log(`\n======================================================`);
  console.log(`MASTER AUDIT COMPLETE:`);
  console.log(`Total Buildings Audited: ${allBuildings.length}`);
  console.log(`Total Municipal Permits Harvested: ${totalPermits}`);
  console.log(`Buildings with Explicit Commercial Re-Roof / Repair Records: ${buildingsWithRoofPermits}`);
  console.log(`Buildings with Zero Re-Roof History (Prime Virgin Roofs): ${allBuildings.length - buildingsWithRoofPermits}`);
  console.log(`Master file written to: ${masterPath}`);
  console.log(`======================================================\n`);
}

mergeAll().catch(console.error);

