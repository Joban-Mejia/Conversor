/* Reconstrucción de renglones a partir de los fragmentos de texto del PDF: líneas base,
   superíndices/subíndices, acentos matemáticos, flechas de \vv{}, renglones partidos y
   filas "satélite" de vectores en línea. */

import { MATH_FONT_RE, decodePdfChars } from './fonts.js';
import { BIG_SYMBOL_RE, MATH_ACCENTS, OA_CLOSE, OA_OPEN } from './latex.js';
import { isMathCandidate } from './words.js';

// Une cada acento suelto (~ de \vec, ˆ de \hat...) con la letra matemática que tiene debajo.
export function attachMathAccents(pieces) {
  // "~" de \vec dentro del mismo fragmento que su letra ("c~" + "v"): TeX dibuja el acento justo antes.
  let pendingVec = false;
  pieces.forEach(p => {
    if (!p.math) return;
    if (pendingVec && /^[A-Za-z0-9]/.test(p.text)) { p.text = p.text[0] + '\u20D7' + p.text.slice(1); pendingVec = false; }
    if (p.text.length > 1 && p.text.includes('~')) {
      p.text = p.text.replace(/~([A-Za-z0-9])/g, '$1\u20D7');
      if (/~$/.test(p.text)) { p.text = p.text.slice(0, -1); pendingVec = true; }
    }
  });

  return pieces.filter((acc, i) => {
    // Barra de negación: se une a la relación que sigue (≠, ∉...).
    // Solo se toma el primer carácter: el resto del fragmento puede ser texto normal ("= 0, entonces...").
    if (acc.text === '\u0338') {
      const next = pieces.slice(i + 1).find(p => p.text.trim());
      const rest = next ? next.text.trimStart() : '';
      if (!rest) return false;
      const rel = [...rest][0];
      acc.text = '\u0338' + rel;
      acc.math = true;
      next.text = rest.slice(rel.length);
      next.spaceBefore = /^\s/.test(next.text);
      return true;
    }
    const mark = MATH_ACCENTS[acc.text];
    if (!mark || acc.script !== 'base') return true;
    if (acc.text === '~' && !acc.math) return true;
    const center = (acc.x0 + acc.x1) / 2;
    // (El ~ de \vec va sobre letras o dígitos de cualquier fuente: \vec 0 usa el 0 de texto.)
    // (Vecinos visibles: pdf.js intercala espacios "falsos" entre el acento y su letra.)
    const nextVis = pieces.slice(i + 1).find(p => p.text.trim());
    const prevVis = pieces.slice(0, i).reverse().find(p => p.text.trim());
    const target = [nextVis, prevVis].find(t => t && (t.math || acc.text === '~') && t.text.trim() &&
      !MATH_ACCENTS[t.text] && center >= t.x0 - 0.5 && center <= t.x1 + 0.5) ||
      ((acc.text === '~' || acc.x1 - acc.x0 < 1) && nextVis && /^\s*[A-Za-z0-9]/.test(nextVis.text) ? nextVis : null);
    if (!target) return true;
    target.math = true;
    const chars = [...target.text];
    let idx = Math.min(chars.length - 1, Math.max(0, Math.floor((center - target.x0) / ((target.x1 - target.x0) / chars.length || 1))));
    // El acento va sobre una letra o dígito, nunca sobre la puntuación vecina ("0." -> sobre el 0).
    while (idx > 0 && !/[\p{L}\p{N}]/u.test(chars[idx])) idx--;
    chars.splice(idx + 1, 0, mark);
    target.text = chars.join('');
    if (target === nextVis) target.spaceBefore = acc.spaceBefore;
    return false;
  });
}

export function scriptFor(fs, dy, baseFs) {
  if (fs >= baseFs * 0.92) return 'base';
  if (dy > baseFs * 0.15) return 'sup';
  if (dy < -baseFs * 0.1) return 'sub';
  return 'base';
}

// Tamaño de letra del cuerpo del texto (el más usado en la página).
export function bodyFontSize(lines) {
  const weight = {};
  lines.forEach(l => l.pieces.forEach(p => {
    const k = Math.round(p.fs * 2) / 2;
    weight[k] = (weight[k] || 0) + p.text.length;
  }));
  const best = Object.entries(weight).sort((a, b) => b[1] - a[1])[0];
  return best ? parseFloat(best[0]) : 10;
}

