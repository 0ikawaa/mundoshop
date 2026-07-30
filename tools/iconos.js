/**
 * Genera los iconos del sitio a partir de la marca, sin dependencias.
 *
 *   node tools/iconos.js
 *
 * Sale: favicon.svg (navegadores modernos), favicon.ico (32px, el que piden
 * los viejos y algunos agregadores) y apple-touch-icon.png (180px, pantalla
 * de inicio de iOS).
 *
 * El dibujo es a proposito mas simple que el logo completo: a 16 px un tag con
 * texto adentro es una mancha. Quedan el cuadrado azul y las dos barras
 * — blanca y amarilla — que es lo que se reconoce del logo a ese tamano.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const RAIZ = path.resolve(__dirname, '..');
const AZUL = [0x04, 0x1e, 0x7d];
const BLANCO = [0xff, 0xff, 0xff];
const AMARILLO = [0xfa, 0xe3, 0x07];

/* ---------- rasterizado ---------- */

// Distancia con signo a un rectangulo redondeado: negativa adentro. Con eso
// sacamos bordes suaves sin necesidad de supersamplear.
function sdRoundRect(px, py, cx, cy, hw, hh, r) {
  const qx = Math.abs(px - cx) - (hw - r);
  const qy = Math.abs(py - cy) - (hh - r);
  const ax = Math.max(qx, 0), ay = Math.max(qy, 0);
  return Math.hypot(ax, ay) + Math.min(Math.max(qx, qy), 0) - r;
}

function pintar(dst, i, color, a) {
  if (a <= 0) return;
  const ia = 1 - a;
  dst[i]     = Math.round(color[0] * a + dst[i] * ia);
  dst[i + 1] = Math.round(color[1] * a + dst[i + 1] * ia);
  dst[i + 2] = Math.round(color[2] * a + dst[i + 2] * ia);
  dst[i + 3] = Math.round(255 * a + dst[i + 3] * ia);
}

function dibujar(N) {
  const buf = Buffer.alloc(N * N * 4, 0);
  const u = N / 32;                      // el diseño esta pensado en una grilla de 32

  const formas = [
    // fondo: cuadrado azul con esquinas bien redondeadas
    { cx: 16, cy: 16, hw: 16, hh: 16, r: 7.5, color: AZUL },
    // barra "Mundo"
    { cx: 15.5, cy: 13, hw: 8.5, hh: 2.1, r: 2.1, color: BLANCO },
    // barra "shop", mas corta y alineada a la izquierda
    { cx: 12.5, cy: 19.4, hw: 5.5, hh: 2.1, r: 2.1, color: AMARILLO },
  ];

  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const i = (y * N + x) * 4;
      const px = (x + 0.5) / u, py = (y + 0.5) / u;
      for (const f of formas) {
        const d = sdRoundRect(px, py, f.cx, f.cy, f.hw, f.hh, f.r);
        // franja de 1 pixel para el antialias
        const a = Math.min(1, Math.max(0, 0.5 - d * u));
        pintar(buf, i, f.color, a);
      }
    }
  }
  return buf;
}

/* ---------- PNG ---------- */

const TABLA_CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = TABLA_CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function trozo(tipo, datos) {
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(datos.length, 0);
  const cuerpo = Buffer.concat([Buffer.from(tipo, 'latin1'), datos]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(cuerpo), 0);
  return Buffer.concat([largo, cuerpo, crc]);
}
function png(N, rgba) {
  // Cada scanline lleva adelante un byte de filtro; usamos 0 (sin filtro).
  const fila = N * 4;
  const crudo = Buffer.alloc((fila + 1) * N);
  for (let y = 0; y < N; y++) {
    crudo[y * (fila + 1)] = 0;
    rgba.copy(crudo, y * (fila + 1) + 1, y * fila, (y + 1) * fila);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(N, 0);
  ihdr.writeUInt32BE(N, 4);
  ihdr[8] = 8;    // 8 bits por canal
  ihdr[9] = 6;    // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    trozo('IHDR', ihdr),
    trozo('IDAT', zlib.deflateSync(crudo, { level: 9 })),
    trozo('IEND', Buffer.alloc(0))
  ]);
}

/* ---------- ICO ----------
   Un .ico moderno puede llevar el PNG adentro tal cual; no hace falta BMP. */
function ico(N, pngBuf) {
  const cab = Buffer.alloc(6);
  cab.writeUInt16LE(0, 0);
  cab.writeUInt16LE(1, 2);   // 1 = icono
  cab.writeUInt16LE(1, 4);   // una sola imagen
  const ent = Buffer.alloc(16);
  ent[0] = N; ent[1] = N;
  ent.writeUInt16LE(1, 4);   // planos
  ent.writeUInt16LE(32, 6);  // bits por pixel
  ent.writeUInt32LE(pngBuf.length, 8);
  ent.writeUInt32LE(22, 12); // offset: 6 + 16
  return Buffer.concat([cab, ent, pngBuf]);
}

/* ---------- SVG ---------- */
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="7.5" fill="#041e7d"/>
  <rect x="7" y="10.9" width="17" height="4.2" rx="2.1" fill="#fff"/>
  <rect x="7" y="17.3" width="11" height="4.2" rx="2.1" fill="#fae307"/>
</svg>
`;

/* ---------- escribir ---------- */
const salidas = [];
fs.writeFileSync(path.join(RAIZ, 'favicon.svg'), svg);
salidas.push('favicon.svg');

const png32 = png(32, dibujar(32));
fs.writeFileSync(path.join(RAIZ, 'favicon.ico'), ico(32, png32));
salidas.push('favicon.ico');

fs.writeFileSync(path.join(RAIZ, 'apple-touch-icon.png'), png(180, dibujar(180)));
salidas.push('apple-touch-icon.png');

fs.writeFileSync(path.join(RAIZ, 'site.webmanifest'), JSON.stringify({
  name: 'Mundo Shop',
  short_name: 'Mundo Shop',
  description: 'Muebles con vista 3D y prueba en realidad aumentada.',
  start_url: '/',
  display: 'standalone',
  background_color: '#f6f7fb',
  theme_color: '#041e7d',
  icons: [
    { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' },
    { src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }
  ]
}, null, 2) + '\n');
salidas.push('site.webmanifest');

for (const s of salidas) {
  console.log('  ' + s.padEnd(24), fs.statSync(path.join(RAIZ, s)).size + ' bytes');
}
