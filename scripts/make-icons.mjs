// Procedural pixel-art monkey icons -> icons/*.png (pure Node, no deps). Run: node scripts/make-icons.mjs
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const out = fileURLToPath(new URL('../icons/', import.meta.url));
const PAL = { '.': null, k: [24, 20, 37], f: [139, 90, 43], d: [94, 57, 28], s: [234, 212, 170], a: [254, 174, 52], w: [255, 255, 255], r: [228, 59, 68] };
const ART = [
  '................',
  '...kkkk..kkkk...',
  '..kffffkkffffk..',
  '.kfssfkffkfssfk.',
  '.kfssffffffssfk.',
  '..kffffffffffk..',
  '.kffkkffffkkffk.',
  '.kffkwkffkwkffk.',
  '..kfffssssfffk..',
  '..kffssssssffk..',
  '..kfssskkssssk..',
  '..kfssssssssfk..',
  '...kfssrrssfk...',
  '....kffssffk....',
  '.....kkkkkk.....',
  '................',
];
const BG = [24, 20, 37];

function crc32(buf) {
  let c, crc = ~0;
  for (let i = 0; i < buf.length; i++) {
    c = (crc ^ buf[i]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return ~crc >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function png(size, artFrac) {
  const unit = Math.max(1, Math.floor((size * artFrac) / 16));
  const off = Math.floor((size - unit * 16) / 2);
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let px = BG;
      const ax = Math.floor((x - off) / unit), ay = Math.floor((y - off) / unit);
      if (ax >= 0 && ax < 16 && ay >= 0 && ay < 16) px = PAL[ART[ay][ax]] || BG;
      raw.set(px, y * (size * 3 + 1) + 1 + x * 3);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

mkdirSync(out, { recursive: true });
const files = { 'icon-192.png': [192, 0.86], 'icon-512.png': [512, 0.86], 'maskable-512.png': [512, 0.6], 'apple-touch-icon.png': [180, 0.8] };
for (const [name, [size, frac]] of Object.entries(files)) writeFileSync(out + name, png(size, frac));
console.log('wrote', Object.keys(files).join(', '));
