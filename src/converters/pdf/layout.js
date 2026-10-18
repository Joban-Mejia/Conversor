/* Estructura de la página: encabezados/pies repetidos, párrafos, títulos y bloques. */

import { renderDisplayCluster } from './equations.js';
import { figureMarkdown } from './figures.js';
import { renderPdfLine } from './inline.js';
import { normalizePdfText } from './latex.js';
import { bodyFontSize, lineBox } from './lines.js';
import { DELIM_CHAR_RE } from './matrices.js';
import { isMathCandidate, mathMask, rawOf } from './words.js';

export function lineKey(line) {
  return normalizePdfText(line.words.map(rawOf).join('')).replace(/\d+/g, '#').replace(/\s+/g, '');
}

// Quita encabezados/pies que se repiten en varias páginas y los números de página sueltos.
// Candidatas: las 2 líneas más altas y las 3 más bajas de cada página.
export function removeRunningHeaders(pages) {
  const edgeLines = p => {
    const ls = p.lines.filter(l => l.words.length).sort((a, b) => b.baseY - a.baseY);
    return new Set([...ls.slice(0, 2), ...ls.slice(-3)]);
  };
  const counts = {};
  pages.forEach(p => {
    p.edges = edgeLines(p);
    new Set([...p.edges].map(lineKey)).forEach(k => { counts[k] = (counts[k] || 0) + 1; });
  });
  pages.forEach(p => {
    p.lines = p.lines.filter(l => {
      if (!p.edges.has(l)) return true;
      const key = lineKey(l);
      return !(counts[key] >= 3 || /^#?$/.test(key));
    });
  });
}

// Márgenes y separación típica entre renglones de la página.
export function pageLayout(lines, bodyFs) {
  const body = lines.filter(l => l.words.length && Math.abs(l.fontSize - bodyFs) < 0.6);
  const xs = body.map(l => Math.round(lineBox(l).x0));
  const freq = {};
  xs.forEach(x => { freq[x] = (freq[x] || 0) + 1; });
  const left = xs.length ? +Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0] : 72;
  const rights = body.map(l => lineBox(l).x1).sort((a, b) => a - b);
  const right = rights.length ? rights[Math.floor(rights.length * 0.9)] : 540;
  const gaps = [];
  for (let i = 1; i < body.length; i++) {
    const g = body[i - 1].baseY - body[i].baseY;
    if (g > bodyFs * 0.8 && g < bodyFs * 2.5) gaps.push(g);
  }
  gaps.sort((a, b) => a - b);
  const lineGap = gaps.length ? gaps[Math.floor(gaps.length / 2)] : bodyFs * 1.2;
  return { left, right, lineGap };
}

export const LIST_START_RE = /^(\((?:[ivxlc]+|[a-z]|\d+)\)|[a-z]\)|\d+\)|- )\s?/;
export const TOC_LINE_RE = /(\.\s?){4,}\s*\d+\s*$/;

export function headingLevel(line, md, bodyFs) {
  const text = md.replace(/\*+/g, '').trim();
  if (!text || text.length > 110 || /\$\$/.test(md) || TOC_LINE_RE.test(text)) return 0;
  const ratio = line.fontSize / bodyFs;
  const lettered = line.words.filter(w => /[A-Za-zÀ-ÿ]{2,}/.test(rawOf(w)));
  const allBold = lettered.length > 0 && lettered.every(w => w.bold);
  if (ratio >= 1.7) return 1;
  if (ratio >= 1.35) return 2;
  if (ratio >= 1.12) return 3;
  // Mismo tamaño, todo en negrita y corto: subtítulo (p. ej. los recuadros de sección).
  if (allBold && text.length < 80 && !/[.:!?]$/.test(text) && !/\s\d+$/.test(text) && !text.includes('$')) return 4;
  return 0;
}

