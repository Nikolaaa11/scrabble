/* =========================================================================
   Alineación de la foto con el tablero.

   Las fotos de un tablero nunca salen de frente: hay perspectiva. Aquí se
   calcula la homografía que lleva el cuadrado unidad a las cuatro esquinas
   que marca el usuario, y se «desenrolla» la foto a un cuadrado perfecto
   que encaja casilla por casilla con la cuadrícula de 15x15.
   ========================================================================= */

(function () {
  'use strict';

  /* Esquinas por defecto (fracciones 0..1 de la imagen): TL, TR, BR, BL */
  const ESQUINAS_POR_DEFECTO = [
    { x: 0.12, y: 0.12 },
    { x: 0.88, y: 0.12 },
    { x: 0.88, y: 0.88 },
    { x: 0.12, y: 0.88 },
  ];

  /* Transformación proyectiva del cuadrado unidad al cuadrilátero.
     Devuelve (u, v) -> [x, y] en el mismo espacio que las esquinas. */
  function transformacion(esq) {
    const [p0, p1, p2, p3] = esq;

    const dx1 = p1.x - p2.x, dx2 = p3.x - p2.x, dx3 = p0.x - p1.x + p2.x - p3.x;
    const dy1 = p1.y - p2.y, dy2 = p3.y - p2.y, dy3 = p0.y - p1.y + p2.y - p3.y;

    let a, b, c, d, e, f, g, h;

    if (Math.abs(dx3) < 1e-12 && Math.abs(dy3) < 1e-12) {
      /* el cuadrilátero es un paralelogramo: la transformación es afín */
      g = 0; h = 0;
      a = p1.x - p0.x; b = p2.x - p1.x; c = p0.x;
      d = p1.y - p0.y; e = p2.y - p1.y; f = p0.y;
    } else {
      const den = dx1 * dy2 - dy1 * dx2;
      if (Math.abs(den) < 1e-12) return null;   /* esquinas degeneradas */
      g = (dx3 * dy2 - dy3 * dx2) / den;
      h = (dx1 * dy3 - dy1 * dx3) / den;
      a = p1.x - p0.x + g * p1.x;
      b = p3.x - p0.x + h * p3.x;
      c = p0.x;
      d = p1.y - p0.y + g * p1.y;
      e = p3.y - p0.y + h * p3.y;
      f = p0.y;
    }

    return function (u, v) {
      const w = g * u + h * v + 1;
      return [(a * u + b * v + c) / w, (d * u + e * v + f) / w];
    };
  }

  /* ¿Las cuatro esquinas forman un cuadrilátero convexo y con área? */
  function esquinasValidas(esq) {
    if (!esq || esq.length !== 4) return false;
    let signo = 0;
    for (let i = 0; i < 4; i++) {
      const a = esq[i], b = esq[(i + 1) % 4], c = esq[(i + 2) % 4];
      const cruz = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
      if (Math.abs(cruz) < 1e-9) return false;
      const s = Math.sign(cruz);
      if (signo === 0) signo = s;
      else if (s !== signo) return false;
    }
    return true;
  }

  function cargarImagen(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('No se pudo cargar la imagen'));
      img.src = src;
    });
  }

  /* Endereza la foto a un cuadrado de `tam` píxeles usando muestreo bilineal */
  async function rectificar(dataUrl, esquinas, tam) {
    if (!esquinasValidas(esquinas)) {
      throw new Error('Las cuatro esquinas deben formar un cuadrilátero sin cruzarse');
    }

    const img = await cargarImagen(dataUrl);
    const ancho = img.naturalWidth;
    const alto = img.naturalHeight;

    const origen = document.createElement('canvas');
    origen.width = ancho;
    origen.height = alto;
    origen.getContext('2d', { willReadFrequently: true }).drawImage(img, 0, 0);
    const src = origen.getContext('2d').getImageData(0, 0, ancho, alto).data;

    /* esquinas en fracciones -> píxeles */
    const enPixeles = esquinas.map((p) => ({ x: p.x * ancho, y: p.y * alto }));
    const mapear = transformacion(enPixeles);
    if (!mapear) throw new Error('Las esquinas marcadas no son válidas');

    const destino = document.createElement('canvas');
    destino.width = tam;
    destino.height = tam;
    const salida = destino.getContext('2d').createImageData(tam, tam);
    const dst = salida.data;

    for (let py = 0; py < tam; py++) {
      const v = (py + 0.5) / tam;
      for (let px = 0; px < tam; px++) {
        const u = (px + 0.5) / tam;
        const [x, y] = mapear(u, v);
        const i = (py * tam + px) * 4;

        if (x < 0 || y < 0 || x > ancho - 1 || y > alto - 1) {
          dst[i] = dst[i + 1] = dst[i + 2] = 0;
          dst[i + 3] = 255;
          continue;
        }

        /* muestreo bilineal */
        const x0 = Math.floor(x), y0 = Math.floor(y);
        const x1 = Math.min(x0 + 1, ancho - 1), y1 = Math.min(y0 + 1, alto - 1);
        const fx = x - x0, fy = y - y0;
        const p00 = (y0 * ancho + x0) * 4, p10 = (y0 * ancho + x1) * 4;
        const p01 = (y1 * ancho + x0) * 4, p11 = (y1 * ancho + x1) * 4;
        const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy);
        const w01 = (1 - fx) * fy, w11 = fx * fy;

        for (let k = 0; k < 3; k++) {
          dst[i + k] = src[p00 + k] * w00 + src[p10 + k] * w10 +
                       src[p01 + k] * w01 + src[p11 + k] * w11;
        }
        dst[i + 3] = 255;
      }
    }

    destino.getContext('2d').putImageData(salida, 0, 0);
    return destino.toDataURL('image/jpeg', 0.88);
  }

  /* Puntos del retículo 16x16 en el espacio de la foto, para dibujar la
     previsualización de la cuadrícula encima de la imagen sin rectificar. */
  function lineasDeCuadricula(esquinas, divisiones) {
    const mapear = transformacion(esquinas);
    if (!mapear) return [];
    const lineas = [];
    for (let i = 0; i <= divisiones; i++) {
      const t = i / divisiones;
      const horizontal = [];
      const vertical = [];
      for (let j = 0; j <= divisiones; j++) {
        const s = j / divisiones;
        horizontal.push(mapear(s, t));
        vertical.push(mapear(t, s));
      }
      lineas.push(horizontal, vertical);
    }
    return lineas;
  }

  window.Alinear = {
    ESQUINAS_POR_DEFECTO,
    transformacion,
    esquinasValidas,
    rectificar,
    lineasDeCuadricula,
  };
})();
