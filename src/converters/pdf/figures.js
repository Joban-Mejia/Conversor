/* Figuras (dibujos TikZ/PGF e imágenes): detección por operaciones de dibujo, etiquetas,
   pie de figura y recorte como PNG. */

import { renderPdfLine } from './inline.js';
import { normalizePdfText } from './latex.js';
import { lineBox, visible } from './lines.js';
import { isProse, piecesToWords, rawOf } from './words.js';

// Cajas de todo lo que se dibuja en la página (trazos, rellenos, imágenes), en coordenadas de página.
export function drawingBoxes(opList) {
  const O = pdfjsLib.OPS;
  const boxes = [];
  const stack = [];
  let ctm = [1, 0, 0, 1, 0, 0];
  let pending = null;
  const mul = (m, c) => [
    m[0] * c[0] + m[1] * c[2], m[0] * c[1] + m[1] * c[3],
    m[2] * c[0] + m[3] * c[2], m[2] * c[1] + m[3] * c[3],
    m[4] * c[0] + m[5] * c[2] + c[4], m[4] * c[1] + m[5] * c[3] + c[5]
  ];
  const boxOf = (x0, y0, x1, y1) => {
    const pts = [[x0, y0], [x0, y1], [x1, y0], [x1, y1]].map(([x, y]) =>
      [x * ctm[0] + y * ctm[2] + ctm[4], x * ctm[1] + y * ctm[3] + ctm[5]]);
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys), n: 1 };
  };
  const PAINT = new Set([O.stroke, O.closeStroke, O.fill, O.eoFill, O.fillStroke, O.eoFillStroke,
    O.closeFillStroke, O.closeEOFillStroke, O.shadingFill]);

  opList.fnArray.forEach((fn, i) => {
    const args = opList.argsArray[i];
    if (fn === O.save) stack.push(ctm);
    else if (fn === O.restore) ctm = stack.pop() || ctm;
    else if (fn === O.transform) ctm = mul(args, ctm);
    else if (fn === O.paintFormXObjectBegin) { stack.push(ctm); if (args && args[0]) ctm = mul(args[0], ctm); }
    else if (fn === O.paintFormXObjectEnd) ctm = stack.pop() || ctm;
    else if (fn === O.constructPath) {
      const mm = args && args[2];
      if (mm && mm.length === 4 && isFinite(mm[0])) {
        pending = boxOf(mm[0], mm[2], mm[1], mm[3]);
        // Peso = número de segmentos: una rejilla TikZ es un solo trazado con decenas de líneas.
        pending.n = Math.max(1, Math.ceil(((args[0] && args[0].length) || 1) / 2));
      }
    } else if (PAINT.has(fn)) {
      if (pending) boxes.push(pending);
      pending = null;
    } else if (fn === O.endPath) {
      pending = null; // trazado de recorte, no se ve
    } else if (fn === O.paintImageXObject || fn === O.paintInlineImageXObject || fn === O.paintImageMaskXObject) {
      const b = boxOf(0, 0, 1, 1);
      b.n = 10; // una imagen cuenta como figura por sí sola
      boxes.push(b);
    }
  });
  return boxes;
}

// Regiones de la página que son figuras: muchos trazos juntos y poco texto dentro.
export function findFigures(opList, lines, bodyFs) {
  if (!opList || typeof pdfjsLib === 'undefined' || !pdfjsLib.OPS) return [];
  const pad = 3;
  // Las rayas finas de ancho completo (bajo el encabezado, sobre el pie) no son parte de ninguna figura.
  const boxes = drawingBoxes(opList).filter(b => !(b.y1 - b.y0 < 2 && b.x1 - b.x0 > bodyFs * 35));
  // Se agrupan los trazos que se tocan entre sí (caja con caja, no con el rectángulo del grupo:
  // así dos figuras vecinas no se funden por una esquina).
  const parent = boxes.map((b, i) => i);
  const find = i => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const touch = (a, b) => a.x0 <= b.x1 + pad && b.x0 <= a.x1 + pad && a.y0 <= b.y1 + pad && b.y0 <= a.y1 + pad;
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) if (touch(boxes[i], boxes[j])) parent[find(i)] = find(j);
  }
  const groups = {};
  boxes.forEach((b, i) => {
    const r = find(i);
    const c = groups[r];
    groups[r] = c ? { x0: Math.min(c.x0, b.x0), y0: Math.min(c.y0, b.y0), x1: Math.max(c.x1, b.x1), y1: Math.max(c.y1, b.y1), n: c.n + b.n } : { ...b };
  });
  const clusters = Object.values(groups);

  const pieces = lines.flatMap(l => l.pieces).filter(p => p.text.trim());
  const figures = clusters.filter(c => {
    const w = c.x1 - c.x0, h = c.y1 - c.y0;
    if (c.n < 6 || w < bodyFs * 4 || h < bodyFs * 3) return false;
    // Tablas y cajas de teoremas: mucho texto dentro. Las figuras solo tienen etiquetas sueltas.
    const textArea = pieces
      .filter(p => p.x0 >= c.x0 - 1 && p.x1 <= c.x1 + 1 && p.y >= c.y0 - 1 && p.y <= c.y1 + 1)
      .reduce((s, p) => s + (p.x1 - p.x0) * p.fs, 0);
    return textArea / (w * h) < 0.12;
  });

  // Subfiguras lado a lado (misma franja vertical): una sola imagen.
  const merged = [];
  figures.sort((a, b) => a.x0 - b.x0).forEach(f => {
    const g = merged.find(m => Math.min(m.y1, f.y1) - Math.max(m.y0, f.y0) > Math.min(m.y1 - m.y0, f.y1 - f.y0) * 0.5);
    if (g) Object.assign(g, { x0: Math.min(g.x0, f.x0), y0: Math.min(g.y0, f.y0), x1: Math.max(g.x1, f.x1), y1: Math.max(g.y1, f.y1), n: g.n + f.n });
    else merged.push({ ...f });
  });
  return merged.sort((a, b) => b.y1 - a.y1);
}

