/**
 * One-off script to rasterize scripts/og-image.svg -> public/og-image.png.
 *
 * Uses `sharp` (already pulled in transitively by Astro) so we don't need
 * a headless browser or extra dep. Run when the SVG changes:
 *
 *   cd site && node scripts/generate-og-image.mjs
 *
 * The output PNG is committed so every Amplify deploy serves the same
 * card without rebuilding it. LinkedIn and other OG consumers need a
 * fixed URL that returns PNG/JPG — they don't render SVG previews.
 */
import sharp from "sharp";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const svgPath = join(__dirname, "og-image.svg");
const outPath = join(__dirname, "..", "public", "og-image.png");

const svg = readFileSync(svgPath);

// density 144 (=2x) so the 1200x630 card renders crisply without scaling
// artifacts on the glyph paths. LinkedIn downscales for the card anyway.
await sharp(svg, { density: 144 })
  .resize(1200, 630)
  .png({ compressionLevel: 9 })
  .toFile(outPath);

console.log(`wrote ${outPath}`);
