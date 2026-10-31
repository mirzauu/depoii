import fs from 'node:fs/promises';

async function summary() {
  const data = JSON.parse(await fs.readFile('data/permits_batch_17.json', 'utf8'));
  for (const b of data) {
    console.log(`\n======================================================`);
    console.log(`[#${b.leadNumber}] ${b.address} | Parcel: ${b.parcelId}`);
    console.log(`Owner: ${b.owner} | Built: ${b.yearBuilt} | Type: ${b.propertyType} | DCAD Last Reroof: ${b.dcadLastReroofDate || 'None'}`);
    console.log(`Total City Permits Found: ${b.permitsCount}`);
    
    const roofs = b.permits.filter(p => 
      p.type.toLowerCase().includes('roof') || 
      p.workDescription.toLowerCase().includes('roof')
    );
    
    console.log(`--- Roofing-Specific Permits (${roofs.length}):`);
    if (roofs.length > 0) {
      roofs.slice(0, 5).forEach(p => {
        console.log(`  * [${p.permitNumber}] Date: ${p.issueDate} | ${p.type} | Val: ${p.valuation} | Cont: ${p.contractor?.slice(0, 30)} | Scope: ${p.workDescription}`);
      });
    } else {
      console.log(`  * (Zero specific re-roof permits on file in open data — check DCAD re-roof note above!)`);
    }

    console.log(`--- Recent Major Commercial/Alteration Permits (Latest 3):`);
    b.permits.slice(0, 3).forEach(p => {
      console.log(`  * [${p.permitNumber}] Date: ${p.issueDate} | ${p.type} | Val: ${p.valuation} | Scope: ${p.workDescription}`);
    });
  }
}

summary().catch(console.error);

