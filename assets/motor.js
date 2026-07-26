/* =========================================================================
   Motor de Scrabble — tablero, valores de fichas y cálculo de puntuación.
   Tablero estándar 15x15 (edición Deluxe Selchow & Righter, 1982).
   ========================================================================= */

const TAM = 15;

/* Mapa de casillas premium.
   T = palabra triple · D = palabra doble · t = letra triple · d = letra doble
   C = centro (cuenta como palabra doble) */
const MAPA_PREMIOS = [
  'T..d...T...d..T',
  '.D...t...t...D.',
  '..D...d.d...D..',
  'd..D...d...D..d',
  '....D.....D....',
  '.t...t...t...t.',
  '..d...d.d...d..',
  'T..d...C...d..T',
  '..d...d.d...d..',
  '.t...t...t...t.',
  '....D.....D....',
  'd..D...d...D..d',
  '..D...d.d...D..',
  '.D...t...t...D.',
  'T..d...T...d..T',
];

const PREMIO = { T: 'TP', D: 'DP', t: 'TL', d: 'DL', C: 'CENTRO' };

const ETIQUETA_PREMIO = {
  TP: { corto: '3P', nombre: 'Palabra triple' },
  DP: { corto: '2P', nombre: 'Palabra doble' },
  TL: { corto: '3L', nombre: 'Letra triple' },
  DL: { corto: '2L', nombre: 'Letra doble' },
  CENTRO: { corto: '★', nombre: 'Centro (palabra doble)' },
};

/* Juegos de fichas. El tablero de las fotos es el set en INGLÉS
   (A-9, B-2, C-2, D-4, E-12 ... coincide con el panel de frecuencias). */
const JUEGOS = {
  en: {
    nombre: 'Inglés (el de tu tablero)',
    valores: {
      A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1, J: 8, K: 5,
      L: 1, M: 3, N: 1, O: 1, P: 3, Q: 10, R: 1, S: 1, T: 1, U: 1, V: 4,
      W: 4, X: 8, Y: 4, Z: 10,
    },
    cantidades: {
      A: 9, B: 2, C: 2, D: 4, E: 12, F: 2, G: 3, H: 2, I: 9, J: 1, K: 1,
      L: 4, M: 2, N: 6, O: 8, P: 2, Q: 1, R: 6, S: 4, T: 6, U: 4, V: 2,
      W: 2, X: 1, Y: 2, Z: 1,
    },
    comodines: 2,
    digrafos: [],
  },
  es: {
    nombre: 'Español (FISE)',
    valores: {
      A: 1, B: 3, C: 3, CH: 5, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1, J: 8,
      L: 1, LL: 8, M: 3, N: 1, 'Ñ': 8, O: 1, P: 3, Q: 5, R: 1, RR: 8,
      S: 1, T: 1, U: 1, V: 4, X: 8, Y: 4, Z: 10,
    },
    cantidades: {
      A: 12, B: 2, C: 4, CH: 1, D: 5, E: 12, F: 1, G: 2, H: 2, I: 6, J: 1,
      L: 4, LL: 1, M: 2, N: 5, 'Ñ': 1, O: 9, P: 2, Q: 1, R: 5, RR: 1,
      S: 6, T: 4, U: 5, V: 1, X: 1, Y: 1, Z: 1,
    },
    comodines: 2,
    digrafos: ['CH', 'LL', 'RR'],
  },
};

const DIRS = { H: [0, 1], V: [1, 0] };

/* ---------------------------------------------------------------- tablero */

function tableroVacio() {
  return Array.from({ length: TAM }, () => Array(TAM).fill(null));
}

function premioEn(f, c) {
  const ch = MAPA_PREMIOS[f][c];
  return PREMIO[ch] || null;
}

function dentro(f, c) {
  return f >= 0 && f < TAM && c >= 0 && c < TAM;
}

function tableroVacioDelTodo(tab) {
  return tab.every((fila) => fila.every((celda) => celda === null));
}

function clonarTablero(tab) {
  return tab.map((fila) => fila.slice());
}

/* ------------------------------------------------------------- resolución */

/* Una jugada se guarda como una "colocación": las letras que se escriben
   desde (f,c) en una dirección. Al reproducirla sobre el tablero actual,
   las casillas ya ocupadas NO cuentan como fichas nuevas — así el orden de
   las jugadas se puede cambiar sin recalcular nada a mano. */
