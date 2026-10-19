import fs from "node:fs";
import path from "node:path";

const root = path.resolve("src");
const seen = new Set();
const queue = ["components/landing-page.tsx"];
const files = [];

function resolve(spec) {
  if (!spec.startsWith("@/")) return null;
  const rel = spec.slice(2);
  for (const ext of [".tsx", ".ts", ".jsx", ".js", ""]) {
    const p = path.join(root, rel + ext);
    if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
  }
  for (const idx of ["index.ts", "index.tsx"]) {
    const p = path.join(root, rel, idx);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

while (queue.length) {
  const rel = queue.pop();
  if (seen.has(rel)) continue;
  seen.add(rel);
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) continue;
  files.push(rel.replaceAll("\\", "/"));
  const text = fs.readFileSync(abs, "utf8");
  const re = /from\s+["'](@\/[^"']+)["']/g;
  let m;
  while ((m = re.exec(text))) {
    const resolved = resolve(m[1]);
    if (resolved) {
      const r = path.relative(root, resolved).replaceAll("\\", "/");
      if (!seen.has(r)) queue.push(r);
    }
  }
}

files.sort();
console.log(files.join("\n"));
console.log("COUNT", files.length);
