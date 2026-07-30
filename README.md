# Mundo Shop — fichas de producto con visor 3D

Sitio estatico: fichas de producto estilo marketplace con un visor 3D interactivo
construido en [three.js](https://threejs.org/). Todo se sirve como archivos planos,
sin build ni dependencias de servidor.

## Estructura

```
index.html               hub con las fichas publicadas
ropero-berlim.html       ficha: Ropero Placard Berlim 8 puertas (MLU53664117)
3d/three-d-stage.js      web component <three-d-stage>: escena, luces, orbit,
                         sombra de piso y exportacion OBJ+MTL / GLB
3d/ropero-berlim.js      modelo del Berlim en medidas reales (206 x 38,5 x 199 cm)
3d/ar.js                 lanzador de AR nativo (Quick Look / Scene Viewer)
3d/models/               GLB y USDZ pre-generados, uno por color
tools/servidor.js        servidor de desarrollo (no se publica)
tools/exportar.html      genera los GLB/USDZ (no se publica)
vercel.json              cache y content-type de los modelos
.vercelignore            deja tools/ fuera del deploy
```

## Como funciona el visor

1. La pagina declara un `<script type="importmap">` con three.js 0.184 fijado por version.
2. `three-d-stage.js` define el custom element `<three-d-stage>`, que arma el
   renderer, la iluminacion de estudio, los `OrbitControls` y encuadra la camara
   sola segun el bounding box del objeto.
3. El modulo del producto exporta una funcion `init...(stage, btn)` que espera
   `await stage.ready`, construye el mueble con `BoxGeometry` en metros y llama a
   `stage.setObject(grupo)`.

Cada modelo nuevo es un archivo mas dentro de `3d/`; el stage no se toca.

## Modelo: Ropero Berlim

- 8 puertas batientes en 4 modulos, apertura escalonada de 105 grados.
  El eje de giro de cada hoja se corre medio espesor hacia afuera para que las
  puertas de modulos contiguos no se atraviesen al abrir.
- 10 estantes (4 altos + 2 por modulo lateral + 1 bajo por modulo central) y
  2 barrales metalicos.
- Texturas procedurales generadas en canvas: veta de nogal y micro-textura mate
  para el frente negro. No hay imagenes externas en el modelo.
- Los circulos de color de la ficha cambian el material de las hojas en vivo
  (negro / blanco / castano / beige) via la API que devuelve `initRoperoBerlim`.

`initRoperoBerlim(stage, btn)` devuelve `{ setColor, setDoors, toggle, colores, grupo }`.

## Realidad aumentada

La ficha ofrece "Ver en tu ambiente": abre el visor AR nativo del telefono con el
mueble a escala real. No usa `<model-viewer>` — esa libreria pesa cerca de 1 MB
porque incluye su propio three.js, y aca alcanza con un link por plataforma:

- **iPhone / iPad** — `<a rel="ar">` a un `.usdz` (AR Quick Look). Safari solo
  dispara Quick Look si el enlace tiene un `<img>` adentro.
- **Android** — `intent://` a Scene Viewer con el `.glb`.
- **Escritorio** — no hay AR: se muestra un aviso para abrir la pagina en el celular.

En ambas plataformas se bloquea el pellizco para redimensionar
(`resizable=false` y `#allowsContentScaling=0`). El punto de mostrarlo en AR es
que se vea del tamano que realmente tiene.

`vercel.json` fuerza `model/vnd.usdz+zip` y `model/gltf-binary`: con el
content-type equivocado Quick Look no abre.

### Regenerar los modelos

Los `.glb` / `.usdz` de `3d/models/` se generan en el navegador y se commitean.
Salen con las puertas cerradas y sin contenido interior — en AR se mira el mueble
contra la pared, y la ropa solo suma peso.

```bash
node tools/servidor.js
# abrir http://localhost:8123/tools/exportar.html y apretar el boton
git add 3d/models && git commit -m "regenerar modelos AR"
```

Hay que rehacerlo cada vez que cambia la geometria o los colores.

**Cuidado con los materiales:** `USDZExporter` acepta solo `MeshStandardMaterial`
simple y **descarta en silencio** las mallas que tengan un array de materiales.
Por eso los cantos de nogal de estantes y divisores son mallas aparte y no una
cara distinta del mismo box. El exportador avisa en pantalla si detecta alguna.

## Desarrollo local

Los modulos ES necesitan `http://`, no `file://`:

```bash
node tools/servidor.js     # http://localhost:8123
```

## Deploy en Vercel

Sitio estatico sin framework: importar el repo de GitHub en Vercel y dejar
Framework Preset en **Other**, sin build command y con output directory `.`.
Cada push a la rama principal redespliega.
