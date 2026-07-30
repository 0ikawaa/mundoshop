/**
 * Lanzador de realidad aumentada, sin librerias.
 *
 * No usa <model-viewer>: esa libreria pesa cerca de 1 MB porque trae su propio
 * three.js, y nosotros ya tenemos un visor 3D en la pagina. Lo unico que hace
 * falta es abrir el visor AR nativo de cada plataforma, y eso son dos links.
 *
 *   iPhone / iPad  -> AR Quick Look, via <a rel="ar"> apuntando a un .usdz
 *   Android        -> Scene Viewer, via intent:// apuntando a un .glb
 *
 * Dos detalles que importan para muebles:
 *   - `resizable=false` (Scene Viewer) y `#allowsContentScaling=0` (Quick Look)
 *     bloquean el pellizco para agrandar. El mueble se ve a escala real, que es
 *     justamente el motivo de mostrarlo en AR.
 *   - Safari solo dispara Quick Look si el <a rel="ar"> tiene un <img> adentro.
 *     Sin esa imagen el link no hace nada.
 */

/** 'ios' | 'android' | null */
export function plataformaAR() {
  const ua = navigator.userAgent || '';
  const iOS = /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS 13+ se hace pasar por Mac; se distingue por el touch
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (iOS) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return null;
}

function urlAbsoluta(ruta) {
  return new URL(ruta, location.href).href;
}

function urlSceneViewer(glb, titulo) {
  const params = new URLSearchParams({
    file: urlAbsoluta(glb),
    mode: 'ar_preferred',
    resizable: 'false',
    title: titulo
  });
  return 'intent://arvr.google.com/scene-viewer/1.0?' + params.toString() +
    '#Intent;scheme=https;package=com.google.ar.core;action=android.intent.action.VIEW;' +
    'S.browser_fallback_url=' + encodeURIComponent(location.href) + ';end;';
}

/**
 * Monta el control de AR dentro de `contenedor`.
 *
 * `modelo` es { color: { glb, usdz, abierto?: { glb, usdz } } }. El par de
 * arriba es el mueble cerrado y `abierto` el mismo mueble con las puertas ya
 * corridas.
 *
 * Por que dos archivos y no uno que se abra: Quick Look y Scene Viewer son
 * visores del sistema operativo. Reciben un archivo, lo apoyan en el piso y
 * dejan girarlo, pero no hay manera de mandarles un toque sobre una parte del
 * modelo ni de pedirles que reproduzcan algo a demanda. Lo unico que se puede
 * elegir es cual de los dos archivos se abre, y eso se decide antes de salir
 * de la pagina.
 *
 * Devuelve { plataforma, setColor, setAbierto } — los dos setters cambian a
 * que archivo apunta el link.
 */
export function montarAR({ contenedor, modelo, titulo = '', clase = '', alSinSoporte }) {
  const plataforma = plataformaAR();
  let color = Object.keys(modelo)[0];
  let abierto = false;

  if (!plataforma) {
    if (alSinSoporte) alSinSoporte(contenedor);
    return {
      plataforma: null,
      setColor: (c) => { color = c; },
      setAbierto: (a) => { abierto = a; },
    };
  }

  const etiqueta = 'Ver en tu ambiente';
  let control;

  if (plataforma === 'ios') {
    control = document.createElement('a');
    control.rel = 'ar';
    // Safari exige un <img> adentro para disparar Quick Look.
    const img = document.createElement('img');
    img.alt = '';
    img.width = 1; img.height = 1;
    img.style.cssText = 'width:1px;height:1px;opacity:0;position:absolute;pointer-events:none';
    img.src = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
    control.appendChild(img);
    control.appendChild(document.createTextNode(etiqueta));
  } else {
    control = document.createElement('a');
    control.appendChild(document.createTextNode(etiqueta));
  }

  control.className = clase;
  contenedor.appendChild(control);

  function actualizar() {
    const m = modelo[color];
    // Si un producto todavia no tiene exportado el par abierto, cae al cerrado
    // en vez de apuntar a un 404.
    const archivos = (abierto && m.abierto) ? m.abierto : m;
    control.href = plataforma === 'ios'
      ? urlAbsoluta(archivos.usdz) + '#allowsContentScaling=0'
      : urlSceneViewer(archivos.glb, titulo);
  }

  function setColor(c) {
    if (modelo[c]) color = c;
    actualizar();
  }

  function setAbierto(a) {
    abierto = !!a;
    actualizar();
  }

  actualizar();

  return { plataforma, setColor, setAbierto, control };
}
