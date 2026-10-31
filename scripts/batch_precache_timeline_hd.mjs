import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const CACHE_DIR = path.join(process.cwd(), "public", "aerial_cache");

const TIMELINE_RELEASES = {
  "2020": "18289",
  "2021": "8432",
  "2022": "4905",
  "2023": "47963",
  "2024": "39767",
};

function latLonToTileFraction(lat, lon, zoom = 19) {
  const x = ((lon + 180) / 360) * Math.pow(2, zoom);
  const y =
    ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) *
    Math.pow(2, zoom);
  return {
    ix: Math.floor(x),
    iy: Math.floor(y),
    fx: x - Math.floor(x),
    fy: y - Math.floor(y),
  };
}

async function fetchTile(releaseId, z, y, x) {
  const url = `https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/WMTS/1.0.0/default028mm/MapServer/tile/${releaseId}/${z}/${y}/${x}`;
  const res = await fetch(url, { headers: { "User-Agent": "Depoii/1.0" }, signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function renderPrecisionStitched(lat, lng, year, width = 800, height = 600) {
  const releaseId = TIMELINE_RELEASES[year];
  const zoom = 19;
  const { ix, iy, fx, fy } = latLonToTileFraction(lat, lng, zoom);

  const compositeList = [];
  const fetches = [];

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const tileX = ix + dx;
      const tileY = iy + dy;
      const left = (dx + 1) * 256;
      const top = (dy + 1) * 256;

      fetches.push(
        fetchTile(releaseId, zoom, tileY, tileX)
          .then((buf) => {
            compositeList.push({ input: buf, left, top });
          })
          .catch(() => {})
      );
    }
  }

  await Promise.all(fetches);

  const centerPixelX = Math.round(256 + fx * 256);
  const centerPixelY = Math.round(256 + fy * 256);

  const targetW = Math.min(width, 768);
  const targetH = Math.min(height, 768);

  let cropLeft = Math.max(0, centerPixelX - Math.floor(targetW / 2));
  let cropTop = Math.max(0, centerPixelY - Math.floor(targetH / 2));

  if (cropLeft + targetW > 768) cropLeft = 768 - targetW;
  if (cropTop + targetH > 768) cropTop = 768 - targetH;
  if (cropLeft < 0) cropLeft = 0;
  if (cropTop < 0) cropTop = 0;

  return await sharp({
    create: {
      width: 768,
      height: 768,
      channels: 3,
      background: { r: 30, g: 30, b: 30 },
    },
  })
    .composite(compositeList)
    .extract({
      left: cropLeft,
      top: cropTop,
      width: targetW,
      height: targetH,
    })
    .resize(width, height, {
      fit: "fill",
      kernel: sharp.kernel.lanczos3,
    })
    .modulate({
      brightness: 0.94,
      saturation: 1.10,
    })
    .linear(1.08, -10)
    .sharpen({
      sigma: 0.85,
      m1: 1.0,
      m2: 1.8,
    })
    .jpeg({
      quality: 95,
      chromaSubsampling: "4:4:4",
    })
    .toBuffer();
}

async function main() {
  const zone5Zips = ['75234', '75251', '75266', '75001', '75209'];
  console.log(`Querying Zone 5 qualified leads for precision timeline pre-caching...`);

  const { rows } = await pool.query(`
    SELECT DISTINCT ON (s.parcel_id)
      s.parcel_id as id, p.latitude, p.longitude, p.address
    FROM warehouse.scored_parcel_leads s
    JOIN warehouse.parcels p ON s.parcel_id = p.id
    WHERE p.zip_code = ANY($1::text[])
      AND p.latitude IS NOT NULL
      AND p.longitude IS NOT NULL
  `, [zone5Zips]);

  console.log(`Found ${rows.length} qualified leads in Zone 5. Starting background pre-cache...`);

  let count = 0;
  const CONCURRENCY = 4;

  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const chunk = rows.slice(i, i + CONCURRENCY);
    await Promise.all(
      chunk.map(async (row) => {
        const parcelId = row.id;
        const lat = parseFloat(row.latitude);
        const lng = parseFloat(row.longitude);
        if (!lat || !lng) return;

        const outDir = path.join(CACHE_DIR, parcelId);
        await fs.mkdir(outDir, { recursive: true });

        for (const yr of ["2020", "2021", "2022", "2023", "2024"]) {
          const targetFile = path.join(outDir, `hd_opt_${yr}.jpg`);
          try {
            const stat = await fs.stat(targetFile);
            if (stat.size > 20000) continue; // Already generated with Option 1 enhancement
          } catch {}

          try {
            const buf = await renderPrecisionStitched(lat, lng, yr);
            await fs.writeFile(targetFile, buf);
          } catch {}
        }

        // For 2024, ensure hd_latest.png (uncompressed master export) exists
        const latestFile = path.join(outDir, `hd_latest.png`);
        try {
          const stat = await fs.stat(latestFile);
          if (stat.size < 20000) throw new Error("Need fetch");
        } catch {
          try {
            const delta = 0.0016;
            const minx = lng - delta;
            const maxx = lng + delta;
            const miny = lat - delta * 0.75;
            const maxy = lat + delta * 0.75;
            const esriUrl = `https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${minx},${miny},${maxx},${maxy}&bboxSR=4326&size=800,600&f=image`;
            const res = await fetch(esriUrl, {
              headers: { "User-Agent": "Depoii/1.0" },
              signal: AbortSignal.timeout(8000),
            });
            if (res.ok) {
              const buf = Buffer.from(await res.arrayBuffer());
              await fs.writeFile(latestFile, buf);
            }
          } catch {}
        }
        count++;
        if (count % 25 === 0 || count === rows.length) {
          console.log(`Pre-cached ${count}/${rows.length} leads (${((count / rows.length) * 100).toFixed(1)}%)`);
        }
      })
    );
  }

  console.log("Timeline precision pre-caching finished successfully!");
  await pool.end();
}

main().catch((err) => {
  console.error("Pre-cache error:", err);
  pool.end();
});
