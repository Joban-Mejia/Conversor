/* Delimitadores altos y matrices: pmatrix/bmatrix/vmatrix, array con barra, cases, \vdots/\ddots. */

import { overlaps, renderBox } from './equations.js';

export const DELIM_CHAR_RE = /^[()[\]{}|‖⟨⟩⌊⌋⌈⌉]$/;
export const DELIM_OPENERS = { '(': ')', '[': ']', '{': '}', '⟨': '⟩', '⌊': '⌋', '⌈': '⌉' };
export const DELIM_TEX = { '(': '(', ')': ')', '[': '[', ']': ']', '{': '\\{', '}': '\\}', '|': '|', '‖': '\\|',
  '⟨': '\\langle', '⟩': '\\rangle', '⌊': '\\lfloor', '⌋': '\\rfloor', '⌈': '\\lceil', '⌉': '\\rceil' };
export const MATRIX_ENVS = { '()': 'pmatrix', '[]': 'bmatrix', '{}': 'Bmatrix', '||': 'vmatrix', '‖‖': 'Vmatrix' };

// Los delimitadores altos llegan en piezas apiladas (arriba / extensión / abajo): se funden en uno.
export function mergeDelimiters(pieces) {
  const rest = [], groups = [];
  pieces.forEach(p => {
    if (!p.big || !DELIM_CHAR_RE.test(p.text.trim())) { rest.push(p); return; }
    const ch = p.text.trim();
    const g = groups.find(g => g.ch === ch && Math.abs(g.x0 - p.x0) < 1.5 &&
      p.y > g.yMin - p.fs * 2.5 && p.y < g.yMax + p.fs * 2.5);
    if (g) {
      g.yMin = Math.min(g.yMin, p.y);
      g.yMax = Math.max(g.yMax, p.y);
      g.x1 = Math.max(g.x1, p.x1);
    } else {
      groups.push({ ch, x0: p.x0, x1: p.x1, yMin: p.y, yMax: p.y, base: p });
    }
  });
  groups.forEach(g => rest.push({ ...g.base, text: g.ch, x1: g.x1, y: (g.yMin + g.yMax) / 2, delim: true }));
  return rest;
}

// Tres puntos sueltos apilados son \vdots; en diagonal, \ddots.
export function collapseDots(pieces) {
  const dots = pieces.filter(p => p.text.trim() === '.');
  const used = new Set(), extra = [];
  dots.forEach(d => {
    if (used.has(d)) return;
    const step = (a, dx) => dots.find(e => !used.has(e) && e !== a && e !== d &&
      a.y - e.y > 1.5 && a.y - e.y < a.fs * 0.8 && (dx ? e.x0 - a.x0 > 1.5 && e.x0 - a.x0 < a.fs * 1.5 : Math.abs(e.x0 - a.x0) < 1));
    for (const diagonal of [false, true]) {
      const d2 = step(d, diagonal), d3 = d2 && step(d2, diagonal);
      if (!d3) continue;
      [d, d2, d3].forEach(x => used.add(x));
      extra.push({ ...d2, text: diagonal ? '⋱' : '⋮', x0: d.x0, x1: d3.x1, math: true });
      break;
    }
  });
  return pieces.filter(p => !used.has(p)).concat(extra);
}

export function matrixRows(content, fs0) {
  const rows = [];
  content.filter(p => p.fs >= fs0 * 0.9 || /[⋮⋱]/.test(p.text)).sort((a, b) => b.y - a.y).forEach(p => {
    const row = rows.find(r => Math.abs(r.y - p.y) < fs0 * 0.45);
    if (!row) rows.push({ y: p.y, pieces: [] });
  });
  rows.sort((a, b) => b.y - a.y);
  content.forEach(p => {
    const row = rows.reduce((best, r) => (Math.abs(r.y - p.y) < Math.abs(best.y - p.y) ? r : best), rows[0]);
    if (row) row.pieces.push(p);
  });
  return rows.filter(r => r.pieces.length);
}

// Celdas de una fila: fragmentos separados por un hueco horizontal grande.
export function matrixCells(rowPieces, fs0) {
  const cells = [];
  [...rowPieces].sort((a, b) => a.x0 - b.x0).forEach(p => {
    const cell = cells[cells.length - 1];
    if (cell && p.x0 - cell.x1 < fs0 * 0.9) {
      cell.pieces.push(p);
      cell.x1 = Math.max(cell.x1, p.x1);
    } else {
      cells.push({ pieces: [p], x0: p.x0, x1: p.x1 });
    }
  });
  return cells;
}

