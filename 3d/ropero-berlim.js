/**
 * Ropero Placard Berlim — 8 puertas batientes, 10 estantes, 2 barrales.
 * Medidas reales del producto: 206 x 38,5 x 199 cm (ancho x profundidad x altura).
 * Modelado en metros, y-up, apoyado en y = 0.
 *
 *   construirRopero(THREE, opciones) -> { grupo, mats, puertas, setColor, junta }
 *   initRoperoBerlim(stage, btn)     -> API del visor de la ficha
 *
 * construirRopero no toca el DOM mas que para generar texturas en canvas, asi que
 * sirve tanto para el visor como para el exportador de GLB / USDZ (ver tools/).
 *
 * IMPORTANTE: cada malla lleva UN material simple. USDZExporter descarta en
 * silencio las mallas con array de materiales, asi que los cantos de nogal van
 * como mallas aparte en vez de como una cara distinta del mismo box.
 */

import {
  geometriaCaja, mapaNormal, texturaCascara, ambienteDormitorio,
  abrirBatientes, GRADOS_APERTURA
} from './comun.js';

export const MEDIDAS = { W: 2.06, H: 1.99, D: 0.385 };

export const COLORES = {
  // El negro del frente no es negro: en la foto del producto mide (38,38,38).
  negro:   { hex: 0x2b2b2d, rough: 0.68, nombre: 'Negro' },
  blanco:  { hex: 0xf2efe9, rough: 0.52, nombre: 'Blanco' },
  castano: { hex: 0x6b4a33, rough: 0.60, nombre: 'Castano' },
  beige:   { hex: 0xd6c8b1, rough: 0.58, nombre: 'Beige' }
};

/** PRNG con semilla: la veta sale igual en cada corrida, asi el GLB exportado
 *  no cambia byte a byte cada vez que se regenera. */