export const CAPTION_RE = /^(Figura|Figure|Fig\.|Gráfica|Imagen|Tabla)/i;

// Reparte las líneas a la altura de cada figura:
//  - lo que está dentro del dibujo (ejes, puntos, nombres de vectores) y las leyendas al lado son etiquetas;
//  - el texto corrido que rodea la figura (figuras al costado, "wrapfig") se queda en el cuerpo.
export function attachFigures(lines, figures, pageNumber, bodyFs) {
  const topLine = lines.filter(l => l.words.length).reduce((a, b) => (b.baseY > a.baseY ? b : a), { baseY: -Infinity });
  figures.forEach((fig, k) => {
    fig.name = `figuras/pagina-${String(pageNumber).padStart(3, '0')}-${k + 1}.png`;
    const draw = { x0: fig.x0, x1: fig.x1 };
    const insideDrawing = p => p.x0 >= draw.x0 - bodyFs && p.x1 <= draw.x1 + bodyFs;
    const grow = ps => ps.forEach(p => {
      fig.x0 = Math.min(fig.x0, p.x0); fig.x1 = Math.max(fig.x1, p.x1);
      fig.y0 = Math.min(fig.y0, p.y - p.fs * 0.3); fig.y1 = Math.max(fig.y1, p.y + p.fs);
    });
    fig.labelLines = [];

    // Columnas de texto corrido a la altura de la figura (si la figura va al costado del texto).
    const inBand = l => l.baseY >= fig.y0 - bodyFs * 0.6 && l.baseY <= fig.y1 + bodyFs * 0.3;
    // (Solo el interior de la franja: el renglón justo encima o debajo de la figura no es una columna al costado.)
    const proseColumns = lines
      .filter(l => !l.absorbed && !l.captionOf && l.words.length && l.baseY > fig.y0 + bodyFs && l.baseY < fig.y1 - bodyFs)
      .map(l => visible(l).filter(p => !insideDrawing(p)))
      .filter(ps => ps.length && isProse(piecesToWords(ps.map(p => ({ ...p })))))
      .map(ps => ({ x0: Math.min(...ps.map(p => p.x0)), x1: Math.max(...ps.map(p => p.x1)) }));

    lines.forEach(l => {
      if (l.figureLabel || l.absorbed || l.captionOf || !l.words.length) return;
      const ps = visible(l);
      const inPs = ps.filter(insideDrawing), outPs = ps.filter(p => !insideDrawing(p));
      // Rótulos justo encima del dibujo (p. ej. el nombre del eje y) también son de la figura.
      const nearTop = !outPs.length && l.baseY > fig.y1 && l.baseY <= fig.y1 + bodyFs * 1.4;
      if (!inBand(l) && !nearTop) return;
      // (Ni el encabezado de página ni el pie de figura, aunque toquen el borde del dibujo.)
      if ((l === topLine && l.baseY >= fig.y1 - 2) || CAPTION_RE.test(rawOf(l.words[0]).trim())) return;
      const prose = outPs.length > 0 && isProse(piecesToWords(outPs.map(p => ({ ...p }))));
      // Una fórmula suelta dentro de la columna de texto es del cuerpo; al lado del dibujo, es leyenda.
      const inColumn = outPs.some(p => proseColumns.some(c => p.x1 > c.x0 && p.x0 < c.x1));
      const allProse = !outPs.length && isProse(piecesToWords(inPs.map(p => ({ ...p }))));
      if ((!outPs.length && !allProse) || (outPs.length && !prose && !inColumn)) {
        l.figureLabel = fig;
        fig.labelLines.push(l);
        grow(ps);
      } else if (prose && inPs.length) {
        // Renglón de texto con etiquetas del dibujo a la misma altura: se separan.
        const label = { ...l, pieces: inPs, words: piecesToWords(inPs.map(p => ({ ...p }))) };
        fig.labelLines.push(label);
        grow(inPs);
        l.pieces = l.pieces.filter(p => !inPs.includes(p));
        l.words = piecesToWords(l.pieces);
      }
    });

    // Pie de figura: la línea que empieza con "Figura" y las que la continúan hasta el punto final.
    const start = lines.findIndex(l => !l.figureLabel && l.words.length && l.baseY < fig.y0 + bodyFs &&
      l.baseY > fig.y0 - bodyFs * 5 && CAPTION_RE.test(rawOf(l.words[0]).trim()));
    fig.captionLines = [];
    if (start >= 0) {
      let prev = lines[start];
      fig.captionLines.push(prev);
      for (let j = start + 1; j < lines.length && fig.captionLines.length < 5; j++) {
        const l = lines[j];
        if (!l.words.length || l.figureLabel) continue;
        const text = l.words.map(rawOf).join(' ');
        const prevText = prev.words.map(rawOf).join(' ').trim();
        if (/[.:]$/.test(prevText) || prev.baseY - l.baseY > bodyFs * 1.5 || l.baseY >= prev.baseY) break;
        if (isProse(l.words) && Math.abs(lineBox(l).x0 - lineBox(prev).x0) > bodyFs * 3 && !/^[a-záéíóú]/.test(text)) break;
        fig.captionLines.push(l);
        prev = l;
      }
      fig.captionLines.forEach(l => { l.captionOf = fig; });
    }
    fig.caption = fig.captionLines.map(l => normalizePdfText(l.words.map(rawOf).join(' '))).join(' ')
      .replace(/[\uE000\uE001]/g, '').replace(/\s+/g, ' ').trim();
    // La figura se inserta antes de la primera línea que está a su altura o por debajo.
    const anchor = lines.find(l => l.baseY <= fig.y1 + bodyFs * 0.3);
    if (anchor) (anchor.figuresBefore = anchor.figuresBefore || []).push(fig);
    else fig.orphan = true;
  });
}

