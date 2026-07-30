# Mundo Shop — fichas de producto con visor 3D

Sitio estatico: fichas de producto estilo marketplace con un visor 3D interactivo
construido en [three.js](https://threejs.org/). Todo se sirve como archivos planos,
sin build ni dependencias de servidor.

## Estructura

```
index.html               portada con hero y catalogo
ropero-berlim.html       ficha: Ropero Placard Berlim 8 puertas (MLU53664117)

assets/estilos.css       sistema de diseno: tokens, cabecera, ficha, pie
assets/tienda.js         galeria, lightbox, reveal, barra fija, carrito
assets/fuentes/          Inter variable, servida desde el propio dominio

3d/three-d-stage.js      web component <three-d-stage>: escena, luces, orbit,
                         render progresivo, descarga de foto y exportacion
                         OBJ+MTL / GLB
3d/comun.js              piezas compartidas: cajas biseladas, texturas y mapas
                         de normales procedurales, encuadre, animaciones
3d/ropero-berlim.js      modelo del Berlim en medidas reales (206 x 38,5 x 199 cm)
3d/ar.js                 lanzador de AR nativo (Quick Look / Scene Viewer)
3d/models/               GLB y USDZ pre-generados, uno por color

favicon.svg .ico         generados por tools/iconos.js
apple-touch-icon.png
site.webmanifest

tools/servidor.js        servidor de desarrollo (no se publica)
tools/exportar.html      genera los GLB/USDZ (no se publica)
tools/iconos.js          genera favicon, apple-touch-icon y manifest
tools/movil.html         monta una ficha en un iframe angosto y lista que
                         elementos desbordan (no se publica)
vercel.json              cache y content-type de los modelos
.vercelignore            deja tools/ fuera del deploy
```

## Diseno

Sin framework y sin build a proposito: son fichas estaticas con un visor 3D en
vanilla, y meter React o Next agregaria dependencias y riesgo sobre el pipeline
de AR sin mejorar como se ve. Lo que hace el trabajo es `assets/estilos.css`,
que define los tokens (color, tipografia fluida, radios, sombras, curvas de
animacion) y todos los componentes compartidos. Una ficha nueva solo trae su
contenido.

Dos reglas del archivo que parecen menores y no lo son:

- `.grid > * { min-width:0 }` — los items de grid arrancan en `min-width:auto` y
  crecen hasta el ancho intrinseco de su contenido. Sin esto, una foto grande o
  un canvas hacen que la pagina scrollee de costado en el celular.
- `[hidden] { display:none !important }` — cualquier `display` propio le gana al
  `[hidden]` del navegador, asi que un elemento con `.clase{display:flex}` se
  sigue viendo aunque tenga el atributo.

El bloque `.revelar` (aparicion al scrollear) solo se esconde si el `<html>`
tiene la clase `js`, que agrega un script en el `<head>`. Si el modulo falla,
la pagina se ve entera igual en vez de quedar en blanco bajo el pliegue.

three.js se importa recien cuando el visitante abre la pestana "Vista 3D".
Son unos 600 KB: cargarlo de entrada retrasaria la ficha para todo el mundo,
incluida la gente que nunca la abre.

## Como funciona el visor

1. La pagina declara un `<script type="importmap">` con three.js 0.184 fijado por version.
2. `three-d-stage.js` define el custom element `<three-d-stage>`, que arma el
   renderer, la iluminacion de estudio, los `OrbitControls` y encuadra la camara
   sola segun el bounding box del objeto.
3. El modulo del producto exporta una funcion `init...(stage, btn)` que espera
   `await stage.ready`, construye el mueble con `geometriaCaja` en metros y llama
   a `stage.setObject(grupo)`.

Cada modelo nuevo es un archivo mas dentro de `3d/`; el stage no se toca.

## El render progresivo

La escena no se dibuja una vez: se dibuja 64 veces (26 en celular) moviendo
apenas el sol, el cielo, la lente y el pixel, y se promedian los cuadros en un
par de render targets de media precision. Es integracion Monte Carlo, la misma
idea de un motor offline, y de ahi salen juntas cuatro cosas que un visor comun
no tiene:

- **penumbra de verdad** — el sol es un disco, no un punto, asi que la sombra se
  abre con la distancia en vez de terminar en un borde de cuchillo;
- **oclusion ambiental correcta** — el cielo se muestrea direccion por direccion
  *con sombra*; el promedio de todas esas direcciones es, literalmente, la
  oclusion. No hay pase de AO en pantalla porque no hace falta;
- **antialias** muy por encima del MSAA, porque cada muestra cae en un punto
  distinto del pixel;
- **profundidad de campo** real, con la lente abierta sobre el plano de foco.

Mientras el visitante arrastra se muestra la muestra 0, que es un render comun y
va a 60 cuadros. Al soltar, la imagen se afina sola en cerca de un segundo y el
bucle deja de dibujar: converger gasta menos que quedarse girando en vano.

Nadie llama a `invalidar()` a mano. Cada cuadro se calcula una firma barata de la
camara y de las mallas (posicion, giro, color) y si cambio se reinicia la
acumulacion, asi que abrir las puertas o cambiar el color se detecta solo.

El tono es Khronos PBR Neutral, el mapeo pensado para fichas de producto: comprime
las altas luces sin virar los colores. **El fondo no pasa por el tono** — cualquier
tonemapper convierte el blanco puro en gris, y este visor va embebido en una
pagina blanca. La escena se dibuja sobre transparente y el color de fondo se
compone despues, ya en espacio de pantalla.

Dos trampas que costaron caro y estan comentadas en el codigo:

- **No tocar `castShadow` entre muestras.** Cambiar la cantidad de luces con
  sombra obliga a three a recompilar el shader de todos los materiales: en el
  Florencia la muestra pasaba de 16 a 290 ms. Sale mucho mas barato dibujar el
  segundo mapa de sombra siempre.
- **La camara de sombra del cielo se abre segun la direccion.** Con un encuadre
  fijo habria que cortar la boveda a unos 45 grados, y ese corte se ve: la
  penumbra termina en una linea recta sobre el piso.
- **Una excepcion dentro del bucle mata el visor para siempre.** El bucle de
  three vuelve a pedir el cuadro *despues* de llamar al callback, asi que un
  solo throw corta la cadena de `requestAnimationFrame` y deja `isAnimating` en
  true; como `start()` sale temprano cuando ya cree estar animando, todo
  `setAnimationLoop` posterior no hace nada. El canvas queda en blanco y en
  consola hay un unico error, el del arranque. De ahi el `try` alrededor del
  cuadro: un fallo tiene que avisar y dejar el estado consistente. El visor
  arranca dentro de la pestana oculta, que mide cero y todavia no tiene destinos
  de render — quien decide si el bucle corre es `fit()`, nadie mas.

`stage.foto(escala)` vuelve a renderizar el encuadre actual al doble de tamano y
baja un PNG. No es una captura de pantalla: es el mismo calculo en grande, asi
que la imagen que se descarga es mejor que la que se estaba viendo. Es lo que hay
detras del boton "Descargar foto" de la ficha.

## Colores medidos, no elegidos

Los materiales estan calibrados contra las fotos de la publicacion, que se leen
pixel a pixel desde el navegador. El nogal del Berlim promedia (120, 92, 72) en
la foto real y el frente negro (38, 38, 38) neutro; el render arrancaba en
(135, 90, 49) y (33, 28, 23), o sea naranja y marron. De ahi salieron el color de
la veta, el negro del frente (que no es negro) y las luces casi neutras: una foto
de catalogo se toma con luz de estudio equilibrada, y si el render la quiere
igualar tiene que hacer lo mismo.

## Los cantos

Un tablero de melamina no termina en arista viva: trae su cinta de canto y queda
un radio de un milimetro largo. Parece un detalle de maniatico y es, de lejos, lo
que mas separa un render de una foto — una arista perfecta a 90 grados no puede
devolver un brillo, pasa de una cara a la otra sin transicion y el ojo lee "caja
de computadora".

`geometriaCaja` en `comun.js` arma la caja con los cantos redondeados: cada cara
lleva una grilla que concentra los vertices en el borde, y cada vertice se
proyecta sobre la superficie redondeada recortandolo contra la caja interior. La
subdivision no es pareja a proposito; el bisel mide milimetros sobre tableros de
metros, y repartiendo los vertices por igual la banda redondeada se comeria medio
panel.

Cuesta unos 430 triangulos por caja contra 12, asi que `tools/exportar.html`
llama a `setBisel(0)` antes de generar los modelos de AR: ese archivo viaja por
datos moviles y el telefono lo mira a un metro.

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

### Abierto o cerrado

El mueble se apoya en el cuarto **como se lo este mirando en la ficha**: si el
visitante abrio las puertas en la Vista 3D y despues toca "Ver en tu ambiente",
aparece abierto.

Son dos archivos, no una opcion del visor. Quick Look y Scene Viewer son visores
del sistema operativo: reciben un archivo, lo apoyan en el piso y dejan girarlo,
pero **no hay manera de mandarles un toque sobre una parte del modelo** ni de
pedirles que reproduzcan algo a demanda. Lo unico que se puede elegir es cual de
los dos archivos abrir, y eso se decide antes de salir de la pagina. De ahi el
par `nombre.glb` / `nombre-abierto.glb` de cada producto y color.

El estado de las puertas vive en un solo lugar: el modulo del producto avisa por
`alCambiar(abierto)` y la ficha reenvia eso a `ar.setAbierto()`. La alternativa
—que la ficha lleve su propio booleano escuchando el mismo boton— son dos
estados para una sola cosa, y el de AR terminaria apuntando al archivo
equivocado en cuanto alguno de los dos caminos cambie.

El angulo de apertura es uno solo, `GRADOS_APERTURA` en `comun.js`, y lo comparten
la animacion del visor y el modelo que se exporta. Si se separaran, el mueble se
abriria de una manera en la pantalla y de otra en el cuarto.

### Regenerar los modelos

Los `.glb` / `.usdz` de `3d/models/` se generan en el navegador y se commitean.
De cada producto y color salen cuatro archivos: cerrado y abierto, en los dos
formatos.

Tres cosas se sacan a proposito antes de exportar, todas por el mismo motivo —
el archivo se baja por datos moviles para mirarlo a un metro y medio a traves de
la camara de un telefono:

- **el contenido interior** (ropa, cajas, almohadas), que solo suma peso;
- **el bisel de los cantos**, que multiplica por treinta y cinco los triangulos
  de cada caja;
- **los mapas de normales** de la veta y la laca. Medido en el propio
  exportador: con ellos el GLB del Berlim pasa de 733 a 1320 KB y el del
  Florencia de 957 a 2129 KB, porque van embebidos como PNG y cada material
  lleva el suyo. Medio mega de relieve que a esa distancia no se ve.

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

**El JavaScript va con `no-cache`, y no es un descuido.** Sin build step las
URLs no llevan hash, asi que `/3d/three-d-stage.js` es siempre la misma
direccion. Con `max-age=3600` — que es lo que habia — uno arregla un error,
despliega, y el navegador de quien ya habia entrado sigue usando el archivo
roto durante una hora sin llegar a preguntar: recargar no cambia nada y el
arreglo parece no haber salido. `no-cache` no quiere decir "no guardes", quiere
decir "revalida antes de usar": el archivo sigue en disco y la consulta se
responde con un 304 de unos pocos bytes. Los modelos son otra cosa — pesan un
mega, cambian solo cuando se reexportan, y conservan su dia de cache por las
reglas de abajo, que al ser mas especificas ganan sobre esta.
