import sharp from "sharp";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const inputSvg = path.join(__dirname, "..", "public", "icons", "logo.svg");
const outputDir = path.join(__dirname, "..", "public", "icons");

async function generateIcons() {
  for (const size of sizes) {
    const outputPath = path.join(outputDir, `icon-${size}.png`);
    await sharp(inputSvg)
      .resize(size, size, { fit: "contain", background: { r: 15, g: 15, b: 18, alpha: 1 } })
      .png()
      .toFile(outputPath);
    console.log(`Generated: icon-${size}.png`);
  }
  console.log("All icons generated!");
}

generateIcons().catch(console.error);