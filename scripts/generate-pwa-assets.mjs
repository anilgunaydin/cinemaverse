import sharp from "sharp";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const iconsDir = path.join(root, "public", "icons");
const shotsDir = path.join(root, "public", "screenshots");

fs.mkdirSync(iconsDir, { recursive: true });
fs.mkdirSync(shotsDir, { recursive: true });

const BG = { r: 15, g: 15, b: 18, alpha: 1 };
const GOLD = "#d4a94f";

/* Maskable icon: logo safe-zone (80%) icinde, tam arka plan */
const maskableSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0f0f12"/>
  <g transform="translate(256,256) scale(0.72)">
    <rect x="-120" y="-80" width="240" height="160" rx="12" fill="none" stroke="${GOLD}" stroke-width="10"/>
    <rect x="-106" y="-66" width="212" height="132" rx="6" fill="none" stroke="${GOLD}" stroke-width="3" opacity="0.5"/>
    <circle cx="-92" cy="0" r="13" fill="${GOLD}"/>
    <circle cx="92" cy="0" r="13" fill="${GOLD}"/>
    <polygon points="-18,-34 40,0 -18,34" fill="${GOLD}"/>
  </g>
</svg>`;

const maskablePath = path.join(iconsDir, "maskable.svg");
fs.writeFileSync(maskablePath, maskableSvg);

for (const size of [192, 512]) {
  await sharp(maskablePath)
    .resize(size, size, { fit: "contain", background: BG })
    .png()
    .toFile(path.join(iconsDir, `maskable-${size}.png`));
  console.log(`Generated: maskable-${size}.png`);
}

/* Splash screen: logo + marka adi */
const splashSvg = (w, h) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="#0f0f12"/>
  <g transform="translate(${w / 2}, ${h / 2 - h * 0.06}) scale(${Math.min(w, h) / 900})">
    <rect x="-120" y="-80" width="240" height="160" rx="12" fill="none" stroke="${GOLD}" stroke-width="9"/>
    <circle cx="-92" cy="0" r="12" fill="${GOLD}"/>
    <circle cx="92" cy="0" r="12" fill="${GOLD}"/>
    <polygon points="-18,-32 38,0 -18,32" fill="${GOLD}"/>
  </g>
  <text x="${w / 2}" y="${h / 2 + h * 0.13}" text-anchor="middle"
        font-family="Georgia, serif" font-size="${Math.round(Math.min(w, h) * 0.075)}"
        fill="#f5f5f7" letter-spacing="2">CinemaVerse</text>
  <text x="${w / 2}" y="${h / 2 + h * 0.19}" text-anchor="middle"
        font-family="Arial, sans-serif" font-size="${Math.round(Math.min(w, h) * 0.032)}"
        fill="${GOLD}" letter-spacing="6" opacity="0.85">KİŞİSEL SİNEMA HAFIZASI</text>
</svg>`;

const splashes = [
  { name: "splash-640x1136.png", w: 640, h: 1136 },
  { name: "splash-750x1334.png", w: 750, h: 1334 },
  { name: "splash-1242x2688.png", w: 1242, h: 2688 },
  { name: "splash-1920x1080.png", w: 1920, h: 1080 },
];

for (const s of splashes) {
  const svgPath = path.join(iconsDir, `${s.name}.svg`);
  fs.writeFileSync(svgPath, splashSvg(s.w, s.h));
  await sharp(svgPath).png().toFile(path.join(iconsDir, s.name));
  fs.unlinkSync(svgPath);
  console.log(`Generated: ${s.name}`);
}

/* Manifest screenshots: uygulama icerigi temsili */
const shotWide = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720">
  <rect width="1280" height="720" fill="#0f0f12"/>
  <rect x="0" y="0" width="1280" height="64" fill="#15151a"/>
  <text x="40" y="42" font-family="Georgia, serif" font-size="26" fill="${GOLD}">CinemaVerse</text>
  <text x="760" y="40" font-family="Arial" font-size="16" fill="#8b8b96">Keşfet</text>
  <text x="850" y="40" font-family="Arial" font-size="16" fill="#8b8b96">Kütüphanem</text>
  <text x="960" y="40" font-family="Arial" font-size="16" fill="#8b8b96">Öneriler</text>
  <text x="1060" y="40" font-family="Arial" font-size="16" fill="#8b8b96">Topluluk</text>
  <text x="40" y="130" font-family="Georgia, serif" font-size="38" fill="#f5f5f7">Keşfet</text>
  <text x="40" y="164" font-family="Arial" font-size="17" fill="#8b8b96">Yeni yapımları keşfedin, izlediklerinizi hatırlayın</text>
  ${Array.from({ length: 12 })
    .map((_, i) => {
      const x = 40 + (i % 6) * 200;
      const y = 210 + Math.floor(i / 6) * 180;
      return `<rect x="${x}" y="${y}" width="184" height="104" rx="8" fill="#1e1e25"/>
              <rect x="${x}" y="${y + 112}" width="120" height="10" rx="4" fill="#2a2a33"/>
              <rect x="${x}" y="${y + 130}" width="60" height="8" rx="4" fill="#232330"/>`;
    })
    .join("")}
</svg>`;

const shotNarrow = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 1280">
  <rect width="720" height="1280" fill="#0f0f12"/>
  <rect x="0" y="0" width="720" height="64" fill="#15151a"/>
  <text x="28" y="42" font-family="Georgia, serif" font-size="24" fill="${GOLD}">CinemaVerse</text>
  <text x="28" y="130" font-family="Georgia, serif" font-size="34" fill="#f5f5f7">Kütüphanem</text>
  ${Array.from({ length: 8 })
    .map((_, i) => {
      const y = 180 + i * 130;
      return `<rect x="28" y="${y}" width="180" height="100" rx="8" fill="#1e1e25"/>
              <rect x="224" y="${y + 12}" width="180" height="12" rx="5" fill="#2a2a33"/>
              <rect x="224" y="${y + 36}" width="110" height="9" rx="4" fill="#232330"/>
              <rect x="224" y="${y + 60}" width="50" height="9" rx="4" fill="#3a2f1a"/>`;
    })
    .join("")}
</svg>`;

fs.writeFileSync(path.join(shotsDir, "wide.svg"), shotWide);
await sharp(path.join(shotsDir, "wide.svg"))
  .png()
  .toFile(path.join(shotsDir, "keşfet-wide.png"));
console.log("Generated: keşfet-wide.png");

fs.writeFileSync(path.join(shotsDir, "narrow.svg"), shotNarrow);
await sharp(path.join(shotsDir, "narrow.svg"))
  .png()
  .toFile(path.join(shotsDir, "kutuphane-narrow.png"));
console.log("Generated: kutuphane-narrow.png");

console.log("\nTüm PWA görselleri üretildi!");
