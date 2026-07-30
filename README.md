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
vercel.json              cabeceras de cache para /3d
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

## Desarrollo local

Los modulos ES necesitan `http://`, no `file://`:

```bash
npx serve .
# o
python -m http.server 8080
```

## Deploy en Vercel

Sitio estatico sin framework: importar el repo de GitHub en Vercel y dejar
Framework Preset en **Other**, sin build command y con output directory `.`.
Cada push a la rama principal redespliega.
