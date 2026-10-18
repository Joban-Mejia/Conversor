/* Ecuaciones en bloque reconstruidas en 2D: fracciones, límites, exponentes, flechas con etiqueta. */

import { EQ_LABEL_RE, LIMIT_OP_RE, RELATION_RE, tidyTex } from './latex.js';
import { collapseDots, extractMatrices, mergeDelimiters } from './matrices.js';
import { piecesToWords, rawOf, renderMathWord } from './words.js';

// Convierte un conjunto de fragmentos en LaTeX, detectando superíndices/subíndices respecto a su línea base.
export function renderBox(pieces) {
  if (!pieces.length) return '';
  const ref = pieces.reduce((a, b) => (b.fs > a.fs ? b : a));
  const sorted = pieces
    .map(p => {
      const dy = p.y - ref.y;
      const small = p.fs < ref.fs * 0.92;
      const script = small && dy > ref.fs * 0.15 ? 'sup' : small && dy < -ref.fs * 0.1 ? 'sub' : 'base';
      return { ...p, script };
    })
    .sort((a, b) => a.x0 - b.x0);
  return tidyTex(piecesToWords(withGapSpaces(sorted)).map(renderMathWord).join(' '));
}

// Recalcula los espacios entre fragmentos ya ordenados de izquierda a derecha.
export function withGapSpaces(sorted) {
  return sorted.map((p, i) => ({
    ...p,
    // Los símbolos grandes (∑, ∫, √, paréntesis altos) siempre van como palabra aparte.
    spaceBefore: i > 0 && (p.x0 - sorted[i - 1].x1 > p.fs * 0.2 || /^\s/.test(p.text) ||
      (p.big && p.script === 'base') || (sorted[i - 1].big && p.script === 'base'))
  }));
}

// Agrupa fragmentos en cajas: misma altura, contiguos en horizontal y sin nada de la fila principal en medio.
export function groupBoxes(pieces, mainPieces) {
  const boxes = [];
  const blocked = (x0, x1) => mainPieces.some(m => m.text.trim() && m.x0 >= x0 - 0.5 && m.x1 <= x1 + 0.5);
  [...pieces].sort((a, b) => a.x0 - b.x0).forEach(p => {
    const box = boxes.find(b => Math.abs(b.y - p.y) < Math.max(b.fs, p.fs) * 0.5 &&
      p.x0 - b.x1 < Math.max(b.fs, p.fs) * 0.8 && !blocked(b.x1, p.x0));
    if (box) {
      box.pieces.push(p);
      box.x1 = Math.max(box.x1, p.x1);
      if (p.fs > box.fs) { box.fs = p.fs; box.y = p.y; }
    } else {
      boxes.push({ pieces: [p], x0: p.x0, x1: p.x1, y: p.y, fs: p.fs });
    }
  });
  return boxes.filter(b => b.pieces.some(p => p.text.trim()));
}

export const overlaps = (a, b, pad = 0) => a.x0 < b.x1 + pad && b.x0 < a.x1 + pad;

