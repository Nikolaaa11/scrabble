/* =========================================================================
   Función serverless (Vercel): lee el tablero de una foto con Claude.

   La clave de API vive en la variable de entorno ANTHROPIC_API_KEY del
   proyecto, así que nunca llega al navegador. Si la app se abre como archivo
   local esta ruta no existe y el cliente pide la clave al usuario.
   ========================================================================= */

const MODELO = process.env.MODELO_CLAUDE || 'claude-opus-5';

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

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Usa POST' });
  }

  const clave = process.env.ANTHROPIC_API_KEY;
  if (!clave) {
    return res.status(501).json({
      error: 'El servidor no tiene configurada ANTHROPIC_API_KEY. Añádela en Vercel → Settings → Environment Variables, o usa tu propia clave desde el navegador.',
      sinClave: true,
    });
  }

  const cuerpo = typeof req.body === 'string' ? safeParse(req.body) : req.body;
  const imagen = cuerpo && cuerpo.imagen;
  const alineada = !!(cuerpo && cuerpo.alineada);

  if (!imagen || typeof imagen !== 'string') {
    return res.status(400).json({ error: 'Falta la imagen en base64' });
  }
  if (imagen.length > 6_000_000) {
    return res.status(413).json({ error: 'La imagen es demasiado grande' });
  }

  try {
    const respuesta = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': clave,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODELO,
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imagen } },
            { type: 'text', text: alineada ? PROMPT_ALINEADA : PROMPT_CRUDA },
          ],
        }],
      }),
    });

    const texto = await respuesta.text();

    if (!respuesta.ok) {
      let detalle = texto;
      try { detalle = JSON.parse(texto).error.message; } catch (e) { /* texto plano */ }
      return res.status(respuesta.status).json({ error: `La API de Anthropic respondió ${respuesta.status}: ${detalle}` });
    }

    const datos = JSON.parse(texto);
    const salida = (datos.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('');

    return res.status(200).json({ texto: salida });
  } catch (e) {
    return res.status(502).json({ error: 'No se pudo contactar con la API de Anthropic: ' + e.message });
  }
};

function safeParse(s) {
  try { return JSON.parse(s); } catch (e) { return null; }
}
