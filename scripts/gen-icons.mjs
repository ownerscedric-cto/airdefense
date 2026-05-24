// Generate PWA icons from an inline SVG.
// Run: node scripts/gen-icons.mjs
import { writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, "..", "public");

// Brand mark: "공" (= 공기수비대) on dark background, soft squircle.
function svg({ size, maskable }) {
  const fontSize = Math.round(size * 0.55);
  const radius = maskable ? size * 0.5 : size * 0.22; // maskable → circle so safe area covers
  const padding = maskable ? size * 0.1 : 0;
  const inner = size - padding * 2;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#0b0b0c"/>
  <rect x="${padding}" y="${padding}" width="${inner}" height="${inner}" rx="${radius}" ry="${radius}" fill="#0b0b0c"/>
  <circle cx="${size / 2}" cy="${size / 2}" r="${inner * 0.42}" fill="#1d9e75" opacity="0.18"/>
  <text x="50%" y="52%" text-anchor="middle" dominant-baseline="middle"
        font-family="-apple-system, system-ui, 'Apple SD Gothic Neo', sans-serif"
        font-weight="800" font-size="${fontSize}" fill="#ffffff">공</text>
</svg>`;
}

async function emit(name, size, opts = {}) {
  const buf = Buffer.from(svg({ size, ...opts }));
  const out = resolve(publicDir, name);
  await sharp(buf).png().toFile(out);
  console.log("wrote", out);
}

async function emitSvg(name, content) {
  const out = resolve(publicDir, name);
  await writeFile(out, content);
  console.log("wrote", out);
}

await emit("pwa-192.png", 192);
await emit("pwa-512.png", 512);
await emit("pwa-maskable-512.png", 512, { maskable: true });
await emit("apple-touch-icon.png", 180);
await emitSvg("favicon.svg", svg({ size: 64 }));