// Una ecuación: fila principal + cajas encima/debajo (fracciones, límites, exponentes, matrices).
export function renderEquation(pieces, Y0, fs0) {
  const matrices = extractMatrices(collapseDots(mergeDelimiters(pieces)), fs0);
  pieces = matrices.rest;

  // Flechas largas dibujadas con guiones ("-----→"): sus etiquetas van encima/debajo (\xrightarrow).
  const arrows = [];
  pieces.filter(p => Math.abs(p.y - Y0) <= fs0 * 0.25 && /^[-−→⟶\s]+$/.test(p.text) && p.text.trim())
    .sort((a, b) => a.x0 - b.x0)
    .forEach(p => {
      const run = arrows[arrows.length - 1];
      if (run && !run.done && p.x0 - run.x1 < fs0 * 0.3) { run.x1 = p.x1; run.pieces.push(p); }
      else arrows.push({ x0: p.x0, x1: p.x1, pieces: [p] });
      if (/[→⟶]/.test(p.text)) arrows[arrows.length - 1].done = true;
    });
  const longArrows = arrows.filter(a => a.done && a.x1 - a.x0 > fs0 * 1.5);
  const inArrow = p => longArrows.find(a => p.x0 >= a.x0 - 1 && p.x1 <= a.x1 + 1);

  const main = [], above = [], below = [];
  for (const p of pieces) {
    const dy = p.y - Y0;
    const small = p.fs < fs0 * 0.92;
    if (longArrows.some(a => a.pieces.includes(p))) continue;
    if (inArrow(p) && Math.abs(dy) > fs0 * 0.15) (dy > 0 ? above : below).push(p);
    else if (p.big) main.push({ ...p, script: 'base' });
    else if (small && dy > fs0 * 0.15 && dy <= fs0 * 0.6) main.push({ ...p, script: 'sup' });
    else if (small && dy < -fs0 * 0.1 && dy >= -fs0 * 0.5) main.push({ ...p, script: 'sub' });
    else if (Math.abs(dy) <= fs0 * 0.25) main.push({ ...p, script: 'base' });
    else (dy > 0 ? above : below).push(p);
  }

  const atoms = piecesToWords(withGapSpaces(main.sort((a, b) => a.x0 - b.x0)))
    .map(w => ({ x0: w.x0, x1: w.x1, raw: rawOf(w).trim(), tex: renderMathWord(w).trim(), upper: '', lower: '', scripts: '' }));
  const ups = groupBoxes(above, main), downs = groupBoxes(below, main);
  const used = new Set();
  let tag = null;

  longArrows.forEach(a => {
    const label = list => {
      const boxes = list.filter(b => !used.has(b) && overlaps(b, a)).sort((x, y) => y.y - x.y);
      boxes.forEach(b => used.add(b));
      const texs = boxes.map(b => renderBox(b.pieces)).filter(Boolean);
      return texs.length > 1 ? `\\substack{${texs.join(' \\\\ ')}}` : (texs[0] || '');
    };
    const up = label(ups), down = label(downs);
    const tex = up || down ? `\\xrightarrow${down ? `[${down}]` : ''}{${up}}` : '\\longrightarrow';
    atoms.push({ x0: a.x0, x1: a.x1, raw: '', tex, upper: '', lower: '', scripts: '' });
  });

  // Límites de ∑, ∫, lim...: cajas pequeñas encima/debajo (o a la derecha, en el caso de ∫).
  atoms.forEach(atom => {
    if (!LIMIT_OP_RE.test(atom.raw)) return;
    const reach = { x0: atom.x0 - fs0 * 0.3, x1: atom.x1 + fs0 * 0.8 };
    const pick = list => list.find(b => !used.has(b) && b.fs < fs0 * 0.92 && overlaps(b, reach));
    const up = pick(ups), down = pick(downs);
    if (up) { used.add(up); atom.upper = renderBox(up.pieces); }
    if (down) { used.add(down); atom.lower = renderBox(down.pieces); }
  });

  // Fracciones: una caja encima y otra debajo que se solapan horizontalmente.
  ups.forEach(up => {
    if (used.has(up)) return;
    const down = downs.find(d => !used.has(d) && overlaps(up, d));
    if (!down) return;
    used.add(up);
    used.add(down);
    atoms.push({
      x0: Math.min(up.x0, down.x0), x1: Math.max(up.x1, down.x1), raw: '',
      tex: `\\frac{${renderBox(up.pieces)}}{${renderBox(down.pieces)}}`, upper: '', lower: '', scripts: ''
    });
  });
  atoms.push(...matrices.atoms);
  atoms.sort((a, b) => a.x0 - b.x0);

  // Cajas sueltas: exponente o subíndice del elemento que tienen a la izquierda.
  [...ups, ...downs].forEach(box => {
    if (used.has(box)) return;
    const isUp = ups.includes(box);
    const raw = box.pieces.map(p => p.text).join('').replace(/\s/g, '');
    const tex = renderBox(box.pieces);
    // Número de ecuación o puntuación que quedó a otra altura (sistemas de varias filas): no es un índice.
    const label = raw.match(EQ_LABEL_RE);
    if (label) { tag = tag || label[1]; return; }
    const prev = [...atoms].reverse().find(a => a.x0 <= box.x0) || atoms[0];
    if (!prev || /^[.,;:]+$/.test(raw)) atoms.push({ x0: box.x0, x1: box.x1, raw: '', tex, upper: '', lower: '', scripts: '' });
    else prev.scripts += (isUp ? '^{' : '_{') + tex + '}';
  });
  atoms.sort((a, b) => a.x0 - b.x0);

  const last = atoms[atoms.length - 1];
  const label = last && last.raw.match(EQ_LABEL_RE);
  if (label && atoms.length > 1) { tag = tag || label[1]; atoms.pop(); }

  const parts = [];
  atoms.forEach((a, i) => {
    let tex = a.tex;
    if (a.lower) tex += `_{${a.lower}}`;
    if (a.upper) tex += `^{${a.upper}}`;
    tex += a.scripts;
    // Raíz grande (\sqrt sola) seguida de su contenido.
    if (i > 0 && parts[parts.length - 1] === '\\sqrt') { parts[parts.length - 1] = `\\sqrt{${tex}}`; return; }
    parts.push(tex);
  });

  let tex = tidyTex(parts.join(' '));
  if (tag) tex += ` \\tag{${tag}}`;
  return tex;
}

