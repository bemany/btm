#!/usr/bin/env node
// Erzeugt PWA-PNG-Icons aus public/app-icon.svg.
// Wird einmalig von Hand gestartet (npm run icons) — nicht bei jedem Build.

import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const src = resolve(root, 'public/app-icon.svg');
const outDir = resolve(root, 'public');

mkdirSync(outDir, { recursive: true });

const svg = readFileSync(src);

const targets = [
  { size: 192, name: 'app-icon-192.png' },
  { size: 512, name: 'app-icon-512.png' },
  { size: 180, name: 'apple-touch-icon.png' },
  { size: 32,  name: 'favicon-32.png' },
  { size: 16,  name: 'favicon-16.png' },
  // Maskable: 10% Safe-Zone-Padding (Icon = 80% von 512)
  { size: 512, name: 'app-icon-maskable-512.png', pad: 0.1 },
];

for (const t of targets) {
  const out = resolve(outDir, t.name);
  if (t.pad) {
    const inner = Math.round(t.size * (1 - 2 * t.pad));
    const offset = Math.round(t.size * t.pad);
    const innerBuf = await sharp(svg, { density: 384 }).resize(inner, inner).png().toBuffer();
    await sharp({
      create: {
        width: t.size,
        height: t.size,
        channels: 4,
        background: { r: 28, g: 26, b: 23, alpha: 1 },
      },
    })
      .composite([{ input: innerBuf, top: offset, left: offset }])
      .png()
      .toFile(out);
  } else {
    await sharp(svg, { density: 384 }).resize(t.size, t.size).png().toFile(out);
  }
  console.log(`✓ ${t.name} (${t.size}×${t.size})`);
}