export function buildPdfLines(items, fontNameOf) {
  const lines = [];
  let line = null;
  let prevEnd = 0;
  let prevStr = '';

  for (const item of items) {
    if (!item.str) continue;
    const t = item.transform;
    // Texto girado: marcas de agua ("DRAFT") y rótulos verticales.
    if (Math.abs(t[1]) > Math.abs(t[0]) * 0.1) continue;
    const fontName = fontNameOf(item.fontName);
    const decoded = decodePdfChars(item.str, fontName);
    if (!decoded) continue;
    // Varios delimitadores/operadores grandes en un mismo fragmento ("[(" ): uno por carácter.
    const chars = [...decoded.trim()];
    if (chars.length > 1 && MATH_FONT_RE.test(fontName) && chars.every(c => BIG_SYMBOL_RE.test(c))) {
      const w = (item.width || 0) / chars.length;
      items.splice(items.indexOf(item) + 1, 0, ...chars.slice(1).map((c, k) => ({
        ...item, str: c, width: w, transform: [t[0], t[1], t[2], t[3], t[4] + w * (k + 1), t[5]], _decoded: true
      })));
      item.str = chars[0];
      item.width = w;
      item._decoded = true;
    }
    const text = item._decoded ? item.str : decoded;
    const bold = /CMBX|CMB\d|Bold|Black|Heavy|Semibold|Demi/i.test(fontName);
    const italic = /CMTI|CMSL|CMBXTI|Italic|Oblique/i.test(fontName);
    const fs = Math.hypot(t[2], t[3]) || item.height || 10;
    const x = t[4], y = t[5];
    const w = item.width || 0;
    const math = MATH_FONT_RE.test(fontName);
    // ∑, ∫, paréntesis altos...: se dibujan desplazados del renglón pero pertenecen a él.
    const big = math && BIG_SYMBOL_RE.test(text.trim());
    let script = 'base';

    if (line) {
      const dy = y - line.baseY;
      const small = fs < line.fontSize * 0.92;
      // Vuelve muy a la izquierda a otra altura: es el renglón siguiente.
      const wrapped = Math.abs(dy) > fs * 0.15 && x < prevEnd - fs * 3;
      if (wrapped) {
        line = null;
      } else if (line.provisional) {
        // La línea empezó con un símbolo grande: su base real la fija el primer carácter de tamaño normal.
        if (!big && !small && text.trim() && Math.abs(dy) < fs * 1.5) {
          line.baseY = y;
          line.fontSize = fs;
          line.provisional = false;
          line.pieces.forEach(p => { if (!p.big) p.script = scriptFor(p.fs, p.y - y, fs); });
        } else if (Math.abs(dy) > line.fontSize * 1.5) {
          line = null;
        }
      } else if (big && dy > -fs * 0.5 && dy < fs * 1.6) {
        // ∑, ∫, paréntesis altos: se dibujan por encima de la base, pero pertenecen a esta línea
      } else if (small && dy > line.fontSize * 0.15 && dy <= line.fontSize * 1.0) {
        script = 'sup';
      } else if (small && dy < -line.fontSize * 0.1 && dy >= -line.fontSize * 0.75) {
        script = 'sub';
      } else if (Math.abs(dy) > line.fontSize * 0.4) {
        // Un carácter de tamaño normal desplazado más de 0.4 renglones no es ruido de la línea base:
        // es otro renglón o una fila de un vector/fracción en línea (que luego se une como satélite).
        line = null;
      }
      // Exponente de un exponente (e^{-x^2}): más pequeño y más alto que el superíndice anterior.
      const last = line && line.pieces[line.pieces.length - 1];
      if (script === 'sup' && last && /^sup/.test(last.script) && fs < last.fs * 0.92 && y > last.y + last.fs * 0.15) {
        script = 'sup2';
      }
    }

    if (!line) {
      const prev = lines[lines.length - 1];
      line = { baseY: y, fontSize: fs, provisional: big, pieces: [], paraBreak: false };
      if (prev) line.paraBreak = y > prev.baseY + prev.fontSize || prev.baseY - y > prev.fontSize * 1.8;
      lines.push(line);
      prevEnd = x;
      prevStr = '';
    }

    const gap = x - prevEnd;
    const spaceBefore = line.pieces.length > 0 &&
      (/\s$/.test(prevStr) || /^\s/.test(text) || gap > fs * 0.2 || gap < -fs * 2);
    // Flechas largas de \vv{PQ} (paquete esvect, fuente "TeX-vect"): su ToUnicode dice "# –".
    const arrow = /vect/i.test(fontName);
    line.pieces.push({ text, script, math, big, bold, italic, arrow, spaceBefore, x0: x, x1: x + w, y, fs });
    prevEnd = x + w;
    prevStr = text;
  }

  lines.forEach(l => { l.pieces = attachMathAccents(l.pieces); });
  return lines;
}

export const visible = l => l.pieces.filter(p => p.text.trim());

