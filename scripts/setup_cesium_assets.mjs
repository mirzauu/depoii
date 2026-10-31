import fs from 'node:fs';
import path from 'node:path';

const srcDir = path.resolve('node_modules/cesium/Build/Cesium');
const destDir = path.resolve('public/cesium');

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

const folders = ['Assets', 'Widgets', 'Workers', 'ThirdParty'];
for (const folder of folders) {
  const src = path.join(srcDir, folder);
  const dest = path.join(destDir, folder);
  if (fs.existsSync(src)) {
    console.log(`Copying ${folder}...`);
    fs.cpSync(src, dest, { recursive: true });
  }
}

console.log('Cesium assets successfully copied to public/cesium');

