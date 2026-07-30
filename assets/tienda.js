/**
 * Comportamientos compartidos de la tienda. Vanilla a proposito: todo esto son
 * unas pocas decenas de lineas, y meter una libreria de carrusel o de lightbox
 * costaria mas kilobytes que el visor 3D entero.
 */

/* --- Galeria: foto principal + miniaturas --------------------------------- */
export function montarGaleria({ principal, tira, fotos, alAbrir }) {
  let actual = 0;

  fotos.forEach((f, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-label', `Ver foto ${i + 1}: ${f.alt}`);
    if (i === 0) b.setAttribute('aria-current', 'true');
    const img = document.createElement('img');
    img.src = f.mini;
    img.alt = '';
    img.loading = 'lazy';
    img.decoding = 'async';
    b.appendChild(img);
    b.addEventListener('click', () => mostrar(i));
    tira.appendChild(b);
  });

  function mostrar(i) {
    actual = i;
    principal.src = fotos[i].src;
    principal.alt = fotos[i].alt;
    tira.querySelectorAll('button').forEach((b, j) => {
      if (j === i) b.setAttribute('aria-current', 'true');
      else b.removeAttribute('aria-current');
    });
  }

  principal.addEventListener('click', () => alAbrir && alAbrir(actual));
  return { mostrar, indice: () => actual };
}

/* --- Lightbox ------------------------------------------------------------- */
export function montarLightbox(fotos) {
  const lb = document.createElement('div');
  lb.className = 'lightbox';
  lb.setAttribute('role', 'dialog');
  lb.setAttribute('aria-modal', 'true');
  lb.setAttribute('aria-label', 'Galeria de fotos');
  lb.innerHTML = `
    <button class="lightbox__cerrar" type="button" aria-label="Cerrar">&times;</button>
    <button class="lightbox__nav prev" type="button" aria-label="Anterior">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
    </button>
    <img alt="">
    <button class="lightbox__nav next" type="button" aria-label="Siguiente">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
    </button>
    <p class="lightbox__cuenta"></p>`;
  document.body.appendChild(lb);

  const img = lb.querySelector('img');
  const cuenta = lb.querySelector('.lightbox__cuenta');
  let i = 0, ultimoFoco = null;

  const pintar = () => {
    img.src = fotos[i].src;
    img.alt = fotos[i].alt;
    cuenta.textContent = `${i + 1} / ${fotos.length}`;
  };
  const mover = (d) => { i = (i + d + fotos.length) % fotos.length; pintar(); };

  function abrir(n) {
    i = n; pintar();
    ultimoFoco = document.activeElement;
    lb.classList.add('abierto');
    document.body.style.overflow = 'hidden';
    lb.querySelector('.lightbox__cerrar').focus();
  }
  function cerrar() {
    lb.classList.remove('abierto');
    document.body.style.overflow = '';
    if (ultimoFoco) ultimoFoco.focus();
  }

  lb.querySelector('.lightbox__cerrar').addEventListener('click', cerrar);
  lb.querySelector('.prev').addEventListener('click', () => mover(-1));
  lb.querySelector('.next').addEventListener('click', () => mover(1));
  // Clic en el fondo cierra; clic en la foto o en un boton, no.
  lb.addEventListener('click', (e) => { if (e.target === lb) cerrar(); });
  document.addEventListener('keydown', (e) => {
    if (!lb.classList.contains('abierto')) return;
    if (e.key === 'Escape') cerrar();
    if (e.key === 'ArrowLeft') mover(-1);
    if (e.key === 'ArrowRight') mover(1);
  });

  return { abrir, cerrar };
}

/* --- Aparicion al scrollear ----------------------------------------------- */
export function montarRevelar(selector = '.revelar') {
  const items = document.querySelectorAll(selector);
  if (!items.length) return;
  if (!('IntersectionObserver' in window) ||
      matchMedia('(prefers-reduced-motion: reduce)').matches) {
    items.forEach(el => el.classList.add('visible'));
    return;
  }
  const io = new IntersectionObserver((entradas) => {
    entradas.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('visible');
      io.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.05 });
  items.forEach(el => io.observe(el));
}

/* --- Barra de compra fija en celular --------------------------------------
   Aparece recien cuando los botones reales se fueron de pantalla, para no
   tapar la ficha ni duplicar el CTA mientras se ve. */
export function montarBarraFija({ barra, referencia }) {
  if (!barra || !referencia || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver(([e]) => {
    barra.classList.toggle('visible', !e.isIntersecting && e.boundingClientRect.top < 0);
  }, { threshold: 0 });
  io.observe(referencia);
}

/* --- Descargar la foto del visor ------------------------------------------
   El visor no saca una captura de pantalla: vuelve a renderizar el encuadre al
   doble de resolucion y con el doble de muestras, o sea que la imagen que se
   baja es mejor que la que se esta viendo. Tarda unos segundos y por eso el
   boton avisa; mientras tanto queda deshabilitado, que si no se dispara dos
   veces y el segundo render pisa al primero. */
export function montarFoto({ boton, stage }) {
  if (!boton || !stage) return;
  const texto = boton.lastChild;
  const original = texto.textContent;
  boton.addEventListener('click', async () => {
    boton.disabled = true;
    texto.textContent = ' Renderizando…';
    try {
      await stage.foto(2, {
        alAvanzar: (p) => { texto.textContent = ` Renderizando ${Math.round(p * 100)} %`; }
      });
    } catch (e) {
      console.error(e);
      texto.textContent = ' No se pudo generar';
      setTimeout(() => { texto.textContent = original; }, 2500);
      boton.disabled = false;
      return;
    }
    texto.textContent = original;
    boton.disabled = false;
  });
}

/* --- Carrito (maqueta) ----------------------------------------------------
   Todavia no hay checkout: esto solo mantiene el contador coherente para que
   la ficha se vea completa. */
export function montarCarrito({ contador, botones }) {
  let n = 0;
  const pintar = () => {
    contador.textContent = n;
    contador.hidden = n === 0;
  };
  pintar();
  (botones || []).forEach(b => b.addEventListener('click', () => { n++; pintar(); }));
}
