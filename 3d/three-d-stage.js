// Visor 3D de Mundo Shop. Nacio como el starter <three-d-stage> y se fue
// separando: hoy el corazon es un renderizador progresivo propio, asi que
// volver a copiar el starter encima pisaria todo el motor.
/* BEGIN USAGE */
/**
 * <three-d-stage> — visor 3D con render progresivo (three.js).
 *
 * El stage es dueno de toda la escena: renderer, iluminacion de estudio,
 * OrbitControls, sombra de piso, encuadre automatico segun el bounding box y
 * una barra de descarga que exporta el objeto como OBJ + MTL o GLB.
 *
 * three.js entra por el import map de la pagina. Va este mapa exacto en el
 * <head>, antes de cualquier modulo:
 *
 *   <script type="importmap">
 *   {
 *     "imports": {
 *       "three": "https://unpkg.com/three@0.184.0/build/three.module.js",
 *       "three/addons/controls/OrbitControls.js": "https://unpkg.com/three@0.184.0/examples/jsm/controls/OrbitControls.js",
 *       "three/addons/exporters/OBJExporter.js": "https://unpkg.com/three@0.184.0/examples/jsm/exporters/OBJExporter.js",
 *       "three/addons/exporters/GLTFExporter.js": "https://unpkg.com/three@0.184.0/examples/jsm/exporters/GLTFExporter.js"
 *     }
 *   }
 *   </script>
 *
 * Uso:
 *   <style>three-d-stage:not(:defined){visibility:hidden}</style>
 *   <three-d-stage name="ropero" background="#ffffff" limpio></three-d-stage>
 *   <script src="three-d-stage.js"></script>
 *   <script type="module">
 *     const stage = document.querySelector('three-d-stage');
 *     const { THREE } = await stage.ready;
 *     stage.setObject(grupo);              // en metros, y-up, apoyado en y=0
 *   </script>
 *
 * Atributos:
 *   name        — nombre base de los archivos exportados (default "model")
 *   background  — color CSS detras de la escena (default un papel calido)
 *   limpio      — sin ayuda superpuesta ni botones de descarga (modo tienda)
 *   autorotate  — vuelta lenta hasta que el visitante toca
 *   apertura    — diametro de lente para la profundidad de campo, en metros
 *   muestras    — cuadros a acumular (default 64 en escritorio, 26 en celular)
 *
 * API extra:
 *   stage.invalidar()      — reinicia la acumulacion a mano
 *   stage.foto(escala)     — baja un PNG del encuadre actual a escala x
 *
 * ——— Como rinde
 *
 * La escena no se dibuja una vez: se dibuja N veces moviendo apenas el sol, el
 * cielo, la lente y el pixel, y se promedian los cuadros. Es integracion Monte
 * Carlo, la misma idea de un motor offline, y de ahi salen de una sola vez
 * cuatro cosas que un visor comun no tiene:
 *
 *   · sombras con penumbra de verdad (el sol es un disco, no un punto)
 *   · oclusion ambiental correcta — el cielo se muestrea direccion por
 *     direccion con sombra, asi que los rincones se oscurecen solos
 *   · antialias muy por encima del MSAA, porque cada muestra cae en un punto
 *     distinto del pixel
 *   · profundidad de campo real, con la lente abierta sobre el plano de foco
 *
 * Mientras el visitante arrastra se muestra la muestra 0, que es un render
 * comun y responde a 60 cuadros. Al soltar, la imagen se afina sola en menos de
 * un segundo y despues el bucle deja de dibujar: converger cuesta menos bateria
 * que quedarse girando en vano.
 *
 * Nadie llama a invalidar() a mano. Cada cuadro se calcula una firma barata de
 * la camara y de las mallas (posicion, giro, color) y si cambio se reinicia la
 * acumulacion: abrir las puertas o cambiar el color se detecta solo.
 *
 * Tono: Khronos PBR Neutral, el mapeo pensado para fichas de producto — comprime
 * las altas luces sin virar los colores, que en un mueble beige se notaria.
 * El fondo no pasa por el tono: se compone despues, para que el blanco de la
 * escena sea exactamente el blanco de la pagina.
 */
/* END USAGE */