function resolverJugada(tab, jugada) {
  const [df, dc] = DIRS[jugada.dir] || DIRS.H;
  const nuevas = [];
  const conflictos = [];

  jugada.letras.forEach((letra, i) => {
    const f = jugada.f + df * i;
    const c = jugada.c + dc * i;
    if (!dentro(f, c)) {
      conflictos.push(`La palabra se sale del tablero (${letra.ch})`);
      return;
    }
    const ocupada = tab[f][c];
    if (ocupada) {
      if (ocupada.ch !== letra.ch) {
        conflictos.push(
          `Fila ${f + 1}, col ${c + 1}: ya hay una "${ocupada.ch}" y esta jugada pone "${letra.ch}"`
        );
      }
    } else {
      nuevas.push({ f, c, ch: letra.ch, comodin: !!letra.comodin });
    }
  });

  return { nuevas, conflictos };
}

/* Recorre en una dirección hasta encontrar el borde o una casilla vacía */
function palabraEn(tab, f, c, [df, dc]) {
  let f0 = f;
  let c0 = c;
  while (dentro(f0 - df, c0 - dc) && tab[f0 - df][c0 - dc]) {
    f0 -= df;
    c0 -= dc;
  }
  const celdas = [];
  let ff = f0;
  let cc = c0;
  while (dentro(ff, cc) && tab[ff][cc]) {
    celdas.push({ f: ff, c: cc, ...tab[ff][cc] });
    ff += df;
    cc += dc;
  }
  return celdas;
}

/* ------------------------------------------------------------ puntuación */

function puntuarFichas(tab, nuevas, valores) {
  const errores = [];
  const avisos = [];

  if (!nuevas.length) {
    return { errores: ['La jugada no coloca ninguna ficha nueva'], avisos, palabras: [], total: 0, bingo: false };
  }

  for (const t of nuevas) {
    if (tab[t.f][t.c]) errores.push(`La casilla fila ${t.f + 1}, col ${t.c + 1} ya está ocupada`);
  }
  if (errores.length) return { errores, avisos, palabras: [], total: 0, bingo: false };

  const filas = new Set(nuevas.map((t) => t.f));
  const cols = new Set(nuevas.map((t) => t.c));
  const horizontal = filas.size === 1;
  const vertical = cols.size === 1;
  if (!horizontal && !vertical) {
    return {
      errores: ['Las fichas nuevas deben ir todas en la misma fila o en la misma columna'],
      avisos, palabras: [], total: 0, bingo: false,
    };
  }

  /* tablero temporal con la jugada puesta */
  const temp = clonarTablero(tab);
  for (const t of nuevas) temp[t.f][t.c] = { ch: t.ch, comodin: t.comodin };

  /* sin huecos entre la primera y la última ficha nueva */
  const eje = horizontal && !vertical ? 'H' : vertical && !horizontal ? 'V' : 'H';
  const [df, dc] = DIRS[eje];
  const idx = (t) => (eje === 'H' ? t.c : t.f);
  const fijo = eje === 'H' ? nuevas[0].f : nuevas[0].c;
  const desde = Math.min(...nuevas.map(idx));
  const hasta = Math.max(...nuevas.map(idx));
  for (let i = desde; i <= hasta; i++) {
    const f = eje === 'H' ? fijo : i;
    const c = eje === 'H' ? i : fijo;
    if (!temp[f][c]) {
      return {
        errores: ['Hay un hueco vacío entre las fichas de la jugada'],
        avisos, palabras: [], total: 0, bingo: false,
      };
    }
  }

  /* conexión con lo que ya hay */
  if (tableroVacioDelTodo(tab)) {
    if (!nuevas.some((t) => t.f === 7 && t.c === 7)) {
      avisos.push('La primera jugada debería pasar por la casilla central ★');
    }
    if (nuevas.length < 2) avisos.push('La primera jugada debe usar al menos dos fichas');
  } else {
    const toca = nuevas.some((t) =>
      [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([a, b]) => dentro(t.f + a, t.c + b) && tab[t.f + a][t.c + b])
    );
    if (!toca) avisos.push('Esta jugada no toca ninguna ficha ya colocada');
  }

  /* palabras formadas: la principal + las cruzadas */
  const grupos = [];
  if (nuevas.length === 1) {
    grupos.push(palabraEn(temp, nuevas[0].f, nuevas[0].c, DIRS.H));
    grupos.push(palabraEn(temp, nuevas[0].f, nuevas[0].c, DIRS.V));
  } else {
    grupos.push(palabraEn(temp, nuevas[0].f, nuevas[0].c, [df, dc]));
    const cruz = eje === 'H' ? DIRS.V : DIRS.H;
    for (const t of nuevas) grupos.push(palabraEn(temp, t.f, t.c, cruz));
  }

  const esNueva = new Set(nuevas.map((t) => `${t.f},${t.c}`));
  const vistas = new Set();
  const palabras = [];

  for (const celdas of grupos) {
    if (celdas.length < 2) continue;
    const clave = `${celdas[0].f},${celdas[0].c},${celdas.length},${celdas[1].f > celdas[0].f ? 'V' : 'H'}`;
    if (vistas.has(clave)) continue;
    vistas.add(clave);

    let suma = 0;
    let multPalabra = 1;
    const detalle = [];

    for (const celda of celdas) {
      const base = celda.comodin ? 0 : valores[celda.ch] ?? 0;
      let valor = base;
      let prem = null;
      if (esNueva.has(`${celda.f},${celda.c}`)) {
        prem = premioEn(celda.f, celda.c);
        if (prem === 'DL') valor = base * 2;
        else if (prem === 'TL') valor = base * 3;
        else if (prem === 'DP' || prem === 'CENTRO') multPalabra *= 2;
        else if (prem === 'TP') multPalabra *= 3;
      }
      suma += valor;
      detalle.push({ ch: celda.ch, base, valor, premio: prem, comodin: celda.comodin });
    }

    palabras.push({
      texto: celdas.map((x) => x.ch).join(''),
      celdas: celdas.map((x) => ({ f: x.f, c: x.c })),
      detalle,
      multPalabra,
      puntos: suma * multPalabra,
    });
  }

  const bingo = nuevas.length === 7;
  const total = palabras.reduce((a, p) => a + p.puntos, 0) + (bingo ? 50 : 0);

  return { errores, avisos, palabras, total, bingo, nuevas };
}

