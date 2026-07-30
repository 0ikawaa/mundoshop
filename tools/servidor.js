/**
 * Servidor de desarrollo.
 *
 *   node tools/servidor.js          -> http://localhost:8123
 *
 * Sirve el sitio (los modulos ES no andan por file://) y ademas expone
 * POST /__escribir?nombre=... que guarda el cuerpo en 3d/models/.
 * Eso es lo que usa tools/exportar.html para dejar los GLB y USDZ en el repo:
 * los exportadores de three.js corren en el navegador, y esta ruta es el puente
 * para que el resultado termine en disco sin pasar por la carpeta de descargas.
 *
 * Solo escucha en 127.0.0.1 y solo escribe dentro de 3d/models.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');
const SALIDA = path.join(RAIZ, '3d', 'models');
const PUERTO = Number(process.env.PORT) || 8123;

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.glb': 'model/gltf-binary',
  '.usdz': 'model/vnd.usdz+zip'
};

fs.mkdirSync(SALIDA, { recursive: true });

function escribir(req, res, nombre) {
  // Solo un nombre de archivo plano, nada de rutas ni de subir de directorio.
  if (!/^[\w.-]+\.(glb|usdz)$/.test(nombre)) {
    res.writeHead(400); return res.end('nombre invalido');
  }
  const trozos = [];
  req.on('data', (c) => trozos.push(c));
  req.on('end', () => {
    const buf = Buffer.concat(trozos);
    fs.writeFileSync(path.join(SALIDA, nombre), buf);
    console.log(`  guardado 3d/models/${nombre}  (${(buf.length / 1024).toFixed(0)} KB)`);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, nombre, bytes: buf.length }));
  });
}

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (req.method === 'POST' && url.pathname === '/__escribir') {
    return escribir(req, res, url.searchParams.get('nombre') || '');
  }

  let p = decodeURIComponent(url.pathname);
  if (p.endsWith('/')) p += 'index.html';
  const archivo = path.join(RAIZ, p);

  if (!archivo.startsWith(RAIZ) || !fs.existsSync(archivo) || fs.statSync(archivo).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('404 ' + p);
  }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(archivo)] || 'application/octet-stream' });
  fs.createReadStream(archivo).pipe(res);
}).listen(PUERTO, '127.0.0.1', () => {
  console.log(`sitio    http://localhost:${PUERTO}`);
  console.log(`exportar http://localhost:${PUERTO}/tools/exportar.html`);
});