// Matrices y vectores: contenido de varias filas entre un par de delimitadores altos.
export function extractMatrices(pieces, fs0) {
  const delims = pieces.filter(p => p.delim).sort((a, b) => a.x0 - b.x0);
  const pairs = [], stack = [];
  delims.forEach(d => {
    const ch = d.text;
    const top = stack[stack.length - 1];
    if (DELIM_OPENERS[ch]) stack.push({ open: d, bars: [] });
    else if ((ch === '|' || ch === '‖') && top && top.open.text !== ch && DELIM_OPENERS[top.open.text]) top.bars.push(d);
    else if ((ch === '|' || ch === '‖') && !(top && top.open.text === ch)) stack.push({ open: d, bars: [] });
    else if (top && (DELIM_OPENERS[top.open.text] === ch || top.open.text === ch)) pairs.push({ ...stack.pop(), close: d });
  });
  // Llave izquierda sin cierre (sistemas de ecuaciones): \begin{cases}.
  stack.filter(s => s.open.text === '{').forEach(s => pairs.push({ ...s, close: null }));

  const consumed = new Set(), atoms = [];
  pairs.forEach(({ open, close, bars }) => {
    if (consumed.has(open) || (close && consumed.has(close))) return;
    const xMax = close ? close.x0 + 1 : Infinity;
    const content = pieces.filter(p => !p.delim && !consumed.has(p) && p.text.trim() &&
      p.x0 >= open.x1 - 1 && p.x1 <= xMax);
    const rows = matrixRows(content, fs0);
    if (rows.length < 2) return;

    const rowCells = rows.map(r => matrixCells(r.pieces, fs0));
    const multiColumn = rowCells.some(c => c.length > 1);
    // Dos filas de una sola columna pueden ser una fracción: las filas de una matriz están más juntas.
    if (rows.length === 2 && !multiColumn && rows[0].y - rows[1].y >= fs0 * 1.28) return;

    // Columnas comunes a todas las filas, por solapamiento horizontal.
    const columns = [];
    rowCells.flat().sort((a, b) => a.x0 - b.x0).forEach(c => {
      const col = columns.find(k => overlaps(k, c, 1));
      if (col) { col.x0 = Math.min(col.x0, c.x0); col.x1 = Math.max(col.x1, c.x1); }
      else columns.push({ x0: c.x0, x1: c.x1 });
    });
    columns.sort((a, b) => a.x0 - b.x0);
    const body = rowCells.map(cells => {
      const slots = columns.map(() => []);
      cells.forEach(c => {
        const k = columns.findIndex(col => overlaps(col, c, 1));
        slots[k < 0 ? 0 : k].push(...c.pieces);
      });
      return slots.map(s => renderBox(s)).join(' & ');
    }).join(' \\\\ ');

    let tex;
    if (!close) {
      tex = `\\begin{cases} ${body} \\end{cases}`;
    } else if (bars.length) {
      const spec = columns.map((col, k) => 'c' + (k < columns.length - 1 &&
        bars.some(b => b.x0 >= col.x1 - 1 && b.x1 <= columns[k + 1].x0 + 1) ? '|' : '')).join('');
      tex = `\\left${DELIM_TEX[open.text]} \\begin{array}{${spec}} ${body} \\end{array} \\right${DELIM_TEX[close.text]}`;
    } else if (MATRIX_ENVS[open.text + close.text]) {
      tex = `\\begin{${MATRIX_ENVS[open.text + close.text]}} ${body} \\end{${MATRIX_ENVS[open.text + close.text]}}`;
    } else {
      tex = `\\left${DELIM_TEX[open.text]} \\begin{matrix} ${body} \\end{matrix} \\right${DELIM_TEX[close.text]}`;
    }

    [open, close, ...bars, ...content].forEach(p => p && consumed.add(p));
    const x1 = close ? close.x1 : Math.max(...content.map(p => p.x1));
    atoms.push({ x0: open.x0, x1, raw: '', tex, upper: '', lower: '', scripts: '' });
  });

  return { atoms, rest: pieces.filter(p => !consumed.has(p)) };
}
