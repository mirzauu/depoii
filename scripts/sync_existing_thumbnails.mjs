import fs from 'node:fs';
import path from 'node:path';

const thumbDir = path.resolve('Roofx/thumbnails');
const cacheDir = path.resolve('public/aerial_cache');

const files = fs.readdirSync(thumbDir).filter(f => f.startsWith('thumb_') && f.endsWith('.png'));
console.log(`Found ${files.length} existing high-res thumbnails in Roofx/thumbnails.`);

let synced = 0;
for (const file of files) {
  const parcelId = file.replace(/^thumb_/, '').replace(/\.png$/, '');
  const targetDir = path.join(cacheDir, parcelId);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  const destPath = path.join(targetDir, 'hd_latest.png');
  const srcPath = path.join(thumbDir, file);
  fs.copyFileSync(srcPath, destPath);
  synced++;
}

console.log(`Successfully synced ${synced} HD images to public/aerial_cache/<parcelId>/hd_latest.png`);

