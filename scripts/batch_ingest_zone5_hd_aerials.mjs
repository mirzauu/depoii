import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const DELTA = 0.0016; // ~180m bounding box

function getBoundingBox(lat, lng) {
  const minx = lng - DELTA;
  const maxx = lng + DELTA;
  const miny = lat - DELTA * 0.75;
  const maxy = lat + DELTA * 0.75;
  return { minx, miny, maxx, maxy };
}

function getExportUrl(bbox) {
  return `https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${bbox.minx},${bbox.miny},${bbox.maxx},${bbox.maxy}&bboxSR=4326&size=800,600&f=image`;
}

async function runHdBatch() {
  console.log('=== Depoii Dallas Zone 5 HD Aerial Batch Ingestor ===');

  // Zone 5 ZIP codes
  const zone5Zips = ['75234', '75251', '75266', '75001', '75209'];

  console.log(`Querying Zone 5 leads with coordinates for ZIPs: ${zone5Zips.join(', ')}...`);

  const { rows } = await pool.query(`
    SELECT DISTINCT ON (p.id)
      p.id, p.address, p.city, p.zip_code, p.latitude, p.longitude, p.total_valuation
    FROM warehouse.parcels p
    WHERE p.zip_code = ANY($1)
      AND p.latitude IS NOT NULL
      AND p.longitude IS NOT NULL
      AND p.latitude != 0
      AND p.longitude != 0
    ORDER BY p.id, p.total_valuation DESC NULLS LAST
  `, [zone5Zips]);

  console.log(`Targeting ${rows.length} commercial properties in Dallas Zone 5.`);

  const publicDir = path.resolve('public/aerial_cache');
  const thumbDir = path.resolve('Roofx/thumbnails');

  if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
  if (!fs.existsSync(thumbDir)) fs.mkdirSync(thumbDir, { recursive: true });

  let downloadedCount = 0;
  let cachedCount = 0;
  let errorCount = 0;

  const CONCURRENCY = 8;
  const queue = [...rows];
  let activeWorkers = 0;

  const processLead = async (lead) => {
    const parcelDir = path.join(publicDir, lead.id);
    if (!fs.existsSync(parcelDir)) fs.mkdirSync(parcelDir, { recursive: true });

    const publicHdPath = path.join(parcelDir, 'hd_latest.png');
    const thumbPath = path.join(thumbDir, `thumb_${lead.id}.png`);

    // Check if already cached with valid size (> 20KB)
    if (fs.existsSync(publicHdPath) && fs.statSync(publicHdPath).size > 20000) {
      cachedCount++;
      return;
    }

    const lat = Number(lead.latitude);
    const lng = Number(lead.longitude);
    const bbox = getBoundingBox(lat, lng);
    const url = getExportUrl(bbox);

    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 Depoii-HD-Ingestor/1.0' },
        signal: AbortSignal.timeout(10000)
      });

      if (res.ok) {
        const buffer = Buffer.from(await res.arrayBuffer());
        if (buffer.length > 5000) {
          fs.writeFileSync(publicHdPath, buffer);
          try {
            fs.writeFileSync(thumbPath, buffer);
          } catch {}
          downloadedCount++;
        } else {
          errorCount++;
        }
      } else {
        errorCount++;
      }
    } catch (e) {
      errorCount++;
    }
  };

  return new Promise((resolve) => {
    let index = 0;
    const next = () => {
      if (index >= queue.length && activeWorkers === 0) {
        return resolve({ total: rows.length, downloadedCount, cachedCount, errorCount });
      }

      while (activeWorkers < CONCURRENCY && index < queue.length) {
        const item = queue[index++];
        activeWorkers++;
        processLead(item).finally(() => {
          activeWorkers--;
          if (index % 25 === 0 || index === queue.length) {
            process.stdout.write(`\rProgress: ${index}/${queue.length} processed (${downloadedCount} HD images captured, ${cachedCount} already cached)...`);
          }
          next();
        });
      }
    };
    next();
  }).then(async (stats) => {
    console.log('\n\n=== HD Ingestion Complete ===');
    console.log(`Total Leads Processed: ${stats.total}`);
    console.log(`HD Images Downloaded (800x600 Maxar): ${stats.downloadedCount}`);
    console.log(`Already Cached: ${stats.cachedCount}`);
    console.log(`Failed/Timeout: ${stats.errorCount}`);

    // Update database scored_parcel_leads with aerial_snapshot_url
    console.log('\nSyncing aerial_snapshot_url in database...');
    try {
      const updateResult = await pool.query(`
        UPDATE warehouse.scored_parcel_leads s
        SET aerial_snapshot_url = '/aerial_cache/' || s.parcel_id || '/hd_latest.png'
        WHERE s.zip_code = ANY($1)
      `, [zone5Zips]);
      console.log(`Updated ${updateResult.rowCount} rows in warehouse.scored_parcel_leads.`);
    } catch (err) {
      console.warn('Could not update scored_parcel_leads:', err.message);
    }

    // Write manifest
    fs.writeFileSync(
      path.join(publicDir, 'zone5_hd_manifest.json'),
      JSON.stringify({
        title: "Dallas Zone 5 Maxar HD Rooftop Dataset",
        resolution: "0.34m (800x600)",
        engine: "Maxar Vivid Premium via Esri Dynamic Export",
        boundingBoxDelta: DELTA,
        totalLeads: stats.total,
        completedAt: new Date().toISOString(),
        zips: zone5Zips
      }, null, 2)
    );

    await pool.end();
  });
}

runHdBatch().catch(async (e) => {
  console.error('Fatal batch error:', e);
  await pool.end();
});

