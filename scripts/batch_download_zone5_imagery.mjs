import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const TIMELINE_YEARS = [
  { year: "2020", releaseId: "18289" },
  { year: "2021", releaseId: "8432" },
  { year: "2022", releaseId: "4905" },
  { year: "2023", releaseId: "47963" },
  { year: "2024", releaseId: "39767" },
];

function latLonToTileZXY(lat, lon, zoom = 19) {
  const x = Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
  const y = Math.floor(
    ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) *
      Math.pow(2, zoom)
  );
  return { z: zoom, x, y };
}

function getWaybackTileUrl(releaseId, z, y, x) {
  return `https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/WMTS/1.0.0/default028mm/MapServer/tile/${releaseId}/${z}/${y}/${x}`;
}

async function runBatch() {
  console.log('--- Depoii Zone 5 Aerial Timeline Batch Worker ---');
  
  // Zone 5 ZIP codes as defined in supabase migration
  const zone5Zips = ['75234', '75251', '75266', '75001', '75209'];
  
  console.log(`Querying Zone 5 parcels for ZIPs: ${zone5Zips.join(', ')}...`);
  
  const query = `
    SELECT id, address, city, zip_code, latitude, longitude
    FROM warehouse.parcels
    WHERE zip_code = ANY($1) 
      AND latitude IS NOT NULL 
      AND longitude IS NOT NULL
    ORDER BY total_valuation DESC NULLS LAST
  `;
  
  const { rows } = await pool.query(query, [zone5Zips]);
  console.log(`Found ${rows.length} parcels with coordinates in Zone 5.`);

  const outputBase = path.resolve('public/aerial_cache');
  if (!fs.existsSync(outputBase)) {
    fs.mkdirSync(outputBase, { recursive: true });
  }

  let totalDownloaded = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  // Concurrency queue
  const CONCURRENCY = 8;
  const queue = [...rows];
  let activeWorkers = 0;

  const processParcel = async (parcel) => {
    const parcelDir = path.join(outputBase, parcel.id);
    if (!fs.existsSync(parcelDir)) {
      fs.mkdirSync(parcelDir, { recursive: true });
    }

    const { z, x, y } = latLonToTileZXY(parcel.latitude, parcel.longitude, 19);

    for (const item of TIMELINE_YEARS) {
      const filePath = path.join(parcelDir, `${item.year}.jpg`);
      if (fs.existsSync(filePath) && fs.statSync(filePath).size > 1000) {
        totalSkipped++;
        continue;
      }

      const url = getWaybackTileUrl(item.releaseId, z, y, x);
      try {
        const res = await fetch(url);
        if (res.ok) {
          const buffer = Buffer.from(await res.arrayBuffer());
          fs.writeFileSync(filePath, buffer);
          totalDownloaded++;
        } else {
          totalFailed++;
        }
      } catch (err) {
        totalFailed++;
      }
    }
  };

  return new Promise((resolve) => {
    let index = 0;
    const next = () => {
      if (index >= queue.length && activeWorkers === 0) {
        return resolve({ total: rows.length, totalDownloaded, totalSkipped, totalFailed });
      }

      while (activeWorkers < CONCURRENCY && index < queue.length) {
        const item = queue[index++];
        activeWorkers++;
        processParcel(item).finally(() => {
          activeWorkers--;
          if (index % 25 === 0 || index === queue.length) {
            process.stdout.write(`\rProgress: ${index}/${queue.length} parcels processed (${totalDownloaded} downloaded, ${totalSkipped} cached)...`);
          }
          next();
        });
      }
    };
    next();
  }).then(async (stats) => {
    console.log('\n\n--- Batch Download Completed ---');
    console.log(`Parcels Processed: ${stats.total}`);
    console.log(`Images Downloaded: ${stats.totalDownloaded}`);
    console.log(`Images Existing (Skipped): ${stats.totalSkipped}`);
    console.log(`Failed Requests: ${stats.totalFailed}`);

    // Write manifest
    fs.writeFileSync(
      path.join(outputBase, 'manifest.json'),
      JSON.stringify({
        zone: "Dallas Zone 5",
        parcelsCount: stats.total,
        updatedAt: new Date().toISOString(),
        years: TIMELINE_YEARS.map(y => y.year)
      }, null, 2)
    );

    await pool.end();
  });
}

runBatch().catch(async (e) => {
  console.error('Fatal batch error:', e);
  await pool.end();
});