(() => {
  const stylesheet = `
    :host {
      position: relative;
      display: block;
      width: 100%;
      height: 100vh;
      background: var(--stage-bg, #f0eee6);
      overflow: hidden;
    }
    canvas { display: block; outline: none; }
    .toolbar {
      position: absolute;
      right: 16px;
      bottom: 16px;
      display: flex;
      gap: 8px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .toolbar button {
      appearance: none;
      border: 1px solid rgba(20, 20, 19, 0.18);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.92);
      color: #1a1915;
      font-family: inherit;
      font-size: 12.5px;
      font-weight: 500;
      line-height: 1;
      padding: 9px 12px;
      cursor: default;
    }
    .toolbar button:hover { background: #fff; }
    .toolbar button:active { transform: translateY(1px); }
    .toolbar button[disabled] { opacity: 0.5; pointer-events: none; }
    .note {
      position: absolute;
      left: 16px;
      bottom: 16px;
      max-width: 60%;
      font: 400 12px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: rgba(26, 25, 21, 0.55);
      user-select: none;
    }
    .err {
      position: absolute;
      inset: 0;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 24px;
      font: 500 14px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #8a2f20;
      text-align: center;
      white-space: pre-line;
    }
  `;

  function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  /** Tell the host an export attempt settled — telemetry only. The host
   *  (HTMLViewer) verifies the source and re-reads these fields defensively
   *  before counting; nothing else crosses the frame boundary. Guarded so
   *  telemetry can never break the download path. */
  function notifyExport(format, ok) {
    try {
      window.parent.postMessage(
        { type: 'omelette:notify-3d-export', format: format, ok: ok === true },
        '*'
      );
    } catch (e) {}
  }

  /**
   * Serie de Halton: la secuencia de baja discrepancia con la que se eligen los
   * puntos de cada muestra.
   *
   * Con numeros al azar el promedio tambien converge, pero se apelmaza — hacen
   * falta muchisimas mas muestras para que la sombra deje de hervir. Halton
   * reparte parejo desde la primera decena, que es justo el tramo que el
   * visitante ve mientras la imagen se afina.
   */
  function halton(i, base) {
    let f = 1, r = 0;
    while (i > 0) {
      f /= base;
      r += f * (i % base);
      i = Math.floor(i / base);
    }
    return r;
  }

  const VS_QUAD = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `;

  // Promedio corriente: la muestra nueva entra con peso 1/(n+1) sobre lo
  // acumulado. En la primera se toma entera, sin mezclar, para no arrastrar lo
  // que hubiera quedado en el buffer.
  const FS_MEZCLA = `
    precision highp float;
    uniform sampler2D anterior;
    uniform sampler2D muestra;
    uniform float peso;
    varying vec2 vUv;
    void main() {
      vec4 m = texture2D(muestra, vUv);
      if (peso >= 1.0) { gl_FragColor = m; return; }
      gl_FragColor = mix(texture2D(anterior, vUv), m, peso);
    }
  `;

  // Salida: exposicion, Khronos PBR Neutral, sRGB y recien ahi el fondo.
  //
  // El fondo va afuera del mapeo de tono a proposito. Cualquier tonemapper
  // comprime el blanco puro (1.0 sale 0.88 y se ve gris), y este visor esta
  // embebido en una pagina blanca: el borde del canvas se notaria. La escena se
  // dibuja sobre transparente y el color de fondo se compone al final, ya en
  // espacio de pantalla, asi el blanco del visor es el mismo de la ficha.
  const FS_SALIDA = `
    precision highp float;
    uniform sampler2D imagen;
    uniform vec3 fondo;
    uniform float exposicion;
    varying vec2 vUv;

    vec3 neutral(vec3 color) {
      const float inicio = 0.8 - 0.04;
      const float desat = 0.15;
      float x = min(color.r, min(color.g, color.b));
      float pie = x < 0.08 ? x - 6.25 * x * x : 0.04;
      color -= pie;
      float pico = max(color.r, max(color.g, color.b));
      if (pico < inicio) return color;
      float d = 1.0 - inicio;
      float nuevo = 1.0 - d * d / (pico + d - inicio);
      color *= nuevo / pico;
      float g = 1.0 - 1.0 / (desat * (pico - nuevo) + 1.0);
      return mix(color, vec3(nuevo), g);
    }

    vec3 asRGB(vec3 c) {
      c = clamp(c, 0.0, 1.0);
      return mix(pow(c, vec3(0.41666)) * 1.055 - 0.055, c * 12.92, step(c, vec3(0.0031308)));
    }

    void main() {
      vec4 s = texture2D(imagen, vUv);
      vec3 c = asRGB(neutral(max(s.rgb, 0.0) * exposicion));
      gl_FragColor = vec4(c + fondo * (1.0 - clamp(s.a, 0.0, 1.0)), 1.0);
    }
  `;

  class ThreeDStage extends HTMLElement {
    constructor() {
      super();
      const root = this.attachShadow({ mode: 'open' });
      const style = document.createElement('style');
      style.textContent = stylesheet;
      root.appendChild(style);
      this._err = document.createElement('div');
      this._err.className = 'err';
      root.appendChild(this._err);
      const note = document.createElement('div');
      note.className = 'note';
      note.textContent = 'Arrastra para girar · scroll para acercar · boton derecho para desplazar';
      root.appendChild(note);
      // `limpio` deja solo la escena: sin la ayuda superpuesta y sin los botones
      // de descarga. Es lo que va en la tienda — al comprador no le sirve
      // bajarse el OBJ, y no hace falta regalar el modelo. Sacando el atributo
      // vuelven a aparecer, que es como se usa el visor puertas adentro.
      this._limpio = this.hasAttribute('limpio');
      if (this._limpio) note.style.display = 'none';
      this._toolbar = document.createElement('div');
      this._toolbar.className = 'toolbar';
      this._objBtn = document.createElement('button');
      this._objBtn.type = 'button';
      this._objBtn.textContent = 'Descargar OBJ + MTL';
      this._objBtn.addEventListener('click', () => this._runExport('obj'));
      this._glbBtn = document.createElement('button');
      this._glbBtn.type = 'button';
      this._glbBtn.textContent = 'Descargar GLB';
      this._glbBtn.addEventListener('click', () => this._runExport('glb'));
      this._toolbar.appendChild(this._objBtn);
      this._toolbar.appendChild(this._glbBtn);
      if (this._limpio) this._toolbar.style.display = 'none';
      root.appendChild(this._toolbar);
      this._setButtonsEnabled(false);
      /** Resolves with { THREE } once the scene is live — build the model
       *  in `await stage.ready` so nothing races the library load. */
      this.ready = new Promise((resolve, reject) => {
        this._readyResolve = resolve;
        this._readyReject = reject;
      });
    }

    connectedCallback() {
      if (this._booted) {
        // Re-attached after a removal — resume what disconnected stopped.
        if (this._renderer) {
          this._corriendo = true;
          this._renderer.setAnimationLoop(this._loop);
          this._ro && this._ro.observe(this);
          this._io && this._io.observe(this);
        }
        return;
      }
      this._booted = true;
      this._boot().catch((err) => {
        this._err.style.display = 'flex';
        this._err.textContent =
          'three.js failed to load.\n' +
          'Check that the pinned <script type="importmap"> from the usage ' +
          'notes is in <head> before any module script.\n\n' +
          String(err && err.message ? err.message : err);
        this._readyReject(err);
      });
    }

    async _boot() {
      const bg = this.getAttribute('background');
      if (bg) this.style.setProperty('--stage-bg', bg);
      const [THREE, controlsMod] = await Promise.all([
        import('three'),
        import('three/addons/controls/OrbitControls.js'),
      ]);
      this._THREE = THREE;
      // preserveDrawingBuffer keeps the last frame readable after
      // compositing (toDataURL / drawImage) — it's what lets the
      // screenshot tools capture the scene instead of a blank canvas.
      // Ademas es lo que deja congelar el ultimo cuadro cuando la
      // acumulacion converge y el bucle deja de dibujar.
      const renderer = new THREE.WebGLRenderer({
        antialias: false,          // el antialias sale del jitter de subpixel
        alpha: true,
        preserveDrawingBuffer: true,
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.shadowMap.enabled = true;
      // PCFSoftShadowMap quedo deprecado en three 0.184 y cae a PCFShadowMap
      // emitiendo un warning en consola; lo pedimos directo. La penumbra no
      // sale del filtro sino de mover la luz entre muestra y muestra.
      renderer.shadowMap.type = THREE.PCFShadowMap;
      renderer.shadowMap.autoUpdate = true;
      // El tono lo hace el pase de salida, no el renderer: la escena se acumula
      // en lineal y recien al mostrarla se comprime.
      renderer.toneMapping = THREE.NoToneMapping;
      this._renderer = renderer;
      this.shadowRoot.insertBefore(renderer.domElement, this._err);

      const scene = new THREE.Scene();
      this._scene = scene;

      const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 500);
      camera.position.set(3, 2.2, 4);
      this._camera = camera;

      const controls = new controlsMod.OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      this._controls = controls;

      // ——— Luces
      //
      // Un cielo tenue que no deja nada en negro, un sol que proyecta y un
      // rebote frio de atras. La luz que hace el trabajo fino es `cielo`: en
      // cada muestra apunta desde una direccion distinta de la boveda y tira
      // sombra, asi que al promediar aparece la oclusion de los rincones.
      //
      // Los valores estan medidos contra un mueble blanco sobre fondo blanco,
      // que es el caso dificil: si el conjunto se pasa aunque sea poco, la cara
      // frontal y el fondo de la pagina terminan en el mismo blanco y el mueble
      // pierde el borde. La cuenta que se busca es cara superior ~0,8, frente
      // ~0,62 y costado ~0,34: con esa escalera el volumen se lee solo.
      //
      // Y el color de las luces va casi neutro. Se probo con un sol calido, que
      // es lo que uno pondria de entrada, y el nogal salia naranja: medido
      // contra la foto de la publicacion, el canal azul quedaba en 49 cuando la
      // foto marca 72. Las fotos de catalogo se toman con luz de estudio
      // equilibrada, y si el render las quiere igualar tiene que hacer lo mismo.
      this._relleno = new THREE.HemisphereLight(0xffffff, 0xdedcd8, 0.15);
      scene.add(this._relleno);

      const sol = new THREE.DirectionalLight(0xfffdf9, 1.55);
      sol.position.set(4, 7, 5);
      sol.castShadow = true;
      sol.shadow.mapSize.set(2048, 2048);
      sol.shadow.bias = -0.0004;
      sol.shadow.normalBias = 0.02;
      this._sol = sol;
      this._solBase = sol.position.clone();
      scene.add(sol);
      scene.add(sol.target);

      const cielo = new THREE.DirectionalLight(0xffffff, 0.78);
      cielo.position.set(-2.5, 6, 2.5);
      cielo.castShadow = true;
      cielo.shadow.mapSize.set(1024, 1024);
      cielo.shadow.bias = -0.0006;
      cielo.shadow.normalBias = 0.03;
      this._cielo = cielo;
      scene.add(cielo);
      scene.add(cielo.target);

      const contra = new THREE.DirectionalLight(0xeef2fa, 0.22);
      contra.position.set(-5, 3, -4);
      scene.add(contra);

      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(200, 200),
        new THREE.ShadowMaterial({ color: 0x2b2620, opacity: 0.8 })
      );
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      this._ground = ground;
      scene.add(ground);

      // ——— Pases de pantalla completa
      this._quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      this._quadScene = new THREE.Scene();
      this._matMezcla = new THREE.ShaderMaterial({
        uniforms: { anterior: { value: null }, muestra: { value: null }, peso: { value: 1 } },
        vertexShader: VS_QUAD, fragmentShader: FS_MEZCLA,
        depthTest: false, depthWrite: false,
      });
      this._matSalida = new THREE.ShaderMaterial({
        uniforms: {
          imagen: { value: null },
          fondo: { value: new THREE.Vector3(1, 1, 1) },
          exposicion: { value: 1.85 },
        },
        vertexShader: VS_QUAD, fragmentShader: FS_SALIDA,
        depthTest: false, depthWrite: false,
      });
      this._quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this._matSalida);
      this._quad.frustumCulled = false;
      this._quadScene.add(this._quad);
      this._fondoCss(bg || '#f0eee6');

      // ——— Calidad
      // El celular hace la mitad de las muestras: converge igual en menos de un
      // segundo y no se queda sin bateria mostrando un ropero.
      const chico = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ||
        window.innerWidth < 700;
      this._total = Number(this.getAttribute('muestras')) || (chico ? 28 : 64);
      this._apertura = this.hasAttribute('apertura')
        ? Number(this.getAttribute('apertura'))
        : 0.028;
      if (chico) {
        this._sol.shadow.mapSize.set(1024, 1024);
      } else {
        this._cielo.shadow.mapSize.set(2048, 2048);
      }
      this._muestra = 0;
      this._firmaPrevia = null;
      // Valores de arranque, por si se dibuja un cuadro antes de setObject.
      this._centro = new THREE.Vector3();
      this._radio = 1;

      this._autorotate = this.hasAttribute('autorotate');
      controls.autoRotate = this._autorotate;
      controls.autoRotateSpeed = 1.2;
      controls.addEventListener('start', () => {
        controls.autoRotate = false;
      });

      this._loop = () => {
        if (this._ocupado) return;      // foto() esta usando el renderer
        controls.update();
        this._camera.updateMatrixWorld();
        const firma = this._firma();
        if (firma !== this._firmaPrevia) {
          this._firmaPrevia = firma;
          this._muestra = 0;
        }
        // Convergio: el canvas conserva el ultimo cuadro (preserveDrawingBuffer)
        // y no hay nada que redibujar.
        if (this._muestra >= this._total) return;
        this._dibujarMuestra(this._muestra);
        this._muestra += 1;
      };

      // ——— Pausa del bucle cuando el visor no se ve.
      // Sin esto sigue dibujando aunque este oculto tras una pestana o fuera
      // de pantalla: se midieron 20 cuadros por segundo gastados en nada, y el
      // scroll de la pagina se resiente.
      //
      // Se cruzan dos senales. El ResizeObserver detecta el display:none (la
      // caja pasa a medir cero) y es el que manda, porque es el caso de las
      // pestanas Fotos / Vista 3D. El IntersectionObserver cubre el otro caso,
      // que el visor quede lejos en la pagina. Si alguna de las dos fallara, la
      // otra alcanza para que el visor vuelva a andar: un visor congelado seria
      // peor que gastar unos cuadros de mas.
      this._enPantalla = true;
      this._conTamano = true;
      this._corriendo = true;

      const actualizarBucle = () => {
        const debeCorrer = this._enPantalla && this._conTamano;
        if (debeCorrer === this._corriendo) return;
        this._corriendo = debeCorrer;
        renderer.setAnimationLoop(debeCorrer ? this._loop : null);
      };
      this._actualizarBucle = actualizarBucle;

      const fit = () => {
        const w = this.clientWidth;
        const h = this.clientHeight;
        this._conTamano = w > 0 && h > 0;
        if (this._conTamano) {
          renderer.setSize(w, h);
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          this._crearDestinos(
            Math.max(1, Math.round(w * renderer.getPixelRatio())),
            Math.max(1, Math.round(h * renderer.getPixelRatio()))
          );
          this.invalidar();
        }
        actualizarBucle();
      };
      this._fit = fit;
      fit();

      this._ro = new ResizeObserver(fit);
      this._io = new IntersectionObserver(([e]) => {
        this._enPantalla = e.isIntersecting;
        actualizarBucle();
      }, { rootMargin: '200px' });

      // Detached while three.js was fetching? Stay idle — the
      // connectedCallback resume starts the loop and observer on
      // reattach.
      if (this.isConnected) {
        this._ro.observe(this);
        this._io.observe(this);
        renderer.setAnimationLoop(this._loop);
      }

      this._readyResolve({ THREE });
    }

    disconnectedCallback() {
      // Stop rendering and observing while detached; connectedCallback
      // resumes both. (The renderer itself is kept — a move within the
      // document must not rebuild the scene.)
      if (this._renderer) this._renderer.setAnimationLoop(null);
      this._corriendo = false;
      if (this._ro) this._ro.disconnect();
      if (this._io) this._io.disconnect();
    }

    // ————————————————————————————————————————————— render progresivo

    /** El color del atributo `background`, listo para componer en pantalla. */
    _fondoCss(css) {
      const THREE = this._THREE;
      const c = new THREE.Color();
      c.setStyle(css, THREE.SRGBColorSpace);
      // El shader compone en espacio de pantalla, asi que el fondo viaja ya
      // codificado en sRGB y no en el lineal de trabajo.
      const s = c.clone().convertLinearToSRGB();
      this._matSalida.uniforms.fondo.value.set(s.r, s.g, s.b);
    }

    _crearDestinos(w, h) {
      const THREE = this._THREE;
      if (this._rtMuestra && this._anchoPx === w && this._altoPx === h) return;
      this._anchoPx = w;
      this._altoPx = h;
      for (const rt of [this._rtMuestra, this._rtA, this._rtB]) rt && rt.dispose();
      const opciones = {
        type: THREE.HalfFloatType,
        format: THREE.RGBAFormat,
        depthBuffer: true,
        stencilBuffer: false,
      };
      // La muestra lleva MSAA: el primer cuadro, el que se ve mientras se
      // arrastra, tiene que verse decente antes de acumular nada.
      this._rtMuestra = new THREE.WebGLRenderTarget(w, h, { ...opciones, samples: 4 });
      this._rtA = new THREE.WebGLRenderTarget(w, h, { ...opciones, depthBuffer: false });
      this._rtB = new THREE.WebGLRenderTarget(w, h, { ...opciones, depthBuffer: false });
    }

    /**
     * Firma barata de lo que se ve. Si cambia, la acumulacion vuelve a cero.
     *
     * Entran la camara y, de cada objeto, posicion, giro y color de material.
     * Con eso alcanza para que abrir las puertas, cambiar el color o mover la
     * camara reinicien el render sin que ningun modulo tenga que avisar.
     */
    _firma() {
      let h = 0;
      const acc = (v) => { h = (Math.imul(h, 31) + Math.round(v * 8192)) | 0; };
      const m = this._camera.matrixWorld.elements;
      for (let i = 0; i < 16; i++) acc(m[i]);
      acc(this._camera.fov);
      if (this._object) {
        this._object.traverse((o) => {
          const p = o.position, q = o.quaternion;
          acc(p.x); acc(p.y); acc(p.z);
          acc(q.x); acc(q.y); acc(q.z); acc(q.w);
          acc(o.visible ? 1 : 0);
          const mat = o.material;
          if (mat && !Array.isArray(mat) && mat.color) acc(mat.color.getHex() / 65536);
        });
      }
      return h;
    }

    /** Reinicia la acumulacion y despierta el bucle. */
    invalidar() {
      this._muestra = 0;
      this._firmaPrevia = null;
    }

    /**
     * Coloca la muestra n: sol de disco, cielo muestreado, lente y subpixel.
     * Devuelve la funcion que deja todo como estaba.
     */
    _jitter(n) {
      const THREE = this._THREE;
      const cam = this._camera;
      const cielo = this._cielo;
      const radio = this._radio || 1;

      if (n === 0) {
        // Vista previa: sin desenfoque, sin muestreo de cielo y con la luz de
        // boveda clavada en una direccion representativa. Es lo que se ve
        // mientras se arrastra.
        //
        // Lo que NO se hace aca es apagarle la sombra al cielo, que fue lo
        // primero que se probo para ganar cuadros. Cambiar `castShadow`
        // cambia la cantidad de sombras de la escena, y eso obliga a three a
        // recompilar el shader de todos los materiales: en el Florencia, con
        // trece materiales, la muestra pasaba de 30 a 290 milisegundos y el
        // reinicio de la acumulacion tironeaba cada vez que uno soltaba el
        // mouse. Sale mucho mas barato dibujar el segundo mapa de sombra.
        cam.clearViewOffset();
        this._sol.position.copy(this._solBase);
        cielo.position.copy(this._centro).add(new THREE.Vector3(-0.35, 1, 0.4).setLength(radio * 3.2));
        cielo.color.setRGB(1, 1, 1);
        return () => {};
      }

      // Subpixel: el pixel entero se recorre con Halton, no un patron fijo.
      const jx = halton(n, 2) - 0.5;
      const jy = halton(n, 3) - 0.5;
      cam.setViewOffset(this._anchoPx, this._altoPx, jx, jy, this._anchoPx, this._altoPx);

      // Sol de disco: el astro real mide medio grado, pero una fuente de
      // estudio abarca mucho mas y es lo que da la penumbra que se espera en
      // una foto de mueble.
      const a1 = halton(n, 5) * Math.PI * 2;
      const r1 = Math.sqrt(halton(n, 7)) * this._solBase.length() * 0.10;
      const eje = this._solBase.clone().normalize();
      const lat = new THREE.Vector3(0, 1, 0).cross(eje).normalize();
      const lon = eje.clone().cross(lat).normalize();
      this._sol.position.copy(this._solBase)
        .addScaledVector(lat, Math.cos(a1) * r1)
        .addScaledVector(lon, Math.sin(a1) * r1);

      // Cielo: una direccion de la boveda por muestra, con peso coseno. El
      // promedio de todas las direcciones con sombra es, literalmente, la
      // oclusion ambiental — no hay un pase de AO aparte porque no hace falta.
      const rr = Math.sqrt(halton(n, 11)) * 0.95;
      const fi = halton(n, 13) * Math.PI * 2;
      const dir = new THREE.Vector3(
        rr * Math.cos(fi),
        Math.sqrt(1 - rr * rr),
        rr * Math.sin(fi)
      ).normalize();
      cielo.position.copy(this._centro).addScaledVector(dir, radio * 3.2);

      // La camara de sombra se abre segun lo rasante que venga la direccion.
      //
      // Con un encuadre fijo habria que cortar la boveda a unos 45 grados, y
      // ese corte se ve: la penumbra termina en una linea recta en el piso, un
      // abanico gris con borde de cuchillo. El cielo de verdad llega hasta el
      // horizonte y su sombra se apaga sin borde, asi que la direccion baja
      // hasta los 18 grados y el encuadre la sigue.
      const tan = Math.sqrt(1 - dir.y * dir.y) / Math.max(dir.y, 0.2);
      const span = Math.min(radio * 6, radio * (1.2 + 0.95 * tan));
      const camSombra = cielo.shadow.camera;
      camSombra.left = -span; camSombra.right = span;
      camSombra.top = span; camSombra.bottom = -span;
      camSombra.updateProjectionMatrix();
      // Mas azul arriba, mas calido cerca del horizonte: es como se comporta la
      // luz de una habitacion con ventana.
      cielo.color.setRGB(
        1 - 0.05 * dir.y,
        1 - 0.015 * dir.y,
        1 + 0.02 * dir.y
      );

      // Lente: la camara se corre sobre el disco de apertura y vuelve a apuntar
      // al mismo punto, asi el plano de foco queda clavado en el objeto y lo que
      // esta delante o detras se desarma solo.
      const pos0 = cam.position.clone();
      const quat0 = cam.quaternion.clone();
      if (this._apertura > 0) {
        const a2 = halton(n, 17) * Math.PI * 2;
        const r2 = Math.sqrt(halton(n, 19)) * this._apertura * 0.5;
        const der = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
        const arr = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
        cam.position
          .addScaledVector(der, Math.cos(a2) * r2)
          .addScaledVector(arr, Math.sin(a2) * r2);
        cam.lookAt(this._controls.target);
        cam.updateMatrixWorld(true);
      }

      return () => {
        cam.position.copy(pos0);
        cam.quaternion.copy(quat0);
        cam.updateMatrixWorld(true);
      };
    }

    _dibujarMuestra(n) {
      const renderer = this._renderer;
      const restaurar = this._jitter(n);

      renderer.setRenderTarget(this._rtMuestra);
      renderer.render(this._scene, this._camera);
      restaurar();

      this._matMezcla.uniforms.anterior.value = this._rtA.texture;
      this._matMezcla.uniforms.muestra.value = this._rtMuestra.texture;
      this._matMezcla.uniforms.peso.value = 1 / (n + 1);
      this._quad.material = this._matMezcla;
      renderer.setRenderTarget(this._rtB);
      renderer.render(this._quadScene, this._quadCam);

      const t = this._rtA; this._rtA = this._rtB; this._rtB = t;

      this._matSalida.uniforms.imagen.value = this._rtA.texture;
      this._quad.material = this._matSalida;
      renderer.setRenderTarget(this._destinoSalida || null);
      renderer.render(this._quadScene, this._quadCam);
    }

    /**
     * Baja el encuadre actual como PNG, renderizado a `escala` veces el tamano
     * del visor.
     *
     * Es la misma cuenta que hace la pantalla, nada mas que en grande: la foto
     * que se descarga es exactamente lo que se esta viendo, y sirve para
     * publicar el producto sin sesion de fotos.
     *
     * Cuesta cuatro veces mas que un cuadro de pantalla por cada muestra, asi
     * que son varios segundos: de ahi el `alAvanzar`, para que el boton pueda
     * contar en vez de quedarse mudo. El respiro entre tandas va por
     * requestAnimationFrame y no por setTimeout — el navegador estira los
     * setTimeout a un segundo en pestanas de fondo y el render terminaba
     * tardando veinte segundos en vez de seis.
     */
    async foto(escala = 2, { nombre, alAvanzar } = {}) {
      const THREE = this._THREE;
      const renderer = this._renderer;
      if (!THREE || !this._rtMuestra || this._ocupado) return null;
      this._ocupado = true;             // el bucle no toca el renderer mientras tanto
      const w0 = this._anchoPx, h0 = this._altoPx;
      const w = Math.min(4096, Math.round(w0 * escala));
      const h = Math.min(4096, Math.round(h0 * escala));

      const previo = { rtMuestra: this._rtMuestra, rtA: this._rtA, rtB: this._rtB };
      this._rtMuestra = this._rtA = this._rtB = null;
      this._crearDestinos(w, h);
      const salida = new THREE.WebGLRenderTarget(w, h, {
        type: THREE.UnsignedByteType,
        format: THREE.RGBAFormat,
        depthBuffer: false,
      });
      this._destinoSalida = salida;

      const total = this._total;
      for (let n = 0; n < total; n++) {
        this._dibujarMuestra(n);
        // Un respiro cada tanto: sin esto la pestana se congela y el celular
        // muestra el aviso de pagina que no responde.
        if (n % 4 === 3) {
          if (alAvanzar) alAvanzar((n + 1) / total);
          await new Promise((r) => requestAnimationFrame(r));
        }
      }

      const buffer = new Uint8Array(w * h * 4);
      renderer.readRenderTargetPixels(salida, 0, 0, w, h, buffer);
      salida.dispose();
      this._destinoSalida = null;
      for (const rt of [this._rtMuestra, this._rtA, this._rtB]) rt && rt.dispose();
      this._rtMuestra = previo.rtMuestra;
      this._rtA = previo.rtA;
      this._rtB = previo.rtB;
      this._anchoPx = w0;
      this._altoPx = h0;
      renderer.setRenderTarget(null);
      this._ocupado = false;
      this.invalidar();

      // WebGL entrega las filas de abajo hacia arriba.
      const lienzo = document.createElement('canvas');
      lienzo.width = w; lienzo.height = h;
      const ctx = lienzo.getContext('2d');
      const img = ctx.createImageData(w, h);
      const fila = w * 4;
      for (let y = 0; y < h; y++) {
        img.data.set(buffer.subarray((h - 1 - y) * fila, (h - y) * fila), y * fila);
      }
      ctx.putImageData(img, 0, 0);
      const blob = await new Promise((r) => lienzo.toBlob(r, 'image/png'));
      if (blob) download(blob, (nombre || this._basename) + '.png');
      if (alAvanzar) alAvanzar(1);
      return blob;
    }

    /** Show (and own) the object. Replaces any previous object, enables
     *  shadows on every mesh, rests it on the ground plane, and frames
     *  the camera to its bounds. */
    setObject(object) {
      const THREE = this._THREE;
      if (!THREE) throw new Error('three-d-stage: not ready — await stage.ready first');
      if (this._object) this._scene.remove(this._object);
      this._object = object;
      object.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      const box = new THREE.Box3().setFromObject(object);
      this._centro = new THREE.Vector3();
      this._radio = 1;
      if (!box.isEmpty()) {
        // Rest the object on the ground without moving its origin.
        this._ground.position.y = box.min.y;
        const sphere = box.getBoundingSphere(new THREE.Sphere());
        this._centro.copy(sphere.center);
        this._radio = sphere.radius;
        const dist =
          (sphere.radius / Math.tan((this._camera.fov * Math.PI) / 360)) * 1.35;
        const dir = new THREE.Vector3(1, 0.55, 1.25).normalize();
        this._camera.position
          .copy(sphere.center)
          .add(dir.multiplyScalar(dist));
        this._camera.near = Math.max(dist / 100, 0.01);
        this._camera.far = dist * 100;
        this._camera.updateProjectionMatrix();
        this._controls.target.copy(sphere.center);
        this._controls.update();

        // El sol se planta a escala del objeto y apunta a su centro; si no, un
        // ropero de dos metros se sale de la camara de sombra. La direccion es
        // de arriba y algo a la derecha del frente: deja la tapa clara, el
        // frente medio y el costado bastante mas oscuro, que es la escalera de
        // valores con la que se fotografia un mueble.
        this._solBase.set(0.28, 1.15, 0.92).setLength(sphere.radius * 3.4).add(sphere.center);
        this._sol.position.copy(this._solBase);
        this._sol.target.position.copy(sphere.center);
        this._cielo.target.position.copy(sphere.center);
        // La camara de sombra no alcanza con cubrir el objeto: tiene que cubrir
        // tambien el piso donde cae la sombra. Con una luz a 40 grados, un
        // ropero de dos metros tira dos metros de sombra, y si el encuadre
        // ortografico se queda corto la sombra aparece cortada con un borde
        // recto que delata el truco. De ahi el 2,5 (y el minimo de elevacion
        // que se le exige a las direcciones de cielo en _jitter).
        for (const luz of [this._sol, this._cielo]) {
          const span = sphere.radius * 2.5;
          luz.shadow.camera.left = -span;
          luz.shadow.camera.right = span;
          luz.shadow.camera.top = span;
          luz.shadow.camera.bottom = -span;
          luz.shadow.camera.near = sphere.radius * 0.4;
          luz.shadow.camera.far = sphere.radius * 8;
          luz.shadow.camera.updateProjectionMatrix();
        }
      }
      this._scene.add(object);
      this._setButtonsEnabled(true);
      this.invalidar();
      // Red de seguridad: si el modelo se monta justo cuando el visor acaba de
      // hacerse visible, esto reanuda el bucle sin esperar a que salte un
      // observer.
      if (this._fit) this._fit();
    }

    get _basename() {
      return (this.getAttribute('name') || 'model').replace(/[^\w.-]+/g, '_');
    }

    _setButtonsEnabled(on) {
      this._objBtn.disabled = !on;
      this._glbBtn.disabled = !on;
    }

    /** Every mesh and material needs a unique name for o/usemtl lines —
     *  fill in stable fallbacks, and return the unique material list. */
    _nameParts() {
      const mats = [];
      const seen = new Set();
      let meshI = 0;
      let matI = 0;
      this._object.traverse((o) => {
        if (!o.isMesh) return;
        if (!o.name) o.name = 'part_' + meshI;
        meshI += 1;
        const list = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of list) {
          if (!m || mats.includes(m)) continue;
          if (!m.name) {
            m.name = 'mat_' + matI;
            matI += 1;
          }
          while (seen.has(m.name)) {
            m.name = m.name + '_' + matI;
            matI += 1;
          }
          seen.add(m.name);
          mats.push(m);
        }
      });
      return mats;
    }

    /** One export attempt, reported to the host however it settles.
     *  Rethrows so a failure stays visible on the guest console exactly as
     *  before. The no-object early return is not an attempt (the toolbar is
     *  disabled until the model loads) and reports nothing. */
    async _runExport(format) {
      if (!this._object) return;
      try {
        await (format === 'obj' ? this._exportObj() : this._exportGlb());
        notifyExport(format, true);
      } catch (err) {
        notifyExport(format, false);
        throw err;
      }
    }

    async _exportObj() {
      if (!this._object) return;
      const mod = await import('three/addons/exporters/OBJExporter.js');
      const mats = this._nameParts();
      const base = this._basename;
      const obj =
        'mtllib ' + base + '.mtl\n' + new mod.OBJExporter().parse(this._object);
      let mtl = '# Exported by three-d-stage\n';
      for (const m of mats) {
        const c = m.color || { r: 0.8, g: 0.8, b: 0.8 };
        const rough = typeof m.roughness === 'number' ? m.roughness : 0.5;
        const opacity = typeof m.opacity === 'number' ? m.opacity : 1;
        mtl += 'newmtl ' + m.name + '\n';
        mtl +=
          'Kd ' + c.r.toFixed(4) + ' ' + c.g.toFixed(4) + ' ' + c.b.toFixed(4) + '\n';
        mtl += 'Ks 0.2000 0.2000 0.2000\n';
        mtl += 'Ns ' + Math.round((1 - rough) * 200) + '\n';
        mtl += 'd ' + opacity.toFixed(4) + '\n\n';
      }
      download(new Blob([obj], { type: 'text/plain' }), base + '.obj');
      download(new Blob([mtl], { type: 'text/plain' }), base + '.mtl');
    }

    async _exportGlb() {
      if (!this._object) return;
      const mod = await import('three/addons/exporters/GLTFExporter.js');
      this._nameParts();
      const base = this._basename;
      const buf = await new mod.GLTFExporter().parseAsync(this._object, {
        binary: true,
      });
      download(
        new Blob([buf], { type: 'model/gltf-binary' }),
        base + '.glb'
      );
    }
  }

  customElements.define('three-d-stage', ThreeDStage);
})();