// Convierte las líneas de una página en bloques: párrafos, títulos, ecuaciones y figuras.
export function renderPdfBlocks(lines, figures = []) {
  const blocks = [];
  const bodyFs = bodyFontSize(lines);
  lines = lines.filter(l => l.figuresBefore || (!l.absorbed && l.words.length));
  const layout = pageLayout(lines, bodyFs);
  let para = null;

  const flush = () => {
    if (!para) return;
    // Una fórmula partida entre dos renglones ("... + 3 \cdot$" | "$5 = 13$") vuelve a ser una sola.
    const joined = para.lines.reduce((acc, l) =>
      (acc && /[^\\$]\$$/.test(acc) && /^\$[^$]/.test(l) ? acc.slice(0, -1) + ' ' + l.slice(1) : (acc ? acc + ' ' + l : l)), '');
    const text = joined
      .replace(/\*\*\* \*\*\*/g, ' ').replace(/\*\* \*\*/g, ' ').replace(/(?<!\*)\* \*(?!\*)/g, ' ')
      .replace(/(\p{Ll})- (\p{Ll})/gu, '$1$2') // "concentrémo- nos" -> "concentrémonos"
      .replace(/\s{2,}/g, ' ').trim();
    if (text) blocks.push({ type: 'p', text });
    para = null;
  };
  const pushBlock = (type, text) => { flush(); blocks.push({ type, text }); };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    (line.figuresBefore || []).forEach(fig => { if (!fig.emitted) { fig.emitted = true; pushBlock('figure', figureMarkdown(fig)); } });
    if (line.figureLabel || line.captionOf || line.absorbed || !line.words.length) continue;

    // Ecuación en bloque: líneas consecutivas, cercanas y solo con matemáticas (al menos una claramente).
    if (isMathCandidate(line)) {
      // La línea se une si cae cerca del rango vertical de la ecuación; las piezas de paréntesis
      // altos (matrices) pueden quedar bastante más arriba o abajo que la fila principal.
      let j = i + 1, yMin = line.baseY, yMax = line.baseY;
      const onlyDelims = l => l.pieces.every(p => !p.text.trim() || (p.big && DELIM_CHAR_RE.test(p.text.trim())));
      while (j < lines.length && !lines[j].figureLabel && !lines[j].figuresBefore && isMathCandidate(lines[j])) {
        const y = lines[j].baseY, reach = bodyFs * (onlyDelims(lines[j]) ? 6 : 2.6);
        if (y < yMin - reach || y > yMax + reach) break;
        yMin = Math.min(yMin, y);
        yMax = Math.max(yMax, y);
        j++;
      }
      const cluster = lines.slice(i, j);
      if (cluster.some(l => mathMask(l.words).cls.includes('strong'))) {
        renderDisplayCluster(cluster).forEach(tex => pushBlock('math', `$$\n${tex}\n$$`));
        i = j - 1;
        continue;
      }
    }

    const md = renderPdfLine(line.words, line);
    if (!md) continue;

    const level = headingLevel(line, md, bodyFs);
    if (level) {
      const text = md.replace(/\*\*/g, '').trim();
      const last = blocks[blocks.length - 1];
      // Título que ocupa dos renglones.
      if (!para && last && last.type === 'h' && last.level === level && last.y - line.baseY < line.fontSize * 1.6) {
        last.text += ' ' + text;
        last.y = line.baseY;
      } else {
        flush();
        blocks.push({ type: 'h', level, text, y: line.baseY });
      }
      continue;
    }

    const box = lineBox(line);
    const prev = para && para.last;
    const next = lines[i + 1];
    let newPara = !para;
    if (para) {
      const gap = prev.baseY - line.baseY;
      const prevBox = lineBox(prev);
      // Margen derecho de la columna actual: junto a una figura al costado, el texto es más angosto.
      const columnRight = para.beforeLast ? Math.max(lineBox(para.beforeLast).x1, prevBox.x1) : Math.min(layout.right, box.x1);
      // Un renglón con un vector/fracción en línea es más alto: deja más espacio sin ser fin de párrafo.
      const tall = l => (l.satellites && l.satellites.length) || l.pieces.some(p => p.big);
      const maxGap = layout.lineGap * (tall(prev) || tall(line) ? 2.3 : 1.35);
      newPara =
        gap > maxGap || gap < 0 ||                                   // espacio extra o salto de columna
        LIST_START_RE.test(md) || TOC_LINE_RE.test(md) || TOC_LINE_RE.test(para.lines[para.lines.length - 1]) ||
        prevBox.x1 < columnRight - bodyFs * 3 ||                     // el renglón anterior terminó corto
        (box.x0 > layout.left + bodyFs * 0.8 && next && next.words.length && box.x0 > lineBox(next).x0 + bodyFs * 0.8); // sangría
    }
    if (newPara) {
      flush();
      para = { lines: [] };
    }
    para.lines.push(md);
    para.beforeLast = para.last;
    para.last = line;
  }
  flush();
  // Figuras cuya línea de referencia desapareció (pie de página, satélite...): al final de la página.
  figures.filter(f => !f.emitted).forEach(f => { f.emitted = true; blocks.push({ type: 'figure', text: figureMarkdown(f) }); });
  return blocks;
}

export function blocksToMarkdown(blocks) {
  return blocks.map(b => {
    if (b.type === 'h') return '#'.repeat(Math.min(6, b.level + 1)) + ' ' + b.text;
    return b.text;
  }).join('\n\n');
}
