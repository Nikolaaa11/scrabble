# Contador de Scrabble

App web para llevar la puntuación de partidas de Scrabble a partir de una foto del
tablero, separando las palabras por jugador.

Pensada para el tablero **Deluxe de Selchow & Righter (1982, No. 71)** — el de la
base giratoria — pero sirve para cualquier tablero estándar de 15×15.

No necesita instalar nada: es HTML, CSS y JavaScript sin dependencias ni compilación.

## Cómo se usa

Abre `index.html` con doble clic (Chrome, Edge o Firefox).

1. **Sube la foto** del tablero en el panel de la derecha. Se queda solo en tu navegador.
2. **Alinéala con el tablero**: arrastra los cuatro puntos hasta las esquinas del área de
   juego. La rejilla dorada te enseña cómo va a quedar; cuando cuadre, pulsa *Alinear con
   el tablero*. La foto se endereza (se corrige la perspectiva) y aparece **debajo de la
   cuadrícula**, así que ves cada ficha dentro de su casilla y no te equivocas de
   coordenada. El deslizador de opacidad regula cuánto se ve.
   Si el tablero se sale del encuadre, puedes soltar los puntos fuera de la imagen.
3. **Pon los nombres** de los dos jugadores en el marcador (se guardan solos).
4. **Mete las palabras**, de dos formas:
   - *Sobre el tablero*: haz clic en una casilla y escribe. El cursor salta solo las
     casillas que ya tienen ficha. <kbd>Tab</kbd> cambia entre horizontal y vertical,
     <kbd>Enter</kbd> registra la jugada y <kbd>Esc</kbd> la cancela.
   - *Formulario «Añadir palabra a mano»*: palabra, fila, columna y dirección.
5. **Elige de quién es** cada jugada con el selector de turno antes de registrarla.
   El turno se alterna solo, y siempre puedes cambiar el dueño después con el botón
   de color en la lista de jugadas.

El marcador se actualiza en cada jugada y la partida se guarda en el navegador, así
que puedes cerrar y volver. El panel *Fichas que quedan* lleva la cuenta de lo que
sigue fuera del tablero (bolsa más atriles).

### Detalles que importan al puntuar

- Las **casillas premium solo cuentan la primera vez** que se cubren. Por eso la app
  trabaja con jugadas en orden, no con el tablero final: si cambias el orden con las
  flechas ▲▼, los puntos se recalculan solos.
- Se cuentan también las **palabras cruzadas** que se forman al colocar una ficha.
- **Bingo**: +50 puntos automáticos al usar las 7 fichas en una jugada.
- **Comodines**: valen 0. Actívalos con el botón «Comodín» antes de escribir la
  letra, o con `?E` en el formulario.
- La app **no valida el diccionario**: cuenta lo que le digas que hay en el tablero.

### Juegos de fichas

- **Inglés** (por defecto): es el de tu tablero — coincide con el panel de
  frecuencias impreso (A‑9, B‑2, C‑2, D‑4, E‑12…).
- **Español (FISE)**: incluye la Ñ y los dígrafos CH, LL y RR. Para meter un dígrafo
  usa los botones que aparecen junto a «Comodín», o corchetes en el formulario:
  `CA[RR]O`.

### Leer el tablero con IA

En «Foto del tablero» → *Leer el tablero de la foto con IA*, Claude lee la foto y
detecta las palabras y sus posiciones. Después repartes las palabras entre los
jugadores y ajustas el orden en la lista de jugadas.

Funciona bastante mejor si antes alineas la foto: se le manda la imagen ya enderezada,
donde cada casilla ocupa exactamente 1/15 de la imagen.

Hay dos caminos, y la app elige solo:

1. **Desplegada en Vercel con `ANTHROPIC_API_KEY`** — la llamada la hace la función
   `api/leer-tablero.js` en el servidor. Tú no tocas ninguna clave. Es lo recomendado.
2. **Abierta como archivo local** o sin clave en el servidor — la app te pide tu propia
   clave de API. Se guarda solo en tu navegador (`localStorage`) y se envía únicamente a
   `api.anthropic.com`. No la uses en un equipo compartido.

Ten en cuenta que a partir de una foto solo se ve el tablero final, no el orden real
de las jugadas. La app propone un orden plausible (empieza por la palabra del centro
y sigue por las que van conectando), pero si quieres los puntos exactos tendrás que
ajustar el orden a mano.

**Para que salga bien la foto**: que se vean las cuatro esquinas del área de juego, con
luz pareja y sin sombras fuertes encima de las fichas.

## Publicar en internet

Es un sitio estático con una función serverless: no hace falta ni build ni configuración.

**Vercel** — en [vercel.com/new](https://vercel.com/new) importa este repositorio.
Framework preset: *Other*. Sin comando de build ni carpeta de salida.

Para que la lectura con IA funcione sin claves en el navegador, añade la variable de
entorno en *Settings → Environment Variables*:

| Variable | Valor |
| --- | --- |
| `ANTHROPIC_API_KEY` | tu clave `sk-ant-…` |
| `MODELO_CLAUDE` | *(opcional)* por defecto `claude-opus-5` |

Vuelve a desplegar después de añadirla. Sin esa variable la app sigue funcionando: solo
que la lectura con IA te pedirá tu clave.

O desde la terminal, con Node instalado:

```bash
npx vercel --prod
```

**GitHub Pages** también sirve, pero ahí no hay servidor: la lectura con IA pedirá
siempre tu clave.

## Instalar en el móvil

Estando publicada en https, abre la web en el móvil y usa *Añadir a pantalla de inicio*.
Se instala como app y funciona sin conexión (todo menos la lectura con IA, que necesita
internet).

## Estructura

```
index.html              Estructura de la página
assets/estilos.css      Estilos
assets/motor.js         Motor: tablero, valores de fichas y cálculo de puntos
assets/alinear.js       Corrección de perspectiva de la foto (homografía)
assets/app.js           Interfaz: jugadas, marcador, foto, bolsa, IA
api/leer-tablero.js     Función serverless que llama a Claude
sw.js                   Service worker (uso sin conexión)
manifest.webmanifest    Datos para instalarla como app
```

`assets/motor.js` y `assets/alinear.js` no tocan el DOM y se pueden probar por separado:

- `puntuarFichas(tablero, fichasNuevas, valores)` puntúa una jugada sobre un tablero dado.
- `recalcularPartida(jugadas, valores)` rehace la partida entera en orden.
- `Alinear.transformacion(esquinas)` devuelve la homografía que lleva el cuadrado unidad
  al cuadrilátero marcado; `Alinear.rectificar()` endereza la foto con muestreo bilineal.