function rng(semilla) {
  let s = semilla >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function construirRopero(THREE, opciones = {}) {
  const {
    color = 'negro',
    contenido = true,      // ropa, cajas y almohadas: se omiten para AR
    abierto = false,       // sale con las puertas ya abiertas (modelo de AR)
    semilla = 20260730
  } = opciones;

  const rand = rng(semilla);

  // ——— medidas reales (m)
  const { W, H, D } = MEDIDAS;
  const T = 0.018;            // espesor de placa
  const PLINTH = 0.10;        // zocalo
  const CORNICE = 0.155;      // frente superior (banda de madera)
  const doorT = 0.018;
  const CANTO = 0.004;        // canto de nogal en el frente de estantes/divisores

  const innerL = -W / 2 + T, innerR = W / 2 - T;
  const innerW = innerR - innerL;
  const colW = innerW / 4;                       // 4 modulos de 2 puertas
  const insideBottom = PLINTH + T;
  const insideTop = H - CORNICE;
  const divX = [innerL + colW, innerL + 2 * colW, innerL + 3 * colW];
  const colCx = [0, 1, 2, 3].map(i => innerL + colW * (i + 0.5));

  // ——— texturas procedurales (nogal rustico + melamina negra texturada)
  function woodTexture(baseHex, veta) {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 512;
    const x = c.getContext('2d');
    x.fillStyle = baseHex; x.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 260; i++) {
      const y0 = rand() * 512;
      x.strokeStyle = `rgba(${veta}, ${0.03 + rand() * 0.11})`;
      x.lineWidth = 0.5 + rand() * 2.6;
      x.beginPath(); x.moveTo(0, y0);
      for (let px = 32; px <= 512; px += 32) {
        x.lineTo(px, y0 + Math.sin(px / 70 + i) * 2.6 + (rand() - 0.5) * 2.2);
      }
      x.stroke();
    }
    for (let i = 0; i < 5; i++) {          // nudos suaves
      const kx = rand() * 512, ky = rand() * 512;
      const g = x.createRadialGradient(kx, ky, 2, kx, ky, 26 + rand() * 26);
      g.addColorStop(0, `rgba(${veta},0.30)`); g.addColorStop(1, `rgba(${veta},0)`);
      x.fillStyle = g; x.beginPath(); x.arc(kx, ky, 52, 0, Math.PI * 2); x.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  function grainTexture() {                // micro-textura mate para las puertas
    const c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    const x = c.getContext('2d');
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, 256, 256);
    const img = x.getImageData(0, 0, 256, 256), d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = 236 + rand() * 19;
      d[i] = d[i + 1] = d[i + 2] = n;
    }
    x.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(6, 24);
    return tex;
  }

  const col = COLORES[color] || COLORES.negro;

  // Color medido sobre la foto de la publicacion: el nogal del mueble real
  // promedia (120, 92, 72). Antes salia mucho mas naranja de lo que es.
  const vetaNogal = woodTexture('#7a5c46', '58,42,30');

  const mat = {
    nogal: new THREE.MeshStandardMaterial({
      name: 'nogal_rustico', color: 0xffffff, map: vetaNogal,
      normalMap: mapaNormal(THREE, vetaNogal, 2.4),
      normalScale: new THREE.Vector2(0.55, 0.55),
      roughness: 0.58, metalness: 0.04
    }),
    puerta: new THREE.MeshStandardMaterial({
      name: 'mdf_frente', color: col.hex, roughnessMap: grainTexture(),
      normalMap: texturaCascara(THREE, rand, [4, 10]),
      normalScale: new THREE.Vector2(0.14, 0.14),
      roughness: col.rough, metalness: 0.05
    }),
    interior: new THREE.MeshStandardMaterial({
      name: 'melamina_blanca', color: 0xf1efea, roughness: 0.78, metalness: 0.02
    }),
    bronce: new THREE.MeshStandardMaterial({
      name: 'tirador_bronce', color: 0xa06f4a, roughness: 0.34, metalness: 0.42
    }),
    aluminio: new THREE.MeshStandardMaterial({
      name: 'barral_aluminio', color: 0xc9cdd2, roughness: 0.30, metalness: 0.38
    }),
    junta: new THREE.MeshStandardMaterial({
      name: 'sombra_junta', color: 0x121213, roughness: 0.95, metalness: 0.0
    }),
    tela: new THREE.MeshStandardMaterial({ name: 'tela', color: 0xdcd7cd, roughness: 0.92, metalness: 0.0 }),
    tela2: new THREE.MeshStandardMaterial({ name: 'tela_gris', color: 0xa9aeb4, roughness: 0.92, metalness: 0.0 }),
    caja: new THREE.MeshStandardMaterial({ name: 'caja_lino', color: 0xded2bd, roughness: 0.88, metalness: 0.0 })
  };

  const ropero = new THREE.Group();
  ropero.name = 'ropero_berlim';

  function box(name, w, h, d, material, x, y, z, parent) {
    // geometriaCaja y no BoxGeometry: los cantos van redondeados como los de un
    // tablero real (ver la nota del bisel en comun.js).
    const m = new THREE.Mesh(geometriaCaja(THREE, w, h, d), material);
    m.name = name;
    m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true;
    (parent || ropero).add(m);
    return m;
  }

  // Estante o divisor: cuerpo blanco + tira de nogal pegada al frente, como el
  // mueble real. Dos mallas en vez de un box multi-material (ver nota de arriba).
  function panelCanto(name, w, h, d, x, y, z) {
    const cuerpo = box(name, w, h, d - CANTO, mat.interior, x, y, z - CANTO / 2);
    box('canto_' + name, w, h, CANTO, mat.nogal, x, y, z + d / 2 - CANTO / 2);
    return cuerpo;
  }

  // ——————————————————————————— cuerpo
  box('lateral_izq', T, H - 0.020, D, mat.nogal, -W / 2 + T / 2, (H - 0.020) / 2, 0);
  box('lateral_der', T, H - 0.020, D, mat.nogal, W / 2 - T / 2, (H - 0.020) / 2, 0);
  box('tapa_superior', W + 0.008, 0.020, D + 0.042, mat.nogal, 0, H - 0.010, 0.010);
  box('frente_superior', W, CORNICE - 0.020, 0.022, mat.nogal, 0, insideTop + (CORNICE - 0.020) / 2, D / 2 + 0.010);
  box('piso_interior', innerW, T, D - T, mat.interior, 0, insideBottom - T / 2, 0);
  box('fondo', innerW, insideTop - insideBottom, 0.010, mat.interior, 0, (insideTop + insideBottom) / 2, -D / 2 + 0.005);

  // zocalo
  box('zocalo_frente', W, PLINTH, 0.022, mat.nogal, 0, PLINTH / 2, D / 2 + 0.010);
  box('zocalo_lat_izq', T, PLINTH, D, mat.nogal, -W / 2 + T / 2, PLINTH / 2, 0);
  box('zocalo_lat_der', T, PLINTH, D, mat.nogal, W / 2 - T / 2, PLINTH / 2, 0);

  // ——————————————————————————— divisores verticales (4 modulos)
  const inD = D - 0.014, inZ = -0.007;
  divX.forEach((x, i) => {
    panelCanto('divisor_' + (i + 1), T, insideTop - insideBottom, inD, x, (insideTop + insideBottom) / 2, inZ);
  });

  // ——————————————————————————— 10 estantes
  const shelfW = colW - T;
  const yTopShelf = insideTop - 0.40;                 // estante alto (maletero) en los 4 modulos
  colCx.forEach((cx, i) => {
    panelCanto('estante_alto_' + (i + 1), shelfW, T, inD, cx, yTopShelf, inZ);
  });

  // modulos laterales (1 y 4): 3 estantes mas cada uno -> 4 + 3 + 3 = 10
  // Los modulos centrales quedan libres de piso a barral para ropa larga.
  const spanBottom = yTopShelf - insideBottom;
  const yLat = [1, 2, 3].map(j => insideBottom + (spanBottom * j) / 4);
  [0, 3].forEach((ci, k) => {
    yLat.forEach((y, j) => {
      panelCanto('estante_lat_' + (k * 3 + j + 1), shelfW, T, inD, colCx[ci], y, inZ);
    });
  });

  // ——————————————————————————— 2 barrales
  const yBarral = yTopShelf - 0.085;
  [1, 2].forEach((ci, k) => {
    const bar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.015, shelfW - 0.02, 24), mat.aluminio
    );
    bar.name = 'barral_' + (k + 1);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(colCx[ci], yBarral, inZ);
    bar.castShadow = true;
    ropero.add(bar);
    for (const s of [-1, 1]) {   // soportes
      const sup = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 0.03), mat.aluminio);
      sup.name = 'soporte_barral_' + (k + 1) + (s > 0 ? '_der' : '_izq');
      sup.position.set(colCx[ci] + s * (shelfW / 2 - 0.02), yBarral + 0.03, inZ);
      ropero.add(sup);
    }
  });

  // ——————————————————————————— contenido (prendas colgadas, pilas dobladas, cajas)
  if (contenido) {
    const telasPrenda = [
      new THREE.MeshStandardMaterial({ name: 'prenda_crudo', color: 0xe4ded2, roughness: 0.93 }),
      new THREE.MeshStandardMaterial({ name: 'prenda_gris', color: 0xa8aeb5, roughness: 0.93 }),
      new THREE.MeshStandardMaterial({ name: 'prenda_blanco', color: 0xf0ece4, roughness: 0.93 }),
      new THREE.MeshStandardMaterial({ name: 'prenda_topo', color: 0xbdb2a2, roughness: 0.93 })
    ];
    [1, 2].forEach((ci, k) => {
      for (let i = 0; i < 5; i++) {
        // silueta troncoconica achatada: lee mucho mejor como prenda que una caja
        const gh = 0.74 + ((i * 3 + k) % 4) * 0.09;
        const gx = colCx[ci] - 0.20 + i * 0.10;
        const geo = new THREE.CylinderGeometry(0.052, 0.082, gh, 10, 1);
        geo.scale(1, 1, 0.62);
        const g = new THREE.Mesh(geo, telasPrenda[(i + k) % telasPrenda.length]);
        g.name = 'prenda_' + (k + 1) + '_' + (i + 1);
        g.position.set(gx, yBarral - 0.075 - gh / 2, inZ);
        g.rotation.y = ((i % 2 ? 1 : -1) * 0.18) + i * 0.05;
        g.castShadow = true; g.receiveShadow = true;
        ropero.add(g);

        const hombros = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.02, 0.05), g.material);
        hombros.name = 'hombros_' + (k + 1) + '_' + (i + 1);
        hombros.position.set(gx, yBarral - 0.072, inZ);
        hombros.rotation.y = g.rotation.y;
        ropero.add(hombros);

        const hook = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.0032, 8, 18, Math.PI), mat.aluminio);
        hook.name = 'percha_' + (k + 1) + '_' + (i + 1);
        hook.position.set(gx, yBarral - 0.006, inZ);
        hook.rotation.x = Math.PI / 2;
        hook.rotation.z = Math.PI;
        ropero.add(hook);
      }
      // cajas de lino apoyadas en el piso del modulo central
      for (const s of [-1, 1]) {
        box('caja_' + (k + 1) + (s > 0 ? '_der' : '_izq'), 0.22, 0.15, 0.26, mat.caja,
          colCx[ci] + s * 0.12, insideBottom + 0.075, inZ);
      }
    });

    // pilas de ropa doblada en los modulos laterales
    [0, 3].forEach((ci) => {
      [insideBottom, ...yLat].forEach((yBase, j) => {
        const n = 2 + ((ci + j) % 2);
        for (let s = 0; s < n; s++) {
          box('pila_' + ci + '_' + j + '_' + s, 0.30 - s * 0.012, 0.035, 0.24,
            (s + j) % 2 ? mat.tela2 : mat.tela,
            colCx[ci], yBase + T / 2 + 0.020 + s * 0.037, inZ);
        }
      });
      // maletero: almohadas arriba
      box('almohada_' + ci, 0.34, 0.10, 0.26, mat.tela, colCx[ci], yTopShelf + T / 2 + 0.05, inZ);
    });
  }

  // ——————————————————————————— 8 puertas batientes (4 pares)
  const doorSpan = W - 0.010;
  const pitch = doorSpan / 8;
  const doorW = pitch - 0.008;
  const doorTopY = insideTop - 0.004;
  const doorBotY = PLINTH + 0.004;
  const doorH = doorTopY - doorBotY;
  const doorY = (doorTopY + doorBotY) / 2;
  const doorZ = D / 2 + doorT / 2 + 0.002;

  // Placa de sombra detras de las hojas: hace que las juntas se lean como lineas
  // oscuras con el mueble cerrado. Se oculta mientras las puertas estan abiertas.
  const junta = box('sombra_juntas', W - 0.006, doorH + 0.008, 0.005, mat.junta,
    0, doorY, D / 2 - 0.004);

  const puertas = [];
  for (let i = 0; i < 8; i++) {
    const cx = -doorSpan / 2 + pitch * (i + 0.5);
    const izq = i % 2 === 0;                 // par: bisagra a la izquierda; impar: a la derecha
    const side = izq ? -1 : 1;
    // El eje se corre medio espesor hacia afuera para que las hojas de modulos
    // contiguos queden lado a lado (y no se atraviesen) al abrir 105 grados.
    const pivotX = cx + side * (doorW / 2 + doorT / 2);
    const localX = -side * (doorW / 2 + doorT / 2);

    const g = new THREE.Group();
    g.name = 'puerta_' + (i + 1);
    g.position.set(pivotX, doorY, doorZ);

    const hoja = box('puerta_' + (i + 1) + '_hoja', doorW, doorH, doorT, mat.puerta, localX, 0, 0, g);
    hoja.userData.esHoja = true;

    // tirador vertical junto al borde interior del par
    const tx = localX - side * (doorW / 2 - 0.042);
    const tir = new THREE.Mesh(new THREE.CapsuleGeometry(0.010, 0.44, 8, 20), mat.bronce);
    tir.name = 'puerta_' + (i + 1) + '_tirador';
    tir.position.set(tx, 0.035, doorT / 2 + 0.016);
    tir.castShadow = true;
    g.add(tir);
    for (const s of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.016, 12), mat.bronce);
      p.name = 'puerta_' + (i + 1) + '_soporte' + (s > 0 ? '_sup' : '_inf');
      p.rotation.x = Math.PI / 2;
      p.position.set(tx, 0.035 + s * 0.20, doorT / 2 + 0.008);
      g.add(p);
    }

    // bisagras (detalle visible al abrir)
    for (const hy of [-doorH / 2 + 0.16, 0, doorH / 2 - 0.16]) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.045, 10), mat.aluminio);
      b.name = 'puerta_' + (i + 1) + '_bisagra';
      // hacia adentro de la hoja: si no, la bisagra de las puertas de los
      // extremos asoma por fuera del lateral del mueble
      b.position.set(-side * 0.016, hy, -doorT / 2 - 0.004);
      g.add(b);
    }

    ropero.add(g);
    puertas.push({ g, hoja, dir: izq ? -1 : 1, orden: Math.abs(i - 3.5) });
  }

  // Para AR: el modelo nace abierto y la placa de juntas se va. Esa placa esta
  // para que las ranuras entre hojas se lean como lineas oscuras con el mueble
  // cerrado; con las puertas abiertas queda delante del interior y lo tapa
  // justo cuando se lo quiere mostrar.
  if (abierto) {
    abrirBatientes(THREE, puertas);
    junta.visible = false;
  }

  function setColor(nombre) {
    const c = COLORES[nombre];
    if (!c) return false;
    mat.puerta.color.setHex(c.hex);
    mat.puerta.roughness = c.rough;
    mat.puerta.needsUpdate = true;
    return true;
  }

  return { grupo: ropero, mats: mat, puertas, junta, setColor, medidas: { W, H, D } };
}