// Cada flecha de \vv{} se aplica a los caracteres que tiene justo debajo ("PQ" -> \overrightarrow{PQ}).
export function attachOverArrows(lines) {
  const all = lines.flatMap(l => l.pieces);
  lines.forEach(l => {
    l.pieces = l.pieces.filter(a => {
      if (!a.arrow) return true;
      const targets = all.filter(p => !p.arrow && p.text.trim() && p.y < a.y - a.fs * 0.15 && p.y > a.y - a.fs * 1.3 &&
        p.x1 > a.x0 + 1 && p.x0 < a.x1 - 1).sort((p, q) => p.x0 - q.x0);
      targets.forEach((p, k) => {
        const chars = [...p.text];
        const cw = (p.x1 - p.x0) / chars.length || 1;
        const i0 = Math.max(0, Math.floor((a.x0 - p.x0) / cw + 0.3));
        const i1 = Math.min(chars.length, Math.ceil((a.x1 - p.x0) / cw - 0.3));
        if (i1 <= i0) return;
        const inner = chars.slice(i0, i1).join('').replace(/\s+/g, '');
        p.text = chars.slice(0, i0).join('') + (k === 0 ? OA_OPEN : '') + inner +
          (k === targets.length - 1 ? OA_CLOSE : '') + chars.slice(i1).join('');
        p.math = true;
        if (k > 0) p.spaceBefore = false;
      });
      return !targets.length; // la flecha ya quedó representada (si no encontró letras, se queda)
    });
  });
  // Una flecha sin letras debajo no aporta texto ("# –").
  lines.forEach(l => { l.pieces = l.pieces.filter(p => !p.arrow); });
}

// Un renglón partido en trozos (p. ej. por un paréntesis alto en medio de un párrafo) se vuelve a unir.
export function reunifyLines(lines) {
  const out = [];
  lines.forEach(l => {
    const ps = visible(l);
    if (!ps.length || l.provisional) { out.push(l); return; }
    const x0 = Math.min(...ps.map(p => p.x0));
    const host = out.slice(-8).reverse().find(h => !h.provisional && visible(h).length &&
      Math.abs(h.baseY - l.baseY) < Math.min(h.fontSize, l.fontSize) * 0.15 &&
      x0 >= Math.max(...visible(h).map(p => p.x1)) - 2);
    if (!host) { out.push(l); return; }
    const gap = x0 - Math.max(...visible(host).map(p => p.x1));
    ps[0].spaceBefore = gap > ps[0].fs * 0.2;
    host.pieces.push(...l.pieces.filter(p => p.text.trim() || p !== l.pieces[0]));
  });
  return out;
}

// Filas sueltas de un vector/fracción dentro de un párrafo ("Sea v = (a b)ᵀ"): quedan medio renglón
// arriba/abajo del texto. Se agregan como "satélites" al renglón de texto que las rodea.
export function absorbSatellites(lines, bodyFs) {
  const hosts = lines.filter(l => l.words.length && !l.figureLabel && !isMathCandidate(l));
  lines.forEach(l => {
    if (!l.words.length || l.figureLabel || !isMathCandidate(l)) return;
    const b = lineBox(l);
    const candidates = hosts.filter(h => Math.abs(h.baseY - l.baseY) < bodyFs * 1.45 &&
      // (El vector puede ser lo último del renglón: sus filas sobresalen un poco a la derecha.)
      lineBox(h).x0 <= b.x0 + 1 && b.x0 <= lineBox(h).x1 + bodyFs * 2 &&
      h.pieces.some(p => p.math && p.text.trim() && p.x1 > b.x0 - bodyFs * 2 && p.x0 < b.x1 + bodyFs * 2));
    // Una fila de vector siempre tiene un delimitador alto cerca (el paréntesis del vector, antes de ella
    // o en la propia fila). Sin eso, es un renglón normal que quedó solo con símbolos ("−α/β.").
    const delimBefore = h => h.pieces.some(p => p.big && p.x1 <= b.x0 + 1 && p.x1 > b.x0 - bodyFs * 3);
    const ownDelim = visible(l).some(p => p.big);
    const valid = candidates.filter(h => ownDelim || delimBefore(h));
    if (!valid.length) return;
    // Preferencia: el renglón con el delimitador justo antes; luego el más cercano.
    const host = valid.sort((h1, h2) =>
      (delimBefore(h2) - delimBefore(h1)) || (Math.abs(h1.baseY - l.baseY) - Math.abs(h2.baseY - l.baseY)))[0];
    (host.satellites = host.satellites || []).push(...visible(l));
    l.absorbed = true;
  });
}

export function lineBox(line) {
  const ps = line.pieces.filter(p => p.text.trim());
  return { x0: Math.min(...ps.map(p => p.x0)), x1: Math.max(...ps.map(p => p.x1)) };
}