// Recorta cada figura de la página renderizada (solo en el navegador).
export async function renderFigureImages(page, figures) {
  if (!figures.length || typeof document === 'undefined') return;
  const viewport = page.getViewport({ scale: 2.5 });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  for (const fig of figures) {
    const m = 3;
    const [ax, ay, bx, by] = viewport.convertToViewportRectangle([fig.x0 - m, fig.y0 - m, fig.x1 + m, fig.y1 + m]);
    const left = Math.max(0, Math.floor(Math.min(ax, bx))), top = Math.max(0, Math.floor(Math.min(ay, by)));
    const w = Math.min(canvas.width - left, Math.ceil(Math.abs(bx - ax))), h = Math.min(canvas.height - top, Math.ceil(Math.abs(by - ay)));
    if (w <= 0 || h <= 0) continue;
    const out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    out.getContext('2d').drawImage(canvas, left, top, w, h, 0, 0, w, h);
    fig.blob = await new Promise(resolve => out.toBlob(resolve, 'image/png'));
  }
}

// Imagen + pie de figura + el texto que aparece dentro del dibujo (visible, con sus fórmulas en LaTeX).
export function figureMarkdown(fig) {
  const alt = (fig.caption || 'Figura').replace(/[[\]]/g, '');
  const parts = [`![${alt}](${fig.name})`];
  if (fig.captionLines && fig.captionLines.length) {
    parts.push(fig.captionLines.map(l => renderPdfLine(l.words, l)).filter(Boolean).join(' '));
  }
  // Las marcas numéricas de los ejes (−1 1 2 3...) se omiten: no aportan y se ven en la imagen.
  const labels = (fig.labelLines || [])
    .sort((a, b) => b.baseY - a.baseY || lineBox(a).x0 - lineBox(b).x0)
    .map(l => renderPdfLine(l.words, l))
    .filter(md => md && !/^[\s\d.,−\-+()$]*$/.test(md));
  if (labels.length) parts.push(`> **Texto en la figura:** ${labels.join(' · ')}`);
  return parts.join('\n\n');
}
