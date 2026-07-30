/**
 * Ropero Placard Florencia — 6 puertas batientes, 2 cajones, barrales.
 * Medidas reales: 180 x 47 x 200 cm (ancho x profundidad x altura).
 *
 * La publicacion trae un plano acotado del interior, asi que las alturas de
 * cada hueco son las del fabricante y no una estimacion: la columna izquierda
 * va 43 / 43 / 48 / 37 cm de arriba hacia abajo, el colgado del centro mide
 * 96 cm y los huecos de la derecha 37 y 37.
 *
 * Los frentes alternan: las dos hojas de los extremos llevan listones
 * verticales de madera y las cuatro del medio son blanco brillante.
 *
 * Modelado en metros, y-up, apoyado en y = 0.
 */

import {
  rng, texturaMadera, texturaGrano, hacerCaja, mapaNormal, texturaCascara,
  encuadrador, ambienteDormitorio, animarBatientes, abrirBatientes
} from './comun.js';

export const MEDIDAS = { W: 1.80, H: 2.00, D: 0.47 };
export const COLORES = { beige: { hex: 0xb08758, rough: 0.55, nombre: 'Beige' } };

export function construirFlorencia(THREE, opciones = {}) {
  const { contenido = true, abierto = false, semilla = 20260732 } = opciones;
  const rand = rng(semilla);

  const { W, H, D } = MEDIDAS;
  const T = 0.018;
  const CORNISA = 0.09;
  const ZOCALO = 0.11;
  const doorT = 0.019;

  const innerL = -W / 2 + T, innerR = W / 2 - T;
  const innerW = innerR - innerL;              // 1,764
  const colW = innerW / 3;                     // tres columnas de ~59 cm
  const colCx = [0, 1, 2].map(i => innerL + colW * (i + 0.5));
  const divX = [innerL + colW, innerL + 2 * colW];

  const insideBottom = ZOCALO + T;
  const insideTop = H - CORNISA;
  const span = insideTop - insideBottom;       // 1,80 de luz interior
  const inD = D - 0.03, inZ = -0.012;

  const maderaTex = texturaMadera(THREE, rand, '#b08758', '92,62,32', [1, 2]);
  const interiorTex = texturaMadera(THREE, rand, '#c9b190', '110,82,50', [1, 1]);

  const mat = {
    madera: new THREE.MeshStandardMaterial({
      name: 'roble_rustico', color: 0xffffff, map: maderaTex,
      normalMap: mapaNormal(THREE, maderaTex, 2.4),
      normalScale: new THREE.Vector2(0.6, 0.6),
      roughness: 0.56, metalness: 0.04
    }),
    interior: new THREE.MeshStandardMaterial({
      name: 'roble_interior', color: 0xe8dcc8,
      map: interiorTex,
      normalMap: mapaNormal(THREE, interiorTex, 2.0),
      normalScale: new THREE.Vector2(0.45, 0.45),
      roughness: 0.7, metalness: 0.03
    }),
    blanco: new THREE.MeshStandardMaterial({
      name: 'laca_blanca', color: 0xf7f6f3, roughnessMap: texturaGrano(THREE, rand, [3, 12]),
      normalMap: texturaCascara(THREE, rand, [3, 9]),
      normalScale: new THREE.Vector2(0.18, 0.18),
      roughness: 0.24, metalness: 0.06
    }),
    tirador: new THREE.MeshStandardMaterial({
      name: 'tirador_madera', color: 0x9a6f42, roughness: 0.4, metalness: 0.15
    }),
    aluminio: new THREE.MeshStandardMaterial({
      name: 'barral_aluminio', color: 0xc9cdd2, roughness: 0.3, metalness: 0.4
    }),
    tela: new THREE.MeshStandardMaterial({ name: 'tela', color: 0xdcd7cd, roughness: 0.92 }),
    tela2: new THREE.MeshStandardMaterial({ name: 'tela_gris', color: 0xa9aeb4, roughness: 0.92 }),
    sombra: new THREE.MeshStandardMaterial({ name: 'sombra_junta', color: 0x1a1611, roughness: 0.95 })
  };

  const ropero = new THREE.Group();
  ropero.name = 'ropero_florencia';
  const caja = (n, w, h, d, m, x, y, z, padre) =>
    hacerCaja(THREE, padre || ropero, n, w, h, d, m, x, y, z);

  // ——————————————————————————— cuerpo
  caja('lateral_izq', T, H - 0.022, D, mat.madera, -W / 2 + T / 2, (H - 0.022) / 2, 0);
  caja('lateral_der', T, H - 0.022, D, mat.madera, W / 2 - T / 2, (H - 0.022) / 2, 0);
  caja('tapa', W + 0.012, 0.022, D + 0.026, mat.madera, 0, H - 0.011, 0.006);
  caja('frente_superior', W, CORNISA - 0.022, 0.022, mat.madera,
    0, insideTop + (CORNISA - 0.022) / 2, D / 2 + 0.010);
  caja('zocalo', W, ZOCALO, 0.022, mat.madera, 0, ZOCALO / 2, D / 2 + 0.010);
  caja('piso_interior', innerW, T, D - T, mat.interior, 0, insideBottom - T / 2, 0);
  caja('fondo', innerW, span, 0.010, mat.interior, 0, (insideTop + insideBottom) / 2, -D / 2 + 0.005);

  divX.forEach((x, i) =>
    caja('divisor_' + (i + 1), T, span, inD, mat.interior, x, (insideTop + insideBottom) / 2, inZ));

  // ——————————————————————————— interior, con las alturas del plano
  const estW = colW - T;

  // Columna izquierda: 37 / 48 / 43 / 43 de abajo hacia arriba.
  const yIzq = [];
  let y = insideBottom;
  for (const alto of [0.37, 0.48, 0.43]) {
    y += alto + T;
    yIzq.push(y - T / 2);
  }
  yIzq.forEach((yy, i) =>
    caja('estante_izq_' + (i + 1), estW, T, inD, mat.interior, colCx[0], yy, inZ));

  // Columna central: hueco de 37 abajo, los dos cajones, y 96 de colgado arriba.
  const yBajoCentro = insideBottom + 0.37 + T / 2;
  caja('estante_centro_bajo', estW, T, inD, mat.interior, colCx[1], yBajoCentro, inZ);
  const yColgadoCentro = insideTop - 0.96 - T / 2;
  caja('estante_centro_alto', estW, T, inD, mat.interior, colCx[1], yColgadoCentro, inZ);

  // Cajones entre esos dos estantes.
  const cajonZonaBase = yBajoCentro + T / 2;
  const cajonZonaAlto = yColgadoCentro - T / 2;
  const cajonH = (cajonZonaAlto - cajonZonaBase) / 2 - 0.008;
  for (let i = 0; i < 2; i++) {
    const cy = cajonZonaBase + cajonH / 2 + i * (cajonH + 0.012);
    caja('cajon_' + (i + 1) + '_frente', estW - 0.02, cajonH, 0.018, mat.madera,
      colCx[1], cy, inZ + inD / 2 - 0.01);
    caja('cajon_' + (i + 1) + '_caja', estW - 0.06, cajonH - 0.03, inD - 0.06, mat.interior,
      colCx[1], cy - 0.006, inZ - 0.01);
    // tirador embutido: una ranura oscura en el canto de arriba
    caja('cajon_' + (i + 1) + '_ranura', estW - 0.14, 0.014, 0.01, mat.sombra,
      colCx[1], cy + cajonH / 2 - 0.016, inZ + inD / 2 - 0.001);
  }

  // Columna derecha: 37 / 37 abajo y colgado arriba.
  const yDer = [insideBottom + 0.37 + T / 2];
  yDer.push(yDer[0] + T / 2 + 0.37 + T / 2);
  yDer.forEach((yy, i) =>
    caja('estante_der_' + (i + 1), estW, T, inD, mat.interior, colCx[2], yy, inZ));

  // ——————————————————————————— barrales (centro y derecha)
  // El barral va arriba del hueco de colgado, no en su piso: en el centro el
  // hueco mide 96 cm y arranca en yColgadoCentro, asi que la barra va contra
  // el techo del mueble.
  const barrales = [
    { cx: colCx[1], y: insideTop - 0.075, caida: insideTop - 0.075 - yColgadoCentro - 0.12 },
    { cx: colCx[2], y: insideTop - 0.075, caida: insideTop - 0.075 - yDer[1] - 0.12 }
  ];
  barrales.forEach((b, k) => {
    const bar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.014, 0.014, estW - 0.02, 20), mat.aluminio);
    bar.name = 'barral_' + (k + 1);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(b.cx, b.y, inZ);
    bar.castShadow = true;
    ropero.add(bar);
    for (const s of [-1, 1]) {
      const sop = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.042, 0.026), mat.aluminio);
      sop.name = 'soporte_' + (k + 1) + (s > 0 ? '_der' : '_izq');
      sop.position.set(b.cx + s * (estW / 2 - 0.018), b.y + 0.026, inZ);
      ropero.add(sop);
    }
  });

  if (contenido) {
    barrales.forEach((b, k) => {
      for (let i = 0; i < 4; i++) {
        const gh = b.caida - (i % 2) * 0.09;
        const gx = b.cx - 0.19 + i * 0.125;
        const geo = new THREE.CylinderGeometry(0.05, 0.076, gh, 10, 1);
        geo.scale(1, 1, 0.6);
        const g = new THREE.Mesh(geo, i % 2 ? mat.tela2 : mat.tela);
        g.name = 'prenda_' + (k + 1) + '_' + (i + 1);
        g.position.set(gx, b.y - 0.07 - gh / 2, inZ);
        g.rotation.y = (i % 2 ? 1 : -1) * 0.15;
        g.castShadow = true; g.receiveShadow = true;
        ropero.add(g);
        const p = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.003, 8, 16, Math.PI), mat.aluminio);
        p.name = 'percha_' + (k + 1) + '_' + (i + 1);
        p.position.set(gx, b.y - 0.005, inZ);
        p.rotation.x = Math.PI / 2; p.rotation.z = Math.PI;
        ropero.add(p);
      }
    });
    // ropa doblada en la columna de estantes y calzado abajo
    [insideBottom, ...yIzq].forEach((yBase, j) => {
      for (let s = 0; s < 2 + (j % 2); s++) {
        caja('pila_' + j + '_' + s, 0.36 - s * 0.016, 0.034, 0.26,
          (s + j) % 2 ? mat.tela2 : mat.tela, colCx[0], yBase + T / 2 + 0.019 + s * 0.036, inZ);
      }
    });
    for (let i = 0; i < 2; i++) {
      caja('calzado_' + (i + 1), 0.2, 0.09, 0.28, mat.tela,
        colCx[2] - 0.13 + i * 0.26, insideBottom + 0.045, inZ);
    }
  }

  // ——————————————————————————— 6 puertas batientes en 3 pares
  const doorSpan = W - 0.012;
  const paso = doorSpan / 6;
  const doorW = paso - 0.008;
  const doorTop = insideTop - 0.004;
  const doorBot = ZOCALO + 0.004;
  const doorH = doorTop - doorBot;
  const doorY = (doorTop + doorBot) / 2;
  const doorZ = D / 2 + doorT / 2 + 0.002;

  // Hace que las juntas entre hojas se lean como lineas oscuras con el mueble
  // cerrado. Se oculta mientras las puertas estan abiertas: si no, tapa el
  // interior justo cuando se lo quiere mostrar.
  const junta = caja('sombra_juntas', W - 0.008, doorH + 0.008, 0.005, mat.sombra,
    0, doorY, D / 2 - 0.004);

  const hojas = [];
  for (let i = 0; i < 6; i++) {
    const cx = -doorSpan / 2 + paso * (i + 0.5);
    const izq = i % 2 === 0;
    const lado = izq ? -1 : 1;
    // El eje se corre medio espesor hacia afuera para que las hojas de dos
    // modulos contiguos no se atraviesen al abrir.
    const pivotX = cx + lado * (doorW / 2 + doorT / 2);
    const localX = -lado * (doorW / 2 + doorT / 2);
    const esExtremo = i === 0 || i === 5;

    const g = new THREE.Group();
    g.name = 'puerta_' + (i + 1);
    g.position.set(pivotX, doorY, doorZ);

    caja('puerta_' + (i + 1) + '_hoja', doorW, doorH, doorT,
      esExtremo ? mat.madera : mat.blanco, localX, 0, 0, g);

    if (esExtremo) {
      // Listones verticales: el detalle que distingue al Florencia de frente.
      // Medias cañas verticales. El eje del cilindro ya es Y, asi que no se
      // rota nada: el semicirculo se orienta con thetaStart para que la parte
      // redondeada mire hacia adelante (+Z).
      const n = 7, sep = doorW / n;
      for (let k = 0; k < n; k++) {
        const geo = new THREE.CylinderGeometry(
          0.011, 0.011, doorH - 0.02, 10, 1, false, -Math.PI / 2, Math.PI);
        const l = new THREE.Mesh(geo, mat.madera);
        l.name = 'puerta_' + (i + 1) + '_liston_' + (k + 1);
        l.position.set(localX - doorW / 2 + sep * (k + 0.5), 0, doorT / 2);
        l.castShadow = true; l.receiveShadow = true;
        g.add(l);
      }
    } else {
      const tx = localX - lado * (doorW / 2 - 0.04);
      const t = new THREE.Mesh(new THREE.CapsuleGeometry(0.0095, 0.30, 8, 18), mat.tirador);
      t.name = 'puerta_' + (i + 1) + '_tirador';
      t.position.set(tx, 0.06, doorT / 2 + 0.016);
      t.castShadow = true;
      g.add(t);
      for (const s of [-1, 1]) {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.016, 12), mat.tirador);
        p.name = 'puerta_' + (i + 1) + '_soporte' + (s > 0 ? '_sup' : '_inf');
        p.rotation.x = Math.PI / 2;
        p.position.set(tx, 0.06 + s * 0.14, doorT / 2 + 0.008);
        g.add(p);
      }
    }

    for (const hy of [-doorH / 2 + 0.16, 0, doorH / 2 - 0.16]) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.045, 10), mat.aluminio);
      b.name = 'puerta_' + (i + 1) + '_bisagra';
      b.position.set(-lado * 0.016, hy, -doorT / 2 - 0.004);
      g.add(b);
    }

    ropero.add(g);
    hojas.push({ g, dir: izq ? -1 : 1, orden: Math.abs(i - 2.5) });
  }

  // Para AR: nace abierto y sin la placa de juntas, que con las hojas corridas
  // quedaria delante del interior.
  if (abierto) {
    abrirBatientes(THREE, hojas);
    junta.visible = false;
  }

  return { grupo: ropero, mats: mat, hojas, junta, setColor: () => true, medidas: { W, H, D } };
}

/** `alCambiar(abierto)` — ver la nota en initRoperoBerlim. */
export async function initFlorencia(stage, btn, alCambiar) {
  const { THREE } = await stage.ready;
  const { grupo, hojas, junta } = construirFlorencia(THREE);
  const { H } = MEDIDAS;

  const animar = animarBatientes(THREE, hojas);
  const setPuertas = (abrir) => {
    if (abrir) junta.visible = false;
    animar(abrir, () => { if (!abrir) junta.visible = true; });
  };

  let abierto = false;
  function toggle() {
    abierto = !abierto;
    setPuertas(abierto);
    if (btn) btn.textContent = abierto ? 'Cerrar puertas' : 'Abrir puertas';
    if (alCambiar) alCambiar(abierto);
    return abierto;
  }
  if (btn) btn.addEventListener('click', toggle);

  stage.setObject(grupo);
  const vistas = encuadrador(THREE, stage, grupo, H);
  ambienteDormitorio(THREE, stage, 0.22);

  return { grupo, toggle, setDoors: setPuertas, colores: COLORES, setColor: () => true, ...vistas };
}
