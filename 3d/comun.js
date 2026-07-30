/**
 * Piezas compartidas por todos los modelos de muebles.
 *
 * Cada producto solo describe su geometria; las texturas procedurales, el
 * encuadre de camara y las animaciones de puertas viven aca.
 *
 * Regla que atraviesa todo el archivo: una malla, un material simple.
 * USDZExporter descarta en silencio las mallas con array de materiales, asi
 * que los cantos y detalles van siempre como mallas propias.
 */

/** PRNG con semilla: la veta sale igual en cada corrida, asi el GLB exportado
 *  no cambia byte a byte cada vez que se regenera. */
export function rng(semilla) {
  let s = semilla >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Veta de madera sobre un color base. `veta` va como "r,g,b". */
export function texturaMadera(THREE, rand, baseHex, veta, repeticiones = [1, 1]) {
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
  for (let i = 0; i < 5; i++) {                  // nudos suaves
    const kx = rand() * 512, ky = rand() * 512;
    const g = x.createRadialGradient(kx, ky, 2, kx, ky, 26 + rand() * 26);
    g.addColorStop(0, `rgba(${veta},0.30)`); g.addColorStop(1, `rgba(${veta},0)`);
    x.fillStyle = g; x.beginPath(); x.arc(kx, ky, 52, 0, Math.PI * 2); x.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeticiones[0], repeticiones[1]);
  return tex;
}

/** Micro-textura mate para frentes lisos: va como roughnessMap. */
export function texturaGrano(THREE, rand, repeticiones = [6, 24]) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const x = c.getContext('2d');
  const img = x.createImageData(256, 256), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = 236 + rand() * 19;
    d[i] = d[i + 1] = d[i + 2] = n; d[i + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeticiones[0], repeticiones[1]);
  return tex;
}

/** Caja con nombre, material y posicion. Devuelve la malla. */
export function hacerCaja(THREE, padre, nombre, w, h, d, material, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.name = nombre;
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  padre.add(m);
  return m;
}

/**
 * Encuadre de camara para muebles: objetos anchos, planos y apoyados en el piso.
 *
 * El auto-frame del stage usa la esfera envolvente y los deja diminutos. Aca se
 * proyectan las ocho esquinas de la caja y se itera la distancia hasta que
 * entren con aire. Se usa lente de 30 grados: con los 45 por defecto la fuga
 * es exagerada y no parece foto de producto.
 */
export function encuadrador(THREE, stage, grupo, alto) {
  // Poca altura: mirar el mueble desde arriba lo achata y, cuando tiene espejo,
  // hace que refleje el piso en vez de la habitacion.
  const VISTA_3_4 = new THREE.Vector3(0.55, 0.17, 1);
  const VISTA_FRONTAL = new THREE.Vector3(0, 0.06, 1);
  const AIRE = 0.86;
  let vistaActual = VISTA_3_4;
  let tocado = false;

  const caja = new THREE.Box3().setFromObject(grupo);
  const esquinas = [];
  for (const x of [caja.min.x, caja.max.x])
    for (const y of [caja.min.y, caja.max.y])
      for (const z of [caja.min.z, caja.max.z])
        esquinas.push(new THREE.Vector3(x, y, z));

  function encuadrar(dir) {
    const cam = stage._camera, ctl = stage._controls;
    if (!cam || !ctl) return;
    if (dir) vistaActual = dir;
    const d = vistaActual.clone().normalize();
    const objetivo = new THREE.Vector3(0, alto * 0.47, 0);
    cam.fov = 30;
    cam.near = 0.05;
    cam.far = 80;

    let dist = (alto / 2) / Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2) * 1.15;
    for (let i = 0; i < 20; i++) {
      cam.position.copy(objetivo).add(d.clone().multiplyScalar(dist));
      cam.lookAt(objetivo);
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

    ctl.target.copy(objetivo);
    ctl.minDistance = alto * 0.7;
    ctl.maxDistance = alto * 10;
    ctl.maxPolarAngle = Math.PI * 0.53;      // no meterse debajo del piso
    ctl.update();
  }

  encuadrar(VISTA_3_4);
  stage._controls && stage._controls.addEventListener('start', () => { tocado = true; });
  new ResizeObserver(() => { if (!tocado) encuadrar(); }).observe(stage);

  return {
    encuadrar,
    vistaFrontal: () => { tocado = false; encuadrar(VISTA_FRONTAL); },
    vistaInicial: () => { tocado = false; encuadrar(VISTA_3_4); }
  };
}