// Agrupa las líneas consecutivas de una ecuación en bloque y la rearma en 2D.
export function renderDisplayCluster(lines) {
  const pieces = lines.flatMap(l => l.pieces).filter(p => p.text.trim());
  // Tamaño de referencia: el de los caracteres normales (los delimitadores \left( \right) pueden ir escalados).
  const normal = pieces.filter(p => !p.big);
  const fsMax = Math.max(...(normal.length ? normal : pieces).map(p => p.fs));
  const full = pieces.filter(p => p.fs >= fsMax * 0.9 && !p.big);

  // Filas principales: las que tienen un signo de relación (=, ≤, ∈...) a tamaño completo.
  const rows = [];
  full.forEach(p => {
    const row = rows.find(r => Math.abs(r.y - p.y) < fsMax * 0.25);
    if (row) { row.width += p.x1 - p.x0; row.rel = row.rel || RELATION_RE.test(p.text); }
    else rows.push({ y: p.y, width: p.x1 - p.x0, rel: RELATION_RE.test(p.text) });
  });
  let mains = rows.filter(r => r.rel);
  if (!mains.length) mains = rows.length ? [rows.reduce((a, b) => (b.width > a.width ? b : a))] : [{ y: pieces[0].y }];
  mains.sort((a, b) => b.y - a.y);
  // Filas muy cercanas son la misma ecuación (p. ej. numerador con un "=").
  // (Las filas de un sistema alineado van a ~1.2 renglones; un numerador, a ~0.7.)
  mains = mains.filter((r, i) => i === 0 || mains[i - 1].y - r.y > fsMax * 1.0);

  const groups = mains.map(() => []);
  pieces.forEach(p => {
    // Los delimitadores/operadores altos (CMEX) tienen la base arriba y cuelgan hacia abajo.
    const py = p.big ? p.y - fsMax : p.y;
    let best = 0;
    mains.forEach((r, i) => { if (Math.abs(py - r.y) < Math.abs(py - mains[best].y)) best = i; });
    groups[best].push(p);
  });

  return mains.map((r, i) => renderEquation(groups[i], r.y, fsMax)).filter(Boolean);
}
