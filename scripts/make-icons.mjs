// Genera todos los iconos (PNG + ICO) sin dependencias externas.
// Uso: npm run icons
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
function png(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}
function ico(pngs) {
  const head = Buffer.alloc(6 + 16 * pngs.length);
  head.writeUInt16LE(1, 2); head.writeUInt16LE(pngs.length, 4);
  let off = head.length;
  pngs.forEach(([s, d], i) => {
    const e = 6 + i * 16;
    head[e] = s >= 256 ? 0 : s; head[e + 1] = s >= 256 ? 0 : s;
    head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6);
    head.writeUInt32LE(d.length, e + 8); head.writeUInt32LE(off, e + 12);
    off += d.length;
  });
  return Buffer.concat([head, ...pngs.map((p) => p[1])]);
}

const A = [0x47, 0x20, 0xd8], B = [0x65, 0x39, 0xff];
const segDist = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
};
// Muestra un punto (u,v en 0..1) -> [r,g,b,a]
function sample(u, v, { maskable }) {
  const pad = maskable ? 0 : 0.04, r = maskable ? 0 : 0.23;
  const x = Math.abs(u - 0.5), y = Math.abs(v - 0.5), h = 0.5 - pad;
  const qx = Math.max(x - (h - r), 0), qy = Math.max(y - (h - r), 0);
  const inside = maskable || (x <= h && y <= h && Math.hypot(qx, qy) <= r);
  if (!inside) return [0, 0, 0, 0];
  const s = maskable ? 0.62 : 0.86; // zona segura para iconos maskable
  const cu = (u - 0.5) / s + 0.5, cv = (v - 0.5) / s + 0.5;
  const d = Math.min(segDist(cu, cv, 0.29, 0.52, 0.44, 0.67), segDist(cu, cv, 0.44, 0.67, 0.72, 0.37));
  if (d <= 0.062) return [255, 255, 255, 255];
  const t = Math.min(1, Math.max(0, (u + v) / 2));
  return [0, 1, 2].map((i) => Math.round(A[i] + (B[i] - A[i]) * t)).concat(255);
}
function render(size, opts = {}) {
  const ss = size <= 32 ? 8 : 4, out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let j = 0; j < ss; j++) for (let i = 0; i < ss; i++) {
      const c = sample((x + (i + 0.5) / ss) / size, (y + (j + 0.5) / ss) / size, opts);
      r += c[0] * c[3]; g += c[1] * c[3]; b += c[2] * c[3]; a += c[3];
    }
    const o = (y * size + x) * 4;
    if (a) { out[o] = r / a; out[o + 1] = g / a; out[o + 2] = b / a; }
    out[o + 3] = a / (ss * ss);
  }
  return png(size, out);
}

const write = (rel, data) => { const f = join(root, rel); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, data); console.log('✔', rel); };
write('app/icons/icon-192.png', render(192));
write('app/icons/icon-512.png', render(512));
write('app/icons/icon-maskable-512.png', render(512, { maskable: true }));
write('app/icons/apple-touch-icon.png', render(180, { maskable: true }));
write('electron/assets/icon.png', render(256));
write('electron/assets/tray.png', render(16));
write('electron/assets/tray@2x.png', render(32));
write('build/icon.png', render(512));
write('build/icon.ico', ico([16, 24, 32, 48, 64, 128, 256].map((s) => [s, render(s)])));