/** Ambiente difuso de dormitorio: da reflejos suaves sin cargar un HDR. */
export function ambienteDormitorio(THREE, stage, intensidad = 0.55) {
  const escena = stage._scene, render = stage._renderer;
  if (!escena || !render) return null;
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#f7f4ee');
  grad.addColorStop(0.48, '#e9e2d6');
  grad.addColorStop(0.52, '#cdc3b4');
  grad.addColorStop(1, '#a49a8c');
  g.fillStyle = grad; g.fillRect(0, 0, 512, 256);
  g.fillStyle = 'rgba(255,255,255,0.88)'; g.fillRect(118, 38, 96, 74);   // ventana
  g.fillStyle = 'rgba(120,105,90,0.32)'; g.fillRect(300, 150, 150, 60);  // cama difusa
  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(render);
  escena.environment = pmrem.fromEquirectangular(tex).texture;
  escena.environmentIntensity = intensidad;
  pmrem.dispose();
  return escena.environment;
}

/**
 * Puertas batientes: cada hoja gira sobre su eje, escalonadas del centro hacia
 * afuera. `hojas` son { g, dir, orden } como las arma cada modelo.
 */
export function animarBatientes(THREE, hojas, { grados = 105, dur = 1050, paso = 90 } = {}) {
  const ABIERTO = THREE.MathUtils.degToRad(grados);
  let anim = null;
  return function setPuertas(abrir, alTerminar) {
    const t0 = performance.now();
    const desde = hojas.map(h => h.g.rotation.y);
    const total = dur + paso * Math.max(...hojas.map(h => h.orden));
    if (anim) cancelAnimationFrame(anim);
    const tick = (ahora) => {
      const t = ahora - t0;
      hojas.forEach((h, i) => {
        const pr = Math.min(1, Math.max(0, (t - h.orden * paso) / dur));
        const e = pr < 0.5 ? 4 * pr * pr * pr : 1 - Math.pow(-2 * pr + 2, 3) / 2;
        const fin = abrir ? h.dir * ABIERTO : 0;
        h.g.rotation.y = desde[i] + (fin - desde[i]) * e;
      });
      if (t < total) anim = requestAnimationFrame(tick);
      else if (alTerminar) alTerminar();
    };
    anim = requestAnimationFrame(tick);
  };
}

/**
 * Puertas corredizas: cada hoja se desplaza en x entre `cerrada` y `abierta`.
 */
export function animarCorredizas(hojas, { dur = 900 } = {}) {
  let anim = null;
  return function setPuertas(abrir, alTerminar) {
    const t0 = performance.now();
    const desde = hojas.map(h => h.g.position.x);
    if (anim) cancelAnimationFrame(anim);
    const tick = (ahora) => {
      const p = Math.min(1, (ahora - t0) / dur);
      const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      hojas.forEach((h, i) => {
        const fin = abrir ? h.abierta : h.cerrada;
        h.g.position.x = desde[i] + (fin - desde[i]) * e;
      });
      if (p < 1) anim = requestAnimationFrame(tick);
      else if (alTerminar) alTerminar();
    };
    anim = requestAnimationFrame(tick);
  };
}

/**
 * Panorama equirectangular de un showroom, para usar como envMap del espejo.
 *
 * Por que un panorama y no un reflejo calculado: un `Reflector` de verdad
 * necesita una habitacion delante del espejo, y esa habitacion se veria al
 * girar el mueble. Y una textura pintada plana no sirve porque queda clavada:
 * no cambia al mover la camara y se nota que es un dibujo.
 *
 * Un envMap equirectangular sobre una superficie especular si responde: cada
 * punto de la hoja refleja una direccion distinta y el reflejo se desplaza al
 * orbitar, que es lo que hace que el ojo lo lea como espejo.
 *
 * La escena se dibuja en coordenadas equirectangulares: el eje horizontal es
 * el azimut (una vuelta completa) y el vertical va de cenit a nadir. Por eso
 * cada objeto se ubica por el angulo desde el que se lo quiere ver.
 */
