/**
 * Ropero Bariloche — 3 puertas corredizas con espejo, 8 estantes, 1 barral.
 * Medidas reales: 180 x 45 x 180 cm (ancho x profundidad x altura).
 *
 * El dato que ordena todo el modelo esta en la descripcion de la publicacion:
 * el mueble mide 180 de ancho pero la luz interior es de 155. Esos 12,5 cm de
 * marco por lado son el borde blanco grueso que se ve en la foto y lo que hace
 * que el mueble se reconozca.
 *
 * Modelado en metros, y-up, apoyado en y = 0.
 */

import {
  rng, texturaMadera, texturaGrano, hacerCaja,
  encuadrador, ambienteDormitorio, animarCorredizas, materialEspejo
} from './comun.js';

export const MEDIDAS = { W: 1.80, H: 1.80, D: 0.45 };
export const COLORES = { blanco: { hex: 0xf4f3f0, rough: 0.5, nombre: 'Blanco' } };

export function construirBariloche(THREE, opciones = {}) {
  const { contenido = true, semilla = 20260731 } = opciones;
  const rand = rng(semilla);

  const { W, H, D } = MEDIDAS;
  const T = 0.018;
  const MARCO = 0.125;        // marco lateral: 180 exterior - 155 de luz
  const CORNISA = 0.135;      // banda superior, incluye el riel de arriba
  const ZOCALO = 0.085;
  const doorT = 0.018;

  const luzW = W - 2 * MARCO;                 // 1,55 m de abertura
  const luzL = -luzW / 2, luzR = luzW / 2;
  const insideBottom = ZOCALO + T;
  const insideTop = H - CORNISA;
  const span = insideTop - insideBottom;

  // El interior es menos profundo que el mueble: adelante van los dos planos de
  // corredera. La publicacion da 33,5 cm de estante contra 45 de profundidad.
  const inD = 0.335;
  const inZ = -D / 2 + inD / 2 + 0.012;

  const mat = {
    blanco: new THREE.MeshStandardMaterial({
      name: 'mdp_blanco', color: 0xf4f3f0, roughnessMap: texturaGrano(THREE, rand, [4, 16]),
      roughness: 0.52, metalness: 0.03
    }),
    interior: new THREE.MeshStandardMaterial({
      name: 'roble_claro', color: 0xffffff,
      map: texturaMadera(THREE, rand, '#cbb99c', '120,96,66', [1, 2]),
      roughness: 0.68, metalness: 0.03
    }),
    aluminio: new THREE.MeshStandardMaterial({
      name: 'aluminio', color: 0xc9cdd2, roughness: 0.28, metalness: 0.42
    }),
    cobre: new THREE.MeshStandardMaterial({
      name: 'tirador_cobre', color: 0xc08457, roughness: 0.3, metalness: 0.45
    }),
    espejo: materialEspejo(THREE, rand),
    tela: new THREE.MeshStandardMaterial({ name: 'tela', color: 0xdcd7cd, roughness: 0.92 }),
    tela2: new THREE.MeshStandardMaterial({ name: 'tela_gris', color: 0xa9aeb4, roughness: 0.92 }),
    sombra: new THREE.MeshStandardMaterial({ name: 'sombra_hueco', color: 0x2a2723, roughness: 0.95 })
  };

  const ropero = new THREE.Group();
  ropero.name = 'ropero_bariloche';
  const caja = (n, w, h, d, m, x, y, z, padre) =>
    hacerCaja(THREE, padre || ropero, n, w, h, d, m, x, y, z);

  // ——————————————————————————— cuerpo y marco
  caja('lateral_izq', T, H - 0.02, D, mat.blanco, -W / 2 + T / 2, (H - 0.02) / 2, 0);
  caja('lateral_der', T, H - 0.02, D, mat.blanco, W / 2 - T / 2, (H - 0.02) / 2, 0);
  caja('tapa', W + 0.01, 0.022, D + 0.03, mat.blanco, 0, H - 0.011, 0.008);
  caja('piso_interior', W - 2 * T, T, D - T, mat.interior, 0, insideBottom - T / 2, 0);
  caja('fondo', W - 2 * T, insideTop - insideBottom + 0.05, 0.010, mat.interior,
    0, (insideTop + insideBottom) / 2, -D / 2 + 0.005);

  // Marco del frente: banda superior, zocalo y las dos jambas.
  caja('frente_superior', W, CORNISA, 0.024, mat.blanco, 0, H - CORNISA / 2, D / 2 + 0.012);
  caja('zocalo', W, ZOCALO, 0.024, mat.blanco, 0, ZOCALO / 2, D / 2 + 0.012);
  for (const s of [-1, 1]) {
    caja('jamba' + (s > 0 ? '_der' : '_izq'), MARCO, H - CORNISA - ZOCALO, 0.024, mat.blanco,
      s * (W / 2 - MARCO / 2), (insideTop + ZOCALO) / 2, D / 2 + 0.012);
  }

  // ——————————————————————————— interior: columna de estantes + zona de colgado
  const colIzqW = 0.52;
  const divX = luzL + colIzqW + T / 2;
  caja('divisor', T, span, inD, mat.interior, divX, (insideTop + insideBottom) / 2, inZ);

  // 8 estantes: 3 en la columna angosta, 1 continuo en la ancha y 4 en los
  // dos huecos de abajo. Es el reparto que se ve en la foto de interior.
  const izqCx = (luzL + divX) / 2;
  const izqW = divX - luzL - T / 2;
  const yIzq = [0.26, 0.47, 0.69].map(f => insideBottom + span * f);
  yIzq.forEach((y, i) => caja('estante_izq_' + (i + 1), izqW, T, inD, mat.interior, izqCx, y, inZ));

  const derL = divX + T / 2, derW = luzR - derL;
  const derCx = derL + derW / 2;
  const yMedio = insideBottom + span * 0.46;
  caja('estante_medio', derW, T, inD, mat.interior, derCx, yMedio, inZ);

  const subX = derCx;
  caja('subdivisor', T, yMedio - insideBottom, inD, mat.interior,
    subX, (yMedio + insideBottom) / 2, inZ);
  const subW = derW / 2 - T / 2;
  [-1, 1].forEach((s, k) => {
    [0.16, 0.31].forEach((f, i) => {
      caja('estante_bajo_' + (k * 2 + i + 1), subW, T, inD, mat.interior,
        subX + s * (subW / 2 + T / 2), insideBottom + span * f, inZ);
    });
  });

  // Barral en la zona de colgado
  const yBarral = insideTop - 0.075;
  const barral = new THREE.Mesh(
    new THREE.CylinderGeometry(0.014, 0.014, derW - 0.03, 20), mat.aluminio);
  barral.name = 'barral';
  barral.rotation.z = Math.PI / 2;
  barral.position.set(derCx, yBarral, inZ);
  barral.castShadow = true;
  ropero.add(barral);
  for (const s of [-1, 1]) {
    const sop = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.045, 0.028), mat.aluminio);
    sop.name = 'soporte_barral' + (s > 0 ? '_der' : '_izq');
    sop.position.set(derCx + s * (derW / 2 - 0.02), yBarral + 0.028, inZ);
    ropero.add(sop);
  }

  if (contenido) {
    for (let i = 0; i < 6; i++) {
      const gh = 0.68 + (i % 3) * 0.1;
      const gx = derCx - 0.28 + i * 0.112;
      const geo = new THREE.CylinderGeometry(0.05, 0.078, gh, 10, 1);
      geo.scale(1, 1, 0.6);
      const g = new THREE.Mesh(geo, i % 2 ? mat.tela2 : mat.tela);
      g.name = 'prenda_' + (i + 1);
      g.position.set(gx, yBarral - 0.07 - gh / 2, inZ);
      g.rotation.y = (i % 2 ? 1 : -1) * 0.16;
      g.castShadow = true; g.receiveShadow = true;
      ropero.add(g);
      const p = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.003, 8, 16, Math.PI), mat.aluminio);
      p.name = 'percha_' + (i + 1);
      p.position.set(gx, yBarral - 0.005, inZ);
      p.rotation.x = Math.PI / 2; p.rotation.z = Math.PI;
      ropero.add(p);
    }
    // pilas de ropa en la columna de estantes
    [insideBottom, ...yIzq].forEach((yBase, j) => {
      for (let s = 0; s < 2 + (j % 2); s++) {
        caja('pila_' + j + '_' + s, 0.34 - s * 0.015, 0.034, 0.24,
          (s + j) % 2 ? mat.tela2 : mat.tela, izqCx, yBase + T / 2 + 0.019 + s * 0.036, inZ);
      }
    });
  }

  // ——————————————————————————— 3 puertas corredizas en dos planos de riel
  const zFrente = D / 2;
  const zRielA = zFrente - 0.014;      // plano de adelante: la hoja del espejo
  const zRielB = zFrente - 0.052;      // plano de atras: las dos laterales
  // Los rieles van metidos hacia adentro: de frente apenas se ve una linea.
  caja('riel_superior', luzW, 0.016, 0.075, mat.aluminio, 0, insideTop - 0.008, zFrente - 0.055);
  caja('riel_inferior', luzW, 0.012, 0.075, mat.aluminio, 0, insideBottom + 0.006, zFrente - 0.055);

  // Sin placa de sombra detras de las hojas: en corredizas las juntas muestran
  // la hoja del otro riel, no el interior. Una placa ahi taparia los estantes
  // apenas se abren las puertas.
  const doorW = luzW / 3 + 0.018;
  const doorTop = insideTop - 0.022;
  const doorBot = insideBottom + 0.016;
  const doorH = doorTop - doorBot;
  const doorY = (doorTop + doorBot) / 2;
  const dx = luzW / 2 - doorW / 2;

  let mallaEspejo = null;

  function puerta(nombre, cx, z, conEspejo) {
    const g = new THREE.Group();
    g.name = nombre;
    caja(nombre + '_hoja', doorW, doorH, doorT, mat.blanco, 0, 0, 0, g);

    if (conEspejo) {
      // La ficha declara un espejo de 35 x 120 cm, pero en las fotos del
      // producto ocupa casi toda la hoja con apenas un marco fino alrededor.
      // Va lo de las fotos, que es lo que el comprador reconoce.
      const eW = doorW - 0.055, eH = doorH - 0.075;
      mallaEspejo = caja(nombre + '_espejo', eW, eH, 0.006, mat.espejo,
        0, 0, doorT / 2 + 0.002, g);
      for (const s of [-1, 1]) {
        caja(nombre + '_moldura_v' + (s > 0 ? '_der' : '_izq'), 0.014, eH + 0.028, 0.008,
          mat.aluminio, s * (eW / 2 + 0.007), 0, doorT / 2 + 0.003, g);
        caja(nombre + '_moldura_h' + (s > 0 ? '_sup' : '_inf'), eW + 0.028, 0.014, 0.008,
          mat.aluminio, 0, s * (eH / 2 + 0.007), doorT / 2 + 0.003, g);
      }
    } else {
      // Tirador vertical sobre el borde de afuera: es de donde se empuja.
      const lado = cx < 0 ? -1 : 1;
      const t = new THREE.Mesh(new THREE.CapsuleGeometry(0.009, 0.30, 8, 18), mat.cobre);
      t.name = nombre + '_tirador';
      t.position.set(lado * (doorW / 2 - 0.048), 0.03, doorT / 2 + 0.013);
      t.castShadow = true;
      g.add(t);
      for (const s of [-1, 1]) {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.014, 12), mat.cobre);
        p.name = nombre + '_soporte' + (s > 0 ? '_sup' : '_inf');
        p.rotation.x = Math.PI / 2;
        p.position.set(t.position.x, 0.03 + s * 0.14, doorT / 2 + 0.006);
        g.add(p);
      }
    }
    g.position.set(cx, doorY, z);
    ropero.add(g);
    return g;
  }

  const pIzq = puerta('puerta_izq', -dx, zRielB, false);
  const pCen = puerta('puerta_espejo', 0, zRielA, true);
  const pDer = puerta('puerta_der', dx, zRielB, false);

  // Al abrir, las hojas laterales corren hasta quedar detras de la del espejo.
  const hojas = [
    { g: pIzq, cerrada: -dx, abierta: -dx + doorW - 0.018 },
    { g: pDer, cerrada: dx, abierta: dx - doorW + 0.018 }
  ];

  return {
    grupo: ropero, mats: mat, hojas, mallaEspejo,
    setColor: () => true,          // este modelo se vende solo en blanco
    medidas: { W, H, D }
  };
}

export async function initBariloche(stage, btn) {
  const { THREE } = await stage.ready;
  const { grupo, hojas, mallaEspejo } = construirBariloche(THREE);
  const { H } = MEDIDAS;

  const setPuertas = animarCorredizas(hojas);
  let abierto = false;
  function toggle() {
    abierto = !abierto;
    setPuertas(abierto);
    if (btn) btn.textContent = abierto ? 'Cerrar puertas' : 'Abrir puertas';
    return abierto;
  }
  if (btn) btn.addEventListener('click', toggle);

  stage.setObject(grupo);
  const vistas = encuadrador(THREE, stage, grupo, H);
  ambienteDormitorio(THREE, stage, 0.5);

  return {
    grupo, toggle, setDoors: setPuertas, colores: COLORES,
    setColor: () => true,
    ...vistas
  };
}