/* Aplica fichas nuevas al tablero (devuelve un tablero nuevo) */
function aplicarFichas(tab, nuevas, idJugada) {
  const out = clonarTablero(tab);
  for (const t of nuevas) out[t.f][t.c] = { ch: t.ch, comodin: t.comodin, jugada: idJugada };
  return out;
}

/* Recalcula toda la partida desde cero, en orden. */
function recalcularPartida(jugadas, valores) {
  let tab = tableroVacio();
  const resultados = [];

  for (const jugada of jugadas) {
    const { nuevas, conflictos } = resolverJugada(tab, jugada);
    let res;
    if (conflictos.length) {
      res = { errores: conflictos, avisos: [], palabras: [], total: 0, bingo: false, nuevas: [] };
    } else {
      res = puntuarFichas(tab, nuevas, valores);
    }
    resultados.push(res);
    if (!res.errores.length) tab = aplicarFichas(tab, nuevas, jugada.id);
  }

  return { tablero: tab, resultados };
}

/* Parte una palabra en fichas, respetando dígrafos con corchetes: CA[RR]O */
function partirEnFichas(texto, juego) {
  const fichas = [];
  const s = texto.toUpperCase();
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === '[') {
      const cierre = s.indexOf(']', i);
      if (cierre === -1) return { error: 'Falta cerrar un corchete "]"' };
      const dig = s.slice(i + 1, cierre);
      if (!juego.digrafos.includes(dig)) {
        return { error: `"${dig}" no es un dígrafo válido (${juego.digrafos.join(', ') || 'ninguno en este juego'})` };
      }
      fichas.push({ ch: dig, comodin: false });
      i = cierre + 1;
      continue;
    }
    if (ch === ' ' || ch === '-') { i++; continue; }
    if (ch === '?' || ch === '*') {
      /* un ? antes de una letra la marca como comodín: ?E */
      const sig = s[i + 1];
      if (!sig) return { error: 'Pon la letra después del "?" para marcar el comodín' };
      fichas.push({ ch: sig, comodin: true });
      i += 2;
      continue;
    }
    if (!(ch in juego.valores)) {
      return { error: `La letra "${ch}" no existe en el juego ${juego.nombre}` };
    }
    fichas.push({ ch, comodin: false });
    i++;
  }
  if (!fichas.length) return { error: 'Escribe una palabra' };
  return { fichas };
}

/* Cuántas fichas de cada letra siguen fuera del tablero (bolsa + atriles) */
function fichasRestantes(tab, juego) {
  const quedan = { ...juego.cantidades };
  let comodines = juego.comodines;

  for (const fila of tab) {
    for (const celda of fila) {
      if (!celda) continue;
      if (celda.comodin) comodines--;
      else if (celda.ch in quedan) quedan[celda.ch]--;
    }
  }

  const total = Object.values(quedan).reduce((a, b) => a + b, 0) + comodines;
  return { quedan, comodines, total };
}

window.Motor = {
  TAM, MAPA_PREMIOS, ETIQUETA_PREMIO, JUEGOS, DIRS,
  tableroVacio, premioEn, dentro, clonarTablero, tableroVacioDelTodo,
  resolverJugada, palabraEn, puntuarFichas, aplicarFichas, recalcularPartida,
  partirEnFichas, fichasRestantes,
};