/** Visor de la ficha de producto: modelo + animacion de puertas + encuadre. */
/**
 * `alCambiar(abierto)` se llama en cada toque del boton. Existe para que la
 * ficha no tenga que llevar su propio booleano de puertas en paralelo a este:
 * dos estados para una sola cosa se separan en cuanto alguien toca uno de los
 * dos caminos, y el de AR terminaria apuntando al archivo equivocado.
 */
export async function initRoperoBerlim(stage, btn, alCambiar) {
  const { THREE } = await stage.ready;
  const { grupo: ropero, puertas, junta, setColor } = construirRopero(THREE);
  const { H } = MEDIDAS;

  // ——————————————————————————— apertura animada
  const OPEN = THREE.MathUtils.degToRad(GRADOS_APERTURA);
  let abierto = false, anim = null;

  function setDoors(open) {
    const t0 = performance.now(), dur = 1050, total = dur + 90 * 3.5;
    const from = puertas.map(p => p.g.rotation.y);
    if (anim) cancelAnimationFrame(anim);
    if (open) junta.visible = false;
    const step = (now) => {
      const t = now - t0;
      puertas.forEach((p, i) => {
        const delay = p.orden * 90;                       // apertura escalonada del centro hacia afuera
        const pr = Math.min(1, Math.max(0, (t - delay) / dur));
        const e = pr < 0.5 ? 4 * pr * pr * pr : 1 - Math.pow(-2 * pr + 2, 3) / 2;
        const target = open ? p.dir * OPEN : 0;
        p.g.rotation.y = from[i] + (target - from[i]) * e;
      });
      if (t < total) anim = requestAnimationFrame(step);
      else if (!open) junta.visible = true;
    };
    anim = requestAnimationFrame(step);
  }

  function toggle() {
    abierto = !abierto;
    setDoors(abierto);
    if (btn) btn.textContent = abierto ? 'Cerrar puertas' : 'Abrir puertas';
    if (alCambiar) alCambiar(abierto);
    return abierto;
  }
  if (btn) btn.addEventListener('click', toggle);

  stage.setObject(ropero);
  // Mas ambiente que en los muebles claros, y no por gusto: un frente negro
  // mate no tiene practicamente color propio, casi todo lo que se ve de el es
  // el reflejo del cuarto. Apagando el ambiente el frente mide (4,4,5) — un
  // agujero, sin una hoja distinguible de la de al lado. La foto del producto
  // marca (38,38,38), y para llegar ahi hace falta este medio.
  ambienteDormitorio(THREE, stage, 0.5);

  // ——————————————————————————— encuadre
  // El auto-frame del stage usa la esfera envolvente y deja el mueble muy chico
  // (es un objeto ancho y plano). Encuadramos proyectando la caja envolvente.
  const VISTA_3_4 = new THREE.Vector3(0.52, 0.30, 1);
  const VISTA_FRONTAL = new THREE.Vector3(0, 0.11, 1);
  let vistaActual = VISTA_3_4;

  const bbox = new THREE.Box3().setFromObject(ropero);
  const esquinas = [];
  for (const x of [bbox.min.x, bbox.max.x])
    for (const y of [bbox.min.y, bbox.max.y])
      for (const z of [bbox.min.z, bbox.max.z])
        esquinas.push(new THREE.Vector3(x, y, z));

  const AIRE = 0.86;   // fraccion del encuadre que ocupa el mueble

  function encuadrar(dir) {
    const cam = stage._camera, ctl = stage._controls;
    if (!cam || !ctl) return;
    if (dir) vistaActual = dir;
    const d = vistaActual.clone().normalize();
    const target = new THREE.Vector3(0, H * 0.47, 0);
    // Lente larga: el mueble es ancho y bajo, con 45 grados la fuga es exagerada
    // y no se parece a una foto de producto.
    cam.fov = 30;
    cam.near = 0.05;
    cam.far = 80;

    // Punto de partida: ajuste plano; se corrige proyectando las esquinas, que
    // en perspectiva se agrandan mucho mas que el plano medio del objeto.
    let dist = (H / 2) / Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2) * 1.15;
    for (let i = 0; i < 20; i++) {
      cam.position.copy(target).add(d.clone().multiplyScalar(dist));
      cam.lookAt(target);
      cam.updateMatrixWorld(true);
      cam.updateProjectionMatrix();
      let m = 0;
      for (const c of esquinas) {
        const p = c.clone().project(cam);
        m = Math.max(m, Math.abs(p.x), Math.abs(p.y));
      }
      if (m <= AIRE && m > AIRE - 0.02) break;
      dist *= m / AIRE;
    }

    ctl.target.copy(target);
    ctl.minDistance = 1.4;
    ctl.maxDistance = 20;
    ctl.maxPolarAngle = Math.PI * 0.53;   // no meterse debajo del piso
    ctl.update();
  }
  encuadrar(VISTA_3_4);
  // Reencuadrar cuando cambia el tamano del visor, mientras el usuario no toco la camara.
  let tocado = false;
  stage._controls && stage._controls.addEventListener('start', () => { tocado = true; });
  new ResizeObserver(() => { if (!tocado) encuadrar(); }).observe(stage);

  return {
    setColor, setDoors, toggle, colores: COLORES, grupo: ropero,
    encuadrar,
    vistaFrontal: () => { tocado = false; encuadrar(VISTA_FRONTAL); },
    vistaInicial: () => { tocado = false; encuadrar(VISTA_3_4); }
  };
}
