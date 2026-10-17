// Renders the PNG app icons from public/favicon.svg. Run: bun scripts/icons.ts
import sharp from 'sharp';

const svg = await Bun.file('public/favicon.svg').text();
// Full-bleed square (no rounded corners): iOS and maskable icons get masked by the OS.
const square = svg.replace('rx="114"', 'rx="0"');
const maskable = square.replace('<path', '<g transform="translate(51 51) scale(0.8)"><path').replace('</svg>', '</g></svg>');

const out: [string, string, number][] = [
  ['public/icon-192.png', svg, 192],
  ['public/icon-512.png', svg, 512],
  ['public/apple-touch-icon.png', square, 180],
  ['public/icon-maskable-512.png', maskable, 512],
];
for (const [file, src, size] of out) {
  await sharp(Buffer.from(src)).resize(size, size).png().toFile(file);
  console.log('wrote', file);
}
