import sharp from "sharp";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { assertWithinRoot } = require("../../../.cursor/skills/shared/safe-fs.cjs");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const iconsDir = path.join(root, "public", "icons");

fs.mkdirSync(iconsDir, { recursive: true });

function svg(size, { maskable = false } = {}) {
  const inner = size * (maskable ? 0.64 : 0.76);
  const cx = size / 2;
  const cy = size / 2;
  const sw = Math.max(size * 0.045, 2.5);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f766e"/>
      <stop offset="100%" stop-color="#115e59"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${size * 0.22}" fill="url(#g)"/>
  <g fill="none" stroke="white" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="${cx}" cy="${cy - inner * 0.12}" r="${inner * 0.16}"/>
    <path d="M ${cx - inner * 0.28} ${cy + inner * 0.32} C ${cx - inner * 0.28} ${cy + inner * 0.08}, ${cx + inner * 0.28} ${cy + inner * 0.08}, ${cx + inner * 0.28} ${cy + inner * 0.32}"/>
  </g>
  <circle cx="${cx + inner * 0.28}" cy="${cy + inner * 0.18}" r="${inner * 0.14}" fill="#99f6e4" stroke="white" stroke-width="${Math.max(size * 0.02, 1.5)}"/>
  <path d="M ${cx + inner * 0.28} ${cy + inner * 0.12} V ${cy + inner * 0.18} L ${cx + inner * 0.34} ${cy + inner * 0.22}" fill="none" stroke="#0f766e" stroke-width="${Math.max(size * 0.025, 1.5)}" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
}

async function writePng(relativePath, size, opts) {
  const filePath = assertWithinRoot(root, relativePath);
  const buf = await sharp(Buffer.from(svg(size, opts))).png().toBuffer();
  fs.writeFileSync(filePath, buf);
  console.log("wrote", path.relative(root, filePath), buf.length);
}

await writePng(path.join("public", "icons", "icon-192.png"), 192);
await writePng(path.join("public", "icons", "icon-512.png"), 512);
await writePng(path.join("public", "icons", "icon-512-maskable.png"), 512, {
  maskable: true,
});
await writePng(path.join("public", "apple-touch-icon.png"), 180);
await writePng(path.join("public", "favicon-32.png"), 32);
await writePng(path.join("public", "icon-192.png"), 192);
await writePng(path.join("public", "favicon.png"), 48);

console.log("done");
