/* =========================================================================
   Contador de Scrabble — interfaz
   ========================================================================= */

(function () {
  'use strict';

  const M = window.Motor;
  const CLAVE_GUARDADO = 'scrabble-contador-v1';
  const CLAVE_API = 'scrabble-contador-clave-api';
  const $ = (sel) => document.querySelector(sel);

  /* ------------------------------------------------------------- estado */

  const estado = {
    juego: 'en',
    jugadores: [{ nombre: 'Jugador 1' }, { nombre: 'Jugador 2' }],
    jugadas: [],
    turno: 0,
    foto: null,           // foto original tal cual la subió el usuario
    esquinas: null,       // las 4 esquinas del tablero en la foto (fracciones 0..1)
    fotoAlineada: null,   // la foto enderezada a un cuadrado, lista para el fondo
    verFoto: true,        // mostrarla debajo de la cuadrícula
    opacidadCasillas: 60, // 10..100
  };

  /* jugada en curso, todavía sin registrar */
  const pend = {
    cursor: null,      // {f, c}
    dir: 'H',
    fichas: [],        // [{f, c, ch, comodin}]
    comodinActivo: false,
    resaltado: null,   // id de jugada resaltada al hacer clic en una ficha
  };

  let vista = { tablero: M.tableroVacio(), resultados: [] };
  let siguienteId = 1;

  const valores = () => M.JUEGOS[estado.juego].valores;
  const juegoActual = () => M.JUEGOS[estado.juego];

  /* ------------------------------------------------------ persistencia */

  function guardar() {
    /* si no cabe todo, vamos soltando lo más pesado antes que perder la partida */
    const intentos = [
      estado,
      { ...estado, foto: null },
      { ...estado, foto: null, fotoAlineada: null },
    ];
    for (const datos of intentos) {
      try {
        localStorage.setItem(CLAVE_GUARDADO, JSON.stringify(datos));
        return;
      } catch (e) { /* probamos con menos peso */ }
    }
  }

  function cargar() {
    let crudo;
    try { crudo = localStorage.getItem(CLAVE_GUARDADO); } catch (e) { return; }
    if (!crudo) return;
    try {
      const d = JSON.parse(crudo);
      if (d.juego && M.JUEGOS[d.juego]) estado.juego = d.juego;
      if (Array.isArray(d.jugadores) && d.jugadores.length === 2) estado.jugadores = d.jugadores;
      if (Array.isArray(d.jugadas)) estado.jugadas = d.jugadas;
      if (typeof d.turno === 'number') estado.turno = d.turno;
      if (typeof d.foto === 'string') estado.foto = d.foto;
      if (Array.isArray(d.esquinas) && d.esquinas.length === 4) estado.esquinas = d.esquinas;
      if (typeof d.fotoAlineada === 'string') estado.fotoAlineada = d.fotoAlineada;
      if (typeof d.verFoto === 'boolean') estado.verFoto = d.verFoto;
      if (typeof d.opacidadCasillas === 'number') estado.opacidadCasillas = d.opacidadCasillas;
      siguienteId = estado.jugadas.reduce((a, j) => Math.max(a, j.id || 0), 0) + 1;
    } catch (e) { /* datos corruptos: empezamos limpio */ }
  }

  /* ------------------------------------------------------------ utilidades */

  let tiempoToast;
  function avisar(texto, malo) {
    const t = $('#toast');
    t.textContent = texto;
    t.classList.toggle('malo', !!malo);
    t.classList.add('visible');
    clearTimeout(tiempoToast);
    tiempoToast = setTimeout(() => t.classList.remove('visible'), 3200);
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /* Tablero "de trabajo": el confirmado más las fichas pendientes */
  function tableroConPendientes() {
    const t = M.clonarTablero(vista.tablero);
    for (const f of pend.fichas) t[f.f][f.c] = { ch: f.ch, comodin: f.comodin, pendiente: true };
    return t;
  }

  function duenioDeCelda(f, c) {
    const celda = vista.tablero[f][c];
    if (!celda || celda.jugada == null) return null;
    const j = estado.jugadas.find((x) => x.id === celda.jugada);
    return j ? j.jugador : null;
  }

  function recalcular() {
    vista = M.recalcularPartida(estado.jugadas, valores());
  }

  function totalDe(indiceJugador) {
    return estado.jugadas.reduce((suma, j, i) => {
      const r = vista.resultados[i];
      return j.jugador === indiceJugador && r && !r.errores.length ? suma + r.total : suma;
    }, 0);
  }

  /* ------------------------------------------------------- pintar tablero */

  function pintarTablero() {
    const tab = tableroConPendientes();
    const pendSet = new Set(pend.fichas.map((f) => `${f.f},${f.c}`));
    const resaltadas = new Set();

    if (pend.resaltado != null) {
      const idx = estado.jugadas.findIndex((j) => j.id === pend.resaltado);
      const res = vista.resultados[idx];
      if (res && res.nuevas) res.nuevas.forEach((t) => resaltadas.add(`${t.f},${t.c}`));
    }

    const vals = valores();
    let html = '';

    for (let f = 0; f < M.TAM; f++) {
      for (let c = 0; c < M.TAM; c++) {
        const clave = `${f},${c}`;
        const celda = tab[f][c];
        const premio = M.premioEn(f, c);
        const clases = ['celda'];
        let dentro = '';

        if (celda) {
          clases.push('ocupada');
          if (pendSet.has(clave)) clases.push('pendiente');
          else {
            const d = duenioDeCelda(f, c);
            if (d != null) clases.push('duenio-' + d);
          }
          if (celda.ch.length > 1) clases.push('digrafo');
          if (resaltadas.has(clave)) clases.push('resaltada');
          const v = celda.comodin ? '' : (vals[celda.ch] ?? '');
          dentro =
            `<span class="letra">${esc(celda.ch)}</span>` +
            (v !== '' ? `<span class="valor">${v}</span>` : '') +
            (celda.comodin ? '<span class="comodin-punto">•</span>' : '');
        } else if (premio) {
          clases.push('p-' + premio);
          dentro = premio === 'CENTRO' ? '★' : M.ETIQUETA_PREMIO[premio].corto;
        }

        if (pend.cursor && pend.cursor.f === f && pend.cursor.c === c) {
          clases.push('cursor');
          dentro += `<span class="flecha">${pend.dir === 'H' ? '▸' : '▾'}</span>`;
        }

        const titulo = premio ? M.ETIQUETA_PREMIO[premio].nombre : `Fila ${f + 1}, columna ${c + 1}`;
        html += `<button type="button" class="${clases.join(' ')}" data-f="${f}" data-c="${c}" title="${esc(titulo)}">${dentro}</button>`;
      }
    }

    $('#tablero').innerHTML = html;
  }

  /* ---------------------------------------------------- previsualización */

  function pintarPrevisualizacion() {
    const caja = $('#previsualizacion');

    if (!pend.fichas.length) {
      caja.innerHTML = pend.cursor
        ? '<span class="desglose">Escribe las letras de la jugada. Las que ya están en el tablero se saltan solas.</span>'
        : '<span class="desglose">Haz clic en una casilla del tablero para empezar una jugada, o usa el formulario «Añadir palabra a mano».</span>';
      $('#btn-confirmar').disabled = true;
      $('#btn-cancelar').disabled = true;
      return;
    }

    $('#btn-cancelar').disabled = false;
    const res = M.puntuarFichas(vista.tablero, pend.fichas, valores());

    if (res.errores.length) {
      caja.innerHTML = `<div class="msg-error">${res.errores.map(esc).join('<br>')}</div>`;
      $('#btn-confirmar').disabled = true;
      return;
    }

    $('#btn-confirmar').disabled = false;

    const desglose = res.palabras.map((p) => {
      const antes = p.puntos / p.multPalabra;
      const mult = p.multPalabra > 1 ? ` × ${p.multPalabra}` : '';
      return `<b>${esc(p.texto)}</b> ${antes}${mult} = ${p.puntos}`;
    }).join(' &nbsp;·&nbsp; ');

    caja.innerHTML =
      `<span class="puntos-grandes">${res.total}</span>` +
      `<div class="desglose">${desglose || 'Sin palabras completas todavía'}` +
      (res.bingo ? ' &nbsp;·&nbsp; <b style="color:var(--ok)">¡Bingo! +50</b>' : '') +
      `</div>` +
      (res.avisos.length ? `<div class="msg-aviso">${res.avisos.map(esc).join('<br>')}</div>` : '');
  }

  /* -------------------------------------------------------- marcador */

  function pintarMarcador() {
    const cont = $('#marcador');
    cont.innerHTML = estado.jugadores.map((j, i) => {
      const total = totalDe(i);
      const n = estado.jugadas.filter((x) => x.jugador === i).length;
      const bingos = estado.jugadas.filter((x, k) =>
        x.jugador === i && vista.resultados[k] && vista.resultados[k].bingo).length;
      return `
        <div class="jugador ${i === 1 ? 'j1' : ''} ${estado.turno === i ? 'activo' : ''}">
          <input class="alias" data-jugador="${i}" value="${esc(j.nombre)}" maxlength="24"
                 aria-label="Nombre del jugador ${i + 1}">
          <div class="total">${total}</div>
          <div class="meta">${n} jugada${n === 1 ? '' : 's'}${bingos ? ` · ${bingos} bingo${bingos === 1 ? '' : 's'}` : ''}</div>
        </div>`;
    }).join('');

    $('#ley-j1').textContent = estado.jugadores[0].nombre;
    $('#ley-j2').textContent = estado.jugadores[1].nombre;

    $('#selector-turno').innerHTML = estado.jugadores.map((j, i) => `
      <button type="button" data-turno="${i}" aria-pressed="${estado.turno === i}">
        <i class="punto j${i}"></i>${esc(j.nombre)}
      </button>`).join('');
  }

  /* --------------------------------------------------------- jugadas */

  function pintarJugadas() {
    const lista = $('#lista-jugadas');
    $('#contador-jugadas').textContent = estado.jugadas.length ? `(${estado.jugadas.length})` : '';

    if (!estado.jugadas.length) {
      lista.innerHTML = '<li class="vacio">Todavía no hay jugadas registradas.</li>';
      return;
    }

    lista.innerHTML = estado.jugadas.map((j, i) => {
      const r = vista.resultados[i] || {};
      const invalida = r.errores && r.errores.length;
      const principal = (r.palabras && r.palabras[0]) ? r.palabras[0].texto : j.letras.map((l) => l.ch).join('');
      const otras = (r.palabras || []).slice(1).map((p) => p.texto);
      const sub = invalida
        ? `<span class="msg-error">${esc(r.errores[0])}</span>`
        : `fila ${j.f + 1} · col ${j.c + 1} · ${j.dir === 'H' ? '→' : '↓'}` +
          (otras.length ? ` · también ${otras.map(esc).join(', ')}` : '') +
          (r.bingo ? ' · <b style="color:var(--ok)">bingo</b>' : '') +
          ((r.avisos && r.avisos.length) ? ' · <span class="msg-aviso">⚠</span>' : '');

      return `
        <li class="jugada ${j.jugador === 1 ? 'j1' : ''} ${invalida ? 'invalida' : ''}" data-id="${j.id}">
          <div class="num">${i + 1}</div>
          <div>
            <div class="palabra">${esc(principal)}</div>
            <div class="sub">${sub}</div>
          </div>
          <div class="acciones">
            <span class="pts">${invalida ? '—' : r.total}</span>
            <button class="btn-mini" data-accion="subir"   title="Mover antes">▲</button>
            <button class="btn-mini" data-accion="bajar"   title="Mover después">▼</button>
            <button class="btn-mini" data-accion="cambiar" title="Cambiar de jugador"><i class="punto j${j.jugador}" style="display:inline-block"></i></button>
            <button class="btn-mini" data-accion="borrar"  title="Borrar jugada">✕</button>
          </div>
        </li>`;
    }).join('');
  }

  /* ----------------------------------------------------------- pintar */

  function pintar() {
    recalcular();
    pintarTablero();
    pintarPrevisualizacion();
    pintarMarcador();
    pintarJugadas();
    pintarBolsa();
    $('#btn-deshacer').disabled = !estado.jugadas.length;
    $('#btn-direccion').textContent = pend.dir === 'H' ? '→ Horizontal' : '↓ Vertical';
    $('#btn-comodin').setAttribute('aria-pressed', String(pend.comodinActivo));
    $('#btn-comodin').textContent = pend.comodinActivo ? 'Comodín: SÍ' : 'Comodín: no';
    guardar();
    if (pend.cursor && (document.activeElement === document.body || document.activeElement === null)) {
      $('#entrada-fantasma').focus({ preventScroll: true });
    }
  }

  /* ------------------------------------------------- escribir en tablero */

  function siguienteLibre(f, c) {
    const tab = tableroConPendientes();
    const [df, dc] = M.DIRS[pend.dir];
    let ff = f + df;
    let cc = c + dc;
    while (M.dentro(ff, cc) && tab[ff][cc]) { ff += df; cc += dc; }
    return M.dentro(ff, cc) ? { f: ff, c: cc } : null;
  }

  function ponerLetra(ch) {
    if (!pend.cursor) return;
    const { f, c } = pend.cursor;
    const tab = tableroConPendientes();
    if (tab[f][c]) { avisar('Esa casilla ya está ocupada'); return; }

    pend.fichas.push({ f, c, ch, comodin: pend.comodinActivo });
    pend.comodinActivo = false;
    pend.cursor = siguienteLibre(f, c) || pend.cursor;
    pend.resaltado = null;
    pintar();
  }

  function borrarUltima() {
    if (pend.fichas.length) {
      const ultima = pend.fichas.pop();
      pend.cursor = { f: ultima.f, c: ultima.c };
    } else if (pend.cursor) {
      const [df, dc] = M.DIRS[pend.dir];
      const f = pend.cursor.f - df;
      const c = pend.cursor.c - dc;
      if (M.dentro(f, c)) pend.cursor = { f, c };
    }
    pintar();
  }

  function cancelarJugada() {
    pend.fichas = [];
    pend.cursor = null;
    pend.comodinActivo = false;
    pend.resaltado = null;
    pintar();
  }

  /* Convierte las fichas pendientes en una jugada guardable */
  function jugadaDesdePendientes() {
    if (!pend.fichas.length) return null;
    const filas = new Set(pend.fichas.map((t) => t.f));
    const dir = filas.size === 1 && pend.fichas.length > 1 ? 'H'
      : (new Set(pend.fichas.map((t) => t.c)).size === 1 && pend.fichas.length > 1 ? 'V' : pend.dir);

    const tab = tableroConPendientes();
    const [df, dc] = M.DIRS[dir];
    const idx = (t) => (dir === 'H' ? t.c : t.f);
    const fijo = dir === 'H' ? pend.fichas[0].f : pend.fichas[0].c;
    const desde = Math.min(...pend.fichas.map(idx));
    const hasta = Math.max(...pend.fichas.map(idx));

    const letras = [];
    for (let i = desde; i <= hasta; i++) {
      const f = dir === 'H' ? fijo : i;
      const c = dir === 'H' ? i : fijo;
      const celda = tab[f][c];
      if (!celda) return null;
      letras.push({ ch: celda.ch, comodin: !!celda.comodin });
    }

    return {
      id: siguienteId++,
      jugador: estado.turno,
      f: dir === 'H' ? fijo : desde,
      c: dir === 'H' ? desde : fijo,
      dir,
      letras,
    };
  }

  function confirmarJugada() {
    const jugada = jugadaDesdePendientes();
    if (!jugada) { avisar('No hay una jugada válida que registrar', true); return; }

    const res = M.puntuarFichas(vista.tablero, pend.fichas, valores());
    if (res.errores.length) { avisar(res.errores[0], true); return; }

    estado.jugadas.push(jugada);
    const puntos = res.total;
    const quien = estado.jugadores[estado.turno].nombre;
    estado.turno = 1 - estado.turno;
    cancelarJugada();
    avisar(`${quien}: +${puntos} puntos`);
  }

  /* ------------------------------------------------ añadir palabra a mano */

  function anadirPalabraFormulario() {
    const texto = $('#f-palabra').value.trim();
    const f = parseInt($('#f-fila').value, 10) - 1;
    const c = parseInt($('#f-col').value, 10) - 1;
    const dir = $('#f-dir').value;

    if (!texto) { avisar('Escribe la palabra', true); return; }
    if (!M.dentro(f, c)) { avisar('Fila y columna deben ir de 1 a 15', true); return; }

    const partido = M.partirEnFichas(texto, juegoActual());
    if (partido.error) { avisar(partido.error, true); return; }

    const jugada = { id: siguienteId++, jugador: estado.turno, f, c, dir, letras: partido.fichas };
    const { nuevas, conflictos } = M.resolverJugada(vista.tablero, jugada);
    if (conflictos.length) { avisar(conflictos[0], true); siguienteId--; return; }
    if (!nuevas.length) { avisar('Esa palabra ya está entera en el tablero', true); siguienteId--; return; }

    const res = M.puntuarFichas(vista.tablero, nuevas, valores());
    if (res.errores.length) { avisar(res.errores[0], true); siguienteId--; return; }

    estado.jugadas.push(jugada);
    const quien = estado.jugadores[estado.turno].nombre;
    estado.turno = 1 - estado.turno;
    $('#f-palabra').value = '';
    $('#f-fila').value = '';
    $('#f-col').value = '';
    pintar();
    avisar(`${quien}: +${res.total} puntos`);
  }

  /* --------------------------------------------------------------- foto */

  function redimensionar(archivo, maxLado) {
    return new Promise((resolve, reject) => {
      const lector = new FileReader();
      lector.onerror = () => reject(new Error('No se pudo leer el archivo'));
      lector.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('El archivo no es una imagen válida'));
        img.onload = () => {
          const escala = Math.min(1, maxLado / Math.max(img.width, img.height));
          const lienzo = document.createElement('canvas');
          lienzo.width = Math.round(img.width * escala);
          lienzo.height = Math.round(img.height * escala);
          lienzo.getContext('2d').drawImage(img, 0, 0, lienzo.width, lienzo.height);
          resolve(lienzo.toDataURL('image/jpeg', 0.82));
        };
        img.src = lector.result;
      };
      lector.readAsDataURL(archivo);
    });
  }

  async function cargarFoto(archivo) {
    if (!archivo || !archivo.type.startsWith('image/')) { avisar('Elige un archivo de imagen', true); return; }
    try {
      estado.foto = await redimensionar(archivo, 1500);
      estado.esquinas = null;
      estado.fotoAlineada = null;
      $('#estado-alineado').textContent = '';
      pintarFoto();
      guardar();
      avisar('Foto cargada. Ahora marca las cuatro esquinas del tablero.');
    } catch (e) {
      avisar(e.message, true);
    }
  }

  /* Arrastre de las cuatro esquinas sobre la foto */
  function conectarTiradores() {
    const caja = $('#alineador');
    let activo = null;

    /* se permite salirse de la foto: hay tableros que no caben enteros en el encuadre */
    const LIMITE = 0.35;
    const acotar = (n) => Math.min(1 + LIMITE, Math.max(-LIMITE, n));

    const posicionRelativa = (ev) => {
      const r = caja.getBoundingClientRect();
      return {
        x: acotar((ev.clientX - r.left) / r.width),
        y: acotar((ev.clientY - r.top) / r.height),
      };
    };

    caja.addEventListener('pointerdown', (ev) => {
      const t = ev.target.closest('.tirador');
      if (!t) return;
      ev.preventDefault();
      activo = +t.dataset.esquina;
      estado.esquinas = esquinasActuales();
      t.setPointerCapture(ev.pointerId);
    });

    caja.addEventListener('pointermove', (ev) => {
      if (activo === null) return;
      ev.preventDefault();
      estado.esquinas[activo] = posicionRelativa(ev);
      pintarAlineador();
    });

    const soltar = () => {
      if (activo === null) return;
      activo = null;
      guardar();
    };
    caja.addEventListener('pointerup', soltar);
    caja.addEventListener('pointercancel', soltar);

    /* accesible con teclado: flechas mueven la esquina enfocada */
    caja.addEventListener('keydown', (ev) => {
      const t = ev.target.closest('.tirador');
      if (!t || !ev.key.startsWith('Arrow')) return;
      ev.preventDefault();
      const paso = ev.shiftKey ? 0.01 : 0.002;
      const d = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[ev.key];
      estado.esquinas = esquinasActuales();
      const p = estado.esquinas[+t.dataset.esquina];
      p.x = acotar(p.x + d[0] * paso);
      p.y = acotar(p.y + d[1] * paso);
      pintarAlineador();
      guardar();
    });
  }

  function pintarFoto() {
    const cont = $('#foto-contenedor');
    if (!estado.foto) {
      cont.innerHTML = `
        <div class="zona-foto" id="zona-foto">
          <strong>Sube una foto del tablero</strong><br>
          Arrástrala aquí o haz clic para elegirla.<br>
          <span style="opacity:.75">Se queda solo en este navegador.</span>
        </div>`;
    } else {
      cont.innerHTML = `
        <div class="foto-caja">
          <img src="${estado.fotoAlineada || estado.foto}" id="foto-img" alt="Foto del tablero">
          <button class="btn btn-mini quitar" id="btn-quitar-foto">Quitar</button>
        </div>`;
    }

    $('#panel-alineado').hidden = !estado.foto;
    $('#control-fondo').hidden = !estado.fotoAlineada;
    $('#ver-foto').checked = estado.verFoto;
    $('#opacidad-foto').value = estado.opacidadCasillas;

    if (estado.foto) {
      const img = $('#alin-img');
      if (img.getAttribute('src') !== estado.foto) img.src = estado.foto;
      pintarAlineador();
    }
    pintarCapaFoto();
  }

  function esquinasActuales() {
    return estado.esquinas || window.Alinear.ESQUINAS_POR_DEFECTO.map((p) => ({ ...p }));
  }

  /* Tiradores + rejilla de previsualización sobre la foto sin enderezar */
  function pintarAlineador() {
    const esq = esquinasActuales();

    document.querySelectorAll('.tirador').forEach((t) => {
      const p = esq[+t.dataset.esquina];
      t.style.left = (p.x * 100) + '%';
      t.style.top = (p.y * 100) + '%';
    });

    const svg = $('#alin-svg');
    const lineas = window.Alinear.lineasDeCuadricula(esq, M.TAM);
    const puntos = (ps) => ps.map(([x, y]) => `${x.toFixed(5)},${y.toFixed(5)}`).join(' ');

    svg.innerHTML =
      lineas.map((l) =>
        `<polyline class="rejilla" points="${puntos(l)}" vector-effect="non-scaling-stroke" stroke-width="1"/>`
      ).join('') +
      `<polygon class="marco" points="${puntos(esq.map((p) => [p.x, p.y]))}" vector-effect="non-scaling-stroke"/>`;
  }

  /* La foto enderezada, debajo de la cuadrícula */
  function pintarCapaFoto() {
    const capa = document.querySelector('.tablero-capa');
    const activa = !!(estado.fotoAlineada && estado.verFoto);
    capa.classList.toggle('con-foto', activa);
    $('#capa-foto').style.backgroundImage = activa ? `url("${estado.fotoAlineada}")` : '';
    capa.style.setProperty('--op-casilla', (estado.opacidadCasillas / 100).toFixed(2));
  }

  async function rectificarFoto() {
    const est = $('#estado-alineado');
    const boton = $('#btn-rectificar');
    boton.disabled = true;
    est.innerHTML = '<span class="cargando"></span> Enderezando la foto…';
    try {
      /* dejamos que el navegador pinte el mensaje antes de bloquear con el cálculo */
      await new Promise((r) => setTimeout(r, 30));
      estado.esquinas = esquinasActuales();
      estado.fotoAlineada = await window.Alinear.rectificar(estado.foto, estado.esquinas, 675);
      estado.verFoto = true;
      est.innerHTML = '<span class="msg-ok">Listo.</span> Ya puedes ver el tablero real debajo de la cuadrícula.';
      pintarFoto();
      pintar();
      avisar('Foto alineada con el tablero');
    } catch (e) {
      est.innerHTML = `<span class="msg-error">${esc(e.message)}</span>`;
    } finally {
      boton.disabled = false;
    }
  }

  /* ------------------------------------------------------ bolsa de fichas */

  function pintarBolsa() {
    const juego = juegoActual();
    const { quedan, comodines, total } = M.fichasRestantes(vista.tablero, juego);
    $('#total-bolsa').textContent = `(${total} de 100)`;

    const celda = (etiqueta, n, valor) => {
      const clases = ['ficha-bolsa'];
      if (n <= 0) clases.push('agotada');
      else if (n === 1) clases.push('pocas');
      return `<div class="${clases.join(' ')}" title="${esc(etiqueta)} · ${valor} puntos">
        ${esc(etiqueta)}<small>${Math.max(0, n)}</small></div>`;
    };

    $('#bolsa').innerHTML =
      Object.keys(juego.cantidades).map((ch) => celda(ch, quedan[ch], juego.valores[ch])).join('') +
      celda('▢', comodines, 0);
  }

  /* ------------------------------------------------------ lectura con IA */

  const PROMPT_ALINEADA = `Esta imagen es un tablero de Scrabble ya recortado y enderezado: ocupa exactamente la imagen completa y son 15x15 casillas del mismo tamaño.

Lee todas las fichas colocadas y devuelve la cuadrícula completa.

- La casilla de la fila 1, columna 1 es la esquina superior izquierda de la imagen. Cada casilla mide justo 1/15 del ancho y 1/15 del alto.
- La casilla central (fila 8, columna 8) es la de la estrella.
- Devuelve exactamente 15 líneas de 15 caracteres. Un punto "." para casilla vacía, la letra mayúscula para casilla con ficha.
- No inventes letras: si dudas entre dos, elige la más probable, pero si la casilla está vacía pon ".".
- Las fichas llevan un número pequeño en la esquina (su valor). Ignóralo, solo importa la letra grande.

Responde SOLO con JSON, sin texto alrededor y sin bloques de código:
{"cuadricula":["...............","..............." , ... 15 líneas ...]}`;

  const PROMPT_CRUDA = `Estás mirando la foto de un tablero de Scrabble de 15x15 casillas.

Lee todas las fichas colocadas y devuelve la cuadrícula completa.

- La fila 1 es la de arriba y la columna 1 la de la izquierda. Usa las casillas de premio (las esquinas "TRIPLE WORD SCORE", la estrella central, el patrón simétrico de casillas de colores) como referencia para alinear bien las coordenadas.
- La casilla central (fila 8, columna 8) es la de la estrella.
- Si la foto está girada o en perspectiva, corrígelo mentalmente antes de leer.
- Devuelve exactamente 15 líneas de 15 caracteres. Un punto "." para casilla vacía, la letra mayúscula para casilla con ficha.
- No inventes letras. Si la casilla está vacía pon ".".
- Las fichas llevan un número pequeño en la esquina (su valor). Ignóralo, solo importa la letra grande.

Responde SOLO con JSON, sin texto alrededor y sin bloques de código:
{"cuadricula":["...............","..............." , ... 15 líneas ...]}`;

  /* Primero se intenta la función del servidor (sin claves en el navegador).
     Si no existe —app abierta como archivo local o sin desplegar— se usa la
     clave que haya puesto el usuario. */
  async function pedirLecturaAlServidor(base64, alineada) {
    if (location.protocol === 'file:') return null;
    let resp;
    try {
      resp = await fetch('api/leer-tablero', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ imagen: base64, alineada }),
      });
    } catch (e) {
      return null;                        /* sin red o sin servidor */
    }
    if (resp.status === 404 || resp.status === 405 || resp.status === 501) return null;
    const datos = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(datos.error || `El servidor respondió ${resp.status}`);
    return datos.texto;
  }

  async function pedirLecturaConClave(base64, alineada, clave) {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': clave,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-opus-5',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } },
            { type: 'text', text: alineada ? PROMPT_ALINEADA : PROMPT_CRUDA },
          ],
        }],
      }),
    });

    if (!resp.ok) {
      const cuerpo = await resp.text();
      let detalle = cuerpo;
      try { detalle = JSON.parse(cuerpo).error.message; } catch (e) { /* texto plano */ }
      throw new Error(`La API respondió ${resp.status}: ${detalle}`);
    }
    const datos = await resp.json();
    return (datos.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  }

  async function leerConIA() {
    if (!estado.foto) { avisar('Primero sube una foto del tablero', true); return; }

    const est = $('#estado-ia');
    const boton = $('#btn-leer-ia');
    boton.disabled = true;
    est.innerHTML = '<span class="cargando"></span> Leyendo el tablero…';

    /* la foto enderezada se lee mucho mejor que la original */
    const fuente = estado.fotoAlineada || estado.foto;
    const alineada = !!estado.fotoAlineada;
    const base64 = fuente.slice(fuente.indexOf(',') + 1);

    try {
      let texto = await pedirLecturaAlServidor(base64, alineada);

      if (texto === null) {
        const clave = $('#clave-api').value.trim();
        if (!clave) {
          $('#det-clave').open = true;
          throw new Error('No hay lectura en el servidor. Pega tu clave de API de Anthropic aquí abajo, o despliega la app en Vercel con ANTHROPIC_API_KEY configurada.');
        }
        try { localStorage.setItem(CLAVE_API, clave); } catch (e) { /* sin almacenamiento */ }
        texto = await pedirLecturaConClave(base64, alineada, clave);
      }

      const cuadricula = extraerCuadricula(texto);
      const jugadas = derivarJugadas(cuadricula);

      if (!jugadas.length) throw new Error('No se detectó ninguna palabra en la foto');

      const seguir = estado.jugadas.length
        ? confirm(`Se detectaron ${jugadas.length} palabras. Esto reemplaza las ${estado.jugadas.length} jugadas actuales. ¿Continuar?`)
        : true;
      if (!seguir) { est.textContent = 'Cancelado.'; boton.disabled = false; return; }

      estado.jugadas = jugadas.map((j, i) => ({ ...j, id: siguienteId++, jugador: i % 2 }));
      estado.turno = estado.jugadas.length % 2;
      cancelarJugada();
      est.innerHTML = `<span class="msg-ok">Se detectaron ${jugadas.length} palabras.</span> Revisa el orden y a quién pertenece cada una en la lista de jugadas.`;
      avisar(`${jugadas.length} palabras detectadas`);
    } catch (e) {
      est.innerHTML = `<span class="msg-error">${esc(e.message)}</span>`;
    } finally {
      boton.disabled = false;
    }
  }

  function extraerCuadricula(texto) {
    const desde = texto.indexOf('{');
    const hasta = texto.lastIndexOf('}');
    if (desde === -1 || hasta === -1) throw new Error('La respuesta de la IA no tenía el formato esperado');
    const datos = JSON.parse(texto.slice(desde, hasta + 1));
    const cuadricula = datos.cuadricula || datos.grid;
    if (!Array.isArray(cuadricula) || cuadricula.length !== 15) {
      throw new Error('La IA no devolvió una cuadrícula de 15 filas');
    }
    return cuadricula.map((fila, i) => {
      const s = String(fila).toUpperCase().replace(/\s/g, '');
      if (s.length !== 15) throw new Error(`La fila ${i + 1} no tiene 15 casillas`);
      return s;
    });
  }

  /* Convierte una cuadrícula completa en una secuencia de jugadas plausible:
     empieza por la palabra del centro y va añadiendo las que más letras
     nuevas aportan y tocan lo ya colocado. */
  function derivarJugadas(cuadricula) {
    const lleno = (f, c) => cuadricula[f][c] !== '.';
    const rachas = [];

    for (let f = 0; f < 15; f++) {
      let c = 0;
      while (c < 15) {
        if (!lleno(f, c)) { c++; continue; }
        let fin = c;
        while (fin + 1 < 15 && lleno(f, fin + 1)) fin++;
        if (fin - c + 1 >= 2) rachas.push({ f, c, dir: 'H', largo: fin - c + 1 });
        c = fin + 1;
      }
    }
    for (let c = 0; c < 15; c++) {
      let f = 0;
      while (f < 15) {
        if (!lleno(f, c)) { f++; continue; }
        let fin = f;
        while (fin + 1 < 15 && lleno(fin + 1, c)) fin++;
        if (fin - f + 1 >= 2) rachas.push({ f, c, dir: 'V', largo: fin - f + 1 });
        f = fin + 1;
      }
    }

    const celdasDe = (r) => Array.from({ length: r.largo }, (_, i) => ({
      f: r.dir === 'H' ? r.f : r.f + i,
      c: r.dir === 'H' ? r.c + i : r.c,
    }));

    const cubiertas = new Set();
    const pendientes = rachas.slice();
    const orden = [];

    /* la primera es la que pasa por el centro, si existe */
    let primera = pendientes.findIndex((r) => celdasDe(r).some((x) => x.f === 7 && x.c === 7));
    if (primera === -1) primera = 0;

    let elegida = pendientes.splice(primera, 1)[0];
    while (elegida) {
      orden.push(elegida);
      celdasDe(elegida).forEach((x) => cubiertas.add(`${x.f},${x.c}`));

      let mejor = -1;
      let mejorPunt = -1;
      pendientes.forEach((r, i) => {
        const celdas = celdasDe(r);
        const nuevas = celdas.filter((x) => !cubiertas.has(`${x.f},${x.c}`)).length;
        if (!nuevas) return;
        const toca = celdas.some((x) => cubiertas.has(`${x.f},${x.c}`));
        const punt = (toca ? 1000 : 0) - nuevas;   /* preferimos conectadas y cortas */
        if (punt > mejorPunt) { mejorPunt = punt; mejor = i; }
      });

      elegida = mejor === -1 ? null : pendientes.splice(mejor, 1)[0];
    }

    return orden.map((r) => ({
      f: r.f,
      c: r.c,
      dir: r.dir,
      letras: celdasDe(r).map((x) => ({ ch: cuadricula[x.f][x.c], comodin: false })),
    }));
  }

  /* ----------------------------------------------------------- eventos */

  function conectarEventos() {
    /* --- tablero --- */
    $('#tablero').addEventListener('click', (ev) => {
      const btn = ev.target.closest('.celda');
      if (!btn) return;
      const f = +btn.dataset.f;
      const c = +btn.dataset.c;
      const celda = vista.tablero[f][c];

      if (celda && !pend.fichas.some((t) => t.f === f && t.c === c)) {
        /* clic sobre una ficha ya colocada: resalta su jugada */
        pend.resaltado = pend.resaltado === celda.jugada ? null : celda.jugada;
        pintar();
        const li = document.querySelector(`.jugada[data-id="${celda.jugada}"]`);
        if (li && pend.resaltado != null) li.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        return;
      }

      if (pend.cursor && pend.cursor.f === f && pend.cursor.c === c) {
        pend.dir = pend.dir === 'H' ? 'V' : 'H';
      } else {
        pend.cursor = { f, c };
      }
      pend.resaltado = null;
      pintar();
      $('#entrada-fantasma').focus({ preventScroll: true });
    });

    /* --- teclado --- */
    const fantasma = $('#entrada-fantasma');

    fantasma.addEventListener('input', () => {
      const texto = fantasma.value.toUpperCase();
      fantasma.value = '';
      for (const ch of texto) {
        if (ch === '?' || ch === '*') { pend.comodinActivo = true; pintar(); continue; }
        if (ch in valores()) ponerLetra(ch);
      }
    });

    document.addEventListener('keydown', (ev) => {
      const enCampo = ev.target.matches('input, select, textarea') && ev.target !== fantasma;
      if (enCampo) return;

      if (ev.key === 'Tab' && pend.cursor) {
        ev.preventDefault();
        pend.dir = pend.dir === 'H' ? 'V' : 'H';
        pintar();
      } else if (ev.key === 'Backspace') {
        ev.preventDefault();
        borrarUltima();
      } else if (ev.key === 'Enter') {
        ev.preventDefault();
        if (pend.fichas.length) confirmarJugada();
      } else if (ev.key === 'Escape') {
        cancelarJugada();
      } else if (ev.key.startsWith('Arrow') && pend.cursor) {
        ev.preventDefault();
        const d = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[ev.key];
        const f = pend.cursor.f + d[0];
        const c = pend.cursor.c + d[1];
        if (M.dentro(f, c)) { pend.cursor = { f, c }; pintar(); }
      } else if (ev.target === document.body && ev.key.length === 1) {
        const ch = ev.key.toUpperCase();
        if (ch === '?' || ch === '*') { pend.comodinActivo = true; pintar(); }
        else if (ch in valores()) { ponerLetra(ch); }
        fantasma.focus({ preventScroll: true });
      }
    });

    /* --- botones de la barra --- */
    $('#btn-direccion').addEventListener('click', () => {
      pend.dir = pend.dir === 'H' ? 'V' : 'H';
      pintar();
    });

    $('#btn-comodin').addEventListener('click', () => {
      pend.comodinActivo = !pend.comodinActivo;
      pintar();
    });

    $('#btn-confirmar').addEventListener('click', confirmarJugada);
    $('#btn-cancelar').addEventListener('click', cancelarJugada);

    $('#btn-deshacer').addEventListener('click', () => {
      if (!estado.jugadas.length) return;
      const fuera = estado.jugadas.pop();
      estado.turno = fuera.jugador;
      pintar();
      avisar('Última jugada borrada');
    });

    $('#btn-nueva').addEventListener('click', () => {
      if (!confirm('¿Empezar una partida nueva? Se borran las jugadas y la foto (los nombres se conservan).')) return;
      estado.jugadas = [];
      estado.turno = 0;
      estado.foto = null;
      estado.esquinas = null;
      estado.fotoAlineada = null;
      $('#estado-alineado').textContent = '';
      $('#estado-ia').textContent = '';
      cancelarJugada();
      pintarFoto();
      avisar('Partida nueva');
    });

    /* --- alineado de la foto --- */
    $('#btn-rectificar').addEventListener('click', rectificarFoto);

    $('#btn-reset-esquinas').addEventListener('click', () => {
      estado.esquinas = null;
      pintarAlineador();
      guardar();
    });

    $('#ver-foto').addEventListener('change', (ev) => {
      estado.verFoto = ev.target.checked;
      pintarCapaFoto();
      guardar();
    });

    $('#opacidad-foto').addEventListener('input', (ev) => {
      estado.opacidadCasillas = +ev.target.value;
      pintarCapaFoto();
    });
    $('#opacidad-foto').addEventListener('change', guardar);

    /* --- juego de fichas --- */
    const sel = $('#juego');
    sel.innerHTML = Object.entries(M.JUEGOS)
      .map(([k, v]) => `<option value="${k}">${esc(v.nombre)}</option>`).join('');
    sel.value = estado.juego;
    sel.addEventListener('change', () => {
      estado.juego = sel.value;
      pintarDigrafos();
      pintar();
    });

    /* --- turno y alias --- */
    $('#selector-turno').addEventListener('click', (ev) => {
      const btn = ev.target.closest('button[data-turno]');
      if (!btn) return;
      estado.turno = +btn.dataset.turno;
      pintar();
    });

    $('#marcador').addEventListener('input', (ev) => {
      const campo = ev.target.closest('input.alias');
      if (!campo) return;
      estado.jugadores[+campo.dataset.jugador].nombre = campo.value || `Jugador ${+campo.dataset.jugador + 1}`;
      $('#ley-j1').textContent = estado.jugadores[0].nombre;
      $('#ley-j2').textContent = estado.jugadores[1].nombre;
      $('#selector-turno').innerHTML = estado.jugadores.map((j, i) => `
        <button type="button" data-turno="${i}" aria-pressed="${estado.turno === i}">
          <i class="punto j${i}"></i>${esc(j.nombre)}
        </button>`).join('');
      guardar();
    });

    /* --- lista de jugadas --- */
    $('#lista-jugadas').addEventListener('click', (ev) => {
      const btn = ev.target.closest('button[data-accion]');
      const li = ev.target.closest('.jugada');
      if (!li) return;
      const id = +li.dataset.id;
      const i = estado.jugadas.findIndex((j) => j.id === id);
      if (i === -1) return;

      if (!btn) {
        pend.resaltado = pend.resaltado === id ? null : id;
        pintar();
        return;
      }

      const accion = btn.dataset.accion;
      if (accion === 'borrar') {
        estado.jugadas.splice(i, 1);
      } else if (accion === 'cambiar') {
        estado.jugadas[i].jugador = 1 - estado.jugadas[i].jugador;
      } else if (accion === 'subir' && i > 0) {
        [estado.jugadas[i - 1], estado.jugadas[i]] = [estado.jugadas[i], estado.jugadas[i - 1]];
      } else if (accion === 'bajar' && i < estado.jugadas.length - 1) {
        [estado.jugadas[i + 1], estado.jugadas[i]] = [estado.jugadas[i], estado.jugadas[i + 1]];
      }
      pintar();
    });

    /* --- formulario --- */
    $('#btn-anadir-palabra').addEventListener('click', anadirPalabraFormulario);
    ['#f-palabra', '#f-fila', '#f-col'].forEach((s) => {
      $(s).addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') { ev.preventDefault(); anadirPalabraFormulario(); }
      });
    });

    /* --- foto --- */
    const cont = $('#foto-contenedor');
    cont.addEventListener('click', (ev) => {
      if (ev.target.closest('#btn-quitar-foto')) {
        estado.foto = null;
        estado.esquinas = null;
        estado.fotoAlineada = null;
        $('#estado-alineado').textContent = '';
        pintarFoto();
        guardar();
        return;
      }
      if (ev.target.closest('#foto-img')) {
        $('#visor-img').src = estado.fotoAlineada || estado.foto;
        $('#visor').classList.add('abierto');
        return;
      }
      if (ev.target.closest('#zona-foto')) $('#input-foto').click();
    });

    ['dragenter', 'dragover'].forEach((e) => cont.addEventListener(e, (ev) => {
      ev.preventDefault();
      const z = $('#zona-foto');
      if (z) z.classList.add('encima');
    }));
    ['dragleave', 'drop'].forEach((e) => cont.addEventListener(e, (ev) => {
      ev.preventDefault();
      const z = $('#zona-foto');
      if (z) z.classList.remove('encima');
    }));
    cont.addEventListener('drop', (ev) => {
      if (ev.dataTransfer.files && ev.dataTransfer.files[0]) cargarFoto(ev.dataTransfer.files[0]);
    });

    $('#input-foto').addEventListener('change', (ev) => {
      if (ev.target.files[0]) cargarFoto(ev.target.files[0]);
      ev.target.value = '';
    });

    $('#visor').addEventListener('click', () => $('#visor').classList.remove('abierto'));

    /* --- IA --- */
    $('#btn-leer-ia').addEventListener('click', leerConIA);
    $('#btn-olvidar-clave').addEventListener('click', () => {
      try { localStorage.removeItem(CLAVE_API); } catch (e) { /* nada */ }
      $('#clave-api').value = '';
      avisar('Clave borrada de este navegador');
    });
  }

  /* botones de dígrafos (solo en español) */
  function pintarDigrafos() {
    let caja = $('#digrafos');
    if (!caja) {
      caja = document.createElement('span');
      caja.id = 'digrafos';
      caja.style.display = 'inline-flex';
      caja.style.gap = '4px';
      $('#btn-comodin').after(caja);
      caja.addEventListener('click', (ev) => {
        const b = ev.target.closest('button[data-dig]');
        if (b) ponerLetra(b.dataset.dig);
      });
    }
    const digrafos = juegoActual().digrafos;
    caja.innerHTML = digrafos.map((d) =>
      `<button type="button" class="btn" data-dig="${d}" title="Colocar la ficha ${d}">${d}</button>`).join('');
  }

  /* ------------------------------------------------------------ arranque */

  cargar();
  pintarDigrafos();
  conectarEventos();
  conectarTiradores();
  pintarFoto();
  try {
    const guardada = localStorage.getItem(CLAVE_API);
    if (guardada) $('#clave-api').value = guardada;
  } catch (e) { /* sin almacenamiento */ }
  pintar();
})();
