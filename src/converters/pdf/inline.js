/* Renglones de texto con fórmulas en línea ($...$), incluidas las que ocupan dos alturas. */

import { renderBox, renderEquation } from './equations.js';
import { fixPunctuation, tidyTex } from './latex.js';
import { mathMask, peelRunPunctuation, renderMathWord, renderTextWord, stripBullet } from './words.js';

// Tramo de fórmula en línea con filas satélite (vectores, fracciones): se rearma en 2D.
export function renderInline2D(group, line) {
  const pieces = [...new Set(group.flatMap(w => w.pieces || []))].filter(p => p.text.trim()).sort((a, b) => a.x0 - b.x0);
  if (!pieces.length || !line || !line.satellites) return null;
  const fs = line.fontSize;
  let x0 = pieces[0].x0 - 1, x1 = Math.max(...pieces.map(p => p.x1)) + 1;
  // Los satélites contiguos amplían el tramo (p. ej. el vector y su ")" al final del renglón).
  const sats = [];
  let grew = true;
  while (grew) {
    grew = false;
    line.satellites.forEach(s => {
      if (s.used || sats.includes(s) || s.x1 < x0 - fs * 0.5 || s.x0 > x1 + fs * 0.5) return;
      sats.push(s);
      x0 = Math.min(x0, s.x0);
      x1 = Math.max(x1, s.x1);
      grew = true;
    });
  }
  if (!sats.length) return null;
  sats.forEach(s => { s.used = true; });
  // Puntuación final fuera de la fórmula.
  let after = '';
  while (pieces.length > 1 && /^[.,;:?!]+$/.test(pieces[pieces.length - 1].text.trim()) && !pieces[pieces.length - 1].big) {
    after = pieces.pop().text.trim() + after;
  }
  const tex = renderEquation([...pieces, ...sats], line.baseY, line.fontSize).replace(/\s*\\tag\{[^}]*\}/, '');
  return { tex, after };
}

// Línea de texto con fórmulas en línea ($...$).
export function renderPdfLine(lineWords, line) {
  const { words, list } = stripBullet(lineWords);
  if (!words.length) return null;

  const n = words.length;
  const { inMath } = mathMask(words);
  const segs = [];
  let i = 0;
  while (i < n) {
    const start = i;
    const isMath = inMath[i];
    while (i < n && inMath[i] === isMath) i++;
    const group = words.slice(start, i);
    if (!isMath) {
      // Tramos en negrita / cursiva -> **...** / *...*
      const styleOf = w => (w.bold ? 'b' : '') + (w.italic ? 'i' : '');
      for (let k = 0; k < group.length;) {
        const style = styleOf(group[k]);
        const run = [];
        while (k < group.length && styleOf(group[k]) === style) run.push(group[k++]);
        const s = fixPunctuation(run.map(renderTextWord).join(' ').replace(/\*/g, '\\*'));
        const mark = { b: '**', i: '*', bi: '***' }[style] || '';
        segs.push({ type: 'text', s: s && mark ? mark + s + mark : s });
      }
      continue;
    }
    const twoD = renderInline2D(group, line);
    if (twoD) {
      if (twoD.tex) segs.push({ type: 'math', s: twoD.tex });
      if (twoD.after) segs.push({ type: 'text', s: twoD.after });
      continue;
    }
    const { before, after, run } = peelRunPunctuation(group);
    if (before) segs.push({ type: 'text', s: before });
    const tex = run.length ? tidyTex(run.map(renderMathWord).join(' ')) : '';
    if (tex) segs.push({ type: 'math', s: tex });
    if (after) segs.push({ type: 'text', s: after });
  }
  // Satélites que no quedaron dentro de ninguna fórmula: no se pierden.
  (line && line.satellites || []).filter(s => !s.used).forEach(s => { s.used = true; segs.push({ type: 'math', s: renderBox([s]) }); });

  let md = '';
  for (const seg of segs) {
    const piece = seg.type === 'math' ? `$${seg.s}$` : fixPunctuation(seg.s).replace(/\$/g, '\\$');
    if (!piece) continue;
    if (md && !/^[,.;:!?)\]}»”]/.test(piece) && !/[¿¡(\[{«“]$/.test(md)) md += ' ';
    md += piece;
  }

  return (list ? '- ' : '') + md;
}
