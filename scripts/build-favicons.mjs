#!/usr/bin/env node
// Regenerate app/favicon.ico and app/apple-icon.png from app/icon.svg.
// Run after editing app/icon.svg:  node scripts/build-favicons.mjs
//
// Uses macOS Quick Look (qlmanage) to rasterize the SVG — no npm deps needed.
// On non-macOS hosts, install sharp and adapt the rasterize() call.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const appDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'app');
const svg = join(appDir, 'icon.svg');
const tmp = mkdtempSync(join(tmpdir(), 'favicons-'));

function rasterize(size) {
  execFileSync('qlmanage', ['-t', '-s', String(size), '-o', tmp, svg], { stdio: 'ignore' });
  return readFileSync(join(tmp, 'icon.svg.png'));
}

const sizes = [16, 32, 48];
const pngs = sizes.map(rasterize);
writeFileSync(join(appDir, 'apple-icon.png'), rasterize(180));

// PNG-embedded ICO. Header (6) + 16-byte dir entry per image + concatenated PNGs.
const header = Buffer.alloc(6);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(pngs.length, 4);
let offset = header.length + 16 * pngs.length;
const dir = pngs.map((buf, i) => {
  const s = sizes[i];
  const e = Buffer.alloc(16);
  e.writeUInt8(s >= 256 ? 0 : s, 0);
  e.writeUInt8(s >= 256 ? 0 : s, 1);
  e.writeUInt16LE(1, 4);
  e.writeUInt16LE(32, 6);
  e.writeUInt32LE(buf.length, 8);
  e.writeUInt32LE(offset, 12);
  offset += buf.length;
  return e;
});
writeFileSync(join(appDir, 'favicon.ico'), Buffer.concat([header, ...dir, ...pngs]));
rmSync(tmp, { recursive: true, force: true });
console.log('wrote app/favicon.ico and app/apple-icon.png');