export function panoramaShowroom(THREE, rand) {
  const W = 2048, H = 1024;
  const VUELTAS = 4;                       // el showroom se repite cada 90 grados
  const TW = W / VUELTAS;

  // Se dibuja un solo modulo de 90 grados y despues se estampa cuatro veces.
  // Perseguir un azimut exacto para que el cartel caiga en el reflejo es
  // fragil: basta que la camara se mueva un poco para perderlo. Repitiendo el
  // modulo siempre hay un cartel y algo de mobiliario cerca, se mire de donde
  // se mire.
  const c = document.createElement('canvas');
  c.width = TW; c.height = H;
  const x = c.getContext('2d');

  const HORIZONTE = H * 0.52;
  const az = (v) => v * TW;                // 0..1 del modulo -> pixeles

  // Techo, pared y piso.
  const cielo = x.createLinearGradient(0, 0, 0, HORIZONTE);
  cielo.addColorStop(0, '#fbfaf7');
  cielo.addColorStop(0.55, '#f0ece4');
  cielo.addColorStop(1, '#e4ded2');
  x.fillStyle = cielo; x.fillRect(0, 0, TW, HORIZONTE);

  const piso = x.createLinearGradient(0, HORIZONTE, 0, H);
  piso.addColorStop(0, '#cbbda6');
  piso.addColorStop(0.4, '#b8a68c');
  piso.addColorStop(1, '#8d7c65');
  x.fillStyle = piso; x.fillRect(0, HORIZONTE, TW, H - HORIZONTE);

  // Escala: un espejo plano de medio metro visto desde tres metros y medio
  // refleja apenas unos ocho grados de entorno, o sea un recorte de unos
  // 45 x 90 px de este panorama. Si los objetos se dibujan grandes, el espejo
  // devuelve un plano liso de un solo color. Por eso van chicos y juntos, en
  // una banda angosta a caballo del horizonte, que es lo unico que alcanza.

  // ——— ventana con luz: es lo que mas se nota en un reflejo
  const vx = az(0.06), vw = 110, vy = HORIZONTE - 78, vh = 132;
  const luz = x.createLinearGradient(vx, vy, vx, vy + vh);
  luz.addColorStop(0, '#ffffff');
  luz.addColorStop(1, '#e9f1fb');
  x.fillStyle = luz; x.fillRect(vx, vy, vw, vh);
  x.strokeStyle = 'rgba(135,138,150,0.55)'; x.lineWidth = 4;
  x.strokeRect(vx, vy, vw, vh);
  x.beginPath();
  x.moveTo(vx + vw / 2, vy); x.lineTo(vx + vw / 2, vy + vh);
  x.moveTo(vx, vy + vh / 2); x.lineTo(vx + vw, vy + vh / 2);
  x.stroke();
  const derrame = x.createRadialGradient(vx + vw / 2, vy + vh / 2, 20, vx + vw / 2, vy + vh / 2, 260);
  derrame.addColorStop(0, 'rgba(255,255,255,0.5)');
  derrame.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = derrame;
  x.fillRect(vx - 260, vy - 200, vw + 520, vh + 400);

  // ——— atriles de Mundo Shop, parados en el piso del showroom
  // Apoyados y no colgados: la banda que el espejo alcanza a reflejar cae sobre
  // el piso, asi que un cartel a dos metros de altura no se veria nunca.
  // Van dos, en paredes opuestas, para que se vea uno sin depender del angulo
  // exacto desde el que se mire el mueble. El texto va espejado, que es como se
  // lee en un espejo de verdad.
  {
    const lx = az(0.50) - 59, ly = HORIZONTE - 44, lw = 118, lh = 92;
    x.fillStyle = 'rgba(60,50,40,0.18)';
    x.beginPath(); x.ellipse(lx + lw / 2, ly + lh + 7, lw * 0.6, 9, 0, 0, Math.PI * 2); x.fill();

    x.save();
    x.translate(lx + lw / 2, ly + lh / 2);
    x.scale(-1, 1);
    x.translate(-(lx + lw / 2), -(ly + lh / 2));
    x.fillStyle = '#041e7d';
    x.beginPath(); x.roundRect(lx, ly, lw, lh, 11); x.fill();
    x.fillStyle = '#ffffff';
    x.beginPath(); x.roundRect(lx + 14, ly + 24, 56, 11, 5.5); x.fill();
    x.fillStyle = '#fae307';
    x.beginPath(); x.roundRect(lx + 14, ly + 48, 36, 11, 5.5); x.fill();
    x.fillStyle = '#ffffff';
    x.font = 'bold 15px Inter, Arial, sans-serif';
    x.textBaseline = 'middle';
    x.fillText('MUNDO', lx + 76, ly + 30);
    x.fillStyle = '#fae307';
    x.font = 'bold 12px Inter, Arial, sans-serif';
    x.fillText('SHOP', lx + 76, ly + 54);
    x.restore();
  }

  // ——— cama con respaldo, a caballo del horizonte
  x.fillStyle = 'rgba(122,96,66,0.85)';
  x.fillRect(az(0.68), HORIZONTE - 62, 140, 70);
  x.fillStyle = 'rgba(247,243,235,0.95)';
  x.fillRect(az(0.665), HORIZONTE + 6, 160, 48);
  x.fillStyle = 'rgba(210,196,174,0.9)';
  x.fillRect(az(0.665), HORIZONTE + 44, 160, 22);
  x.fillStyle = 'rgba(255,253,248,0.95)';
  x.fillRect(az(0.695), HORIZONTE - 16, 46, 22);
  x.fillRect(az(0.795), HORIZONTE - 16, 46, 22);

  // ——— velador encendido, entre el cartel y la cama
  const vel = x.createRadialGradient(az(0.625), HORIZONTE - 20, 4, az(0.625), HORIZONTE - 20, 58);
  vel.addColorStop(0, 'rgba(255,238,198,0.95)');
  vel.addColorStop(1, 'rgba(255,238,198,0)');
  x.fillStyle = vel;
  x.beginPath(); x.arc(az(0.625), HORIZONTE - 20, 58, 0, Math.PI * 2); x.fill();

  // ——— cuadro enmarcado
  x.fillStyle = '#e9e2d4'; x.fillRect(az(0.29), HORIZONTE - 92, 58, 78);
  x.strokeStyle = '#8b7350'; x.lineWidth = 5;
  x.strokeRect(az(0.29), HORIZONTE - 92, 58, 78);
  x.fillStyle = 'rgba(118,138,158,0.5)';
  x.fillRect(az(0.29) + 9, HORIZONTE - 74, 40, 44);

  // ——— planta
  x.fillStyle = 'rgba(96,116,78,0.8)';
  for (let i = 0; i < 10; i++) {
    const bx = az(0.92) + (rand() - 0.5) * 62;
    const by = HORIZONTE + 6 - rand() * 82;
    x.beginPath(); x.ellipse(bx, by, 16, 9, rand() * Math.PI, 0, Math.PI * 2); x.fill();
  }
  x.fillStyle = 'rgba(186,170,146,0.9)';
  x.fillRect(az(0.92) - 20, HORIZONTE + 6, 40, 42);

  // ——— banqueta baja, para llenar el tramo entre el cuadro y el cartel
  x.fillStyle = 'rgba(176,158,134,0.85)';
  x.fillRect(az(0.38), HORIZONTE - 6, 78, 46);

  // ——— alfombra
  x.fillStyle = 'rgba(226,218,203,0.55)';
  x.beginPath(); x.ellipse(az(0.62), HORIZONTE + 120, 210, 55, 0, 0, Math.PI * 2); x.fill();

  // Desenfoque suave: el espejo de un mueble nunca devuelve una foto nitida, y
  // ademas disimula que la escena esta hecha de rectangulos. Poco, porque a
  // esta escala un blur fuerte se come los objetos enteros.
  x.filter = 'blur(2px)';
  x.drawImage(c, 0, 0);
  x.filter = 'none';

  // Grano fino para sacarle el aspecto de degrade limpio.
  const img = x.getImageData(0, 0, TW, H), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rand() - 0.5) * 6;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  x.putImageData(img, 0, 0);

  // Estampado del modulo alrededor de toda la vuelta.
  const pano = document.createElement('canvas');
  pano.width = W; pano.height = H;
  const px = pano.getContext('2d');
  for (let i = 0; i < VUELTAS; i++) px.drawImage(c, i * TW, 0);

  const tex = new THREE.CanvasTexture(pano);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Espejo: superficie especular que refleja el panorama del showroom.
 *
 * Al exportar a GLB o USDZ el envMap no viaja — glTF no tiene mapa de entorno
 * por material — asi que en AR queda como metal pulido y toma el entorno real
 * que estima el telefono. Para AR eso es mejor que cualquier reflejo pintado.
 */
export function materialEspejo(THREE, rand) {
  return new THREE.MeshStandardMaterial({
    name: 'espejo',
    color: 0xf2f4f6,
    metalness: 1.0,
    roughness: 0.035,
    envMap: panoramaShowroom(THREE, rand),
    envMapIntensity: 1.15
  });
}
