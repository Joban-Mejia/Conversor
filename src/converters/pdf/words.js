/* Palabras: agrupación de fragmentos, clasificación texto/fórmula y conversión de cada palabra. */

import { BULLET_RE, FORMULA_RE, LIMIT_OP_RE, MATH_CHAR_RE, OPERATOR_WORD_RE, SPACING_ACCENTS, SPANISH_SINGLE_RE, WEAK_RE, normalizePdfText, textToLatex } from './latex.js';

export function piecesToWords(pieces) {
  const words = [];
  let cur = null;
  let breakNext = true;

  const addPart = (part, p) => {
    cur.x0 = Math.min(cur.x0, p.x0);
    cur.x1 = Math.max(cur.x1, p.x1);
    cur.pieces.push(p);
    if (part.script === 'base') {
      cur.bold = cur.bold && !!p.bold;
      cur.italic = cur.italic && !!p.italic;
    }
    const last = cur.parts[cur.parts.length - 1];
    if (last && last.script === part.script) {
      last.text += part.text;
      last.math = last.math || part.math;
      last.x0 = Math.min(last.x0, p.x0);
      last.x1 = Math.max(last.x1, p.x1);
    } else {
      cur.parts.push({ ...part, x0: p.x0, x1: p.x1 });
    }
  };
  const newWord = p => { cur = { parts: [], pieces: [], x0: p.x0, x1: p.x1, bold: true, italic: true }; words.push(cur); };

  let carry = null; // acento suelto pendiente de unirse al fragmento siguiente (sin modificar los originales)
  pieces.forEach((orig, idx) => {
    const p = carry ? { ...orig, text: carry.text + orig.text, spaceBefore: carry.spaceBefore } : orig;
    carry = null;
    const next = pieces[idx + 1];
    const trimmed = p.text.trim();
    if (next && !p.math && trimmed.length === 1 && SPACING_ACCENTS[trimmed] && next.script === 'base') {
      carry = { text: trimmed, spaceBefore: p.spaceBefore };
      return;
    }

    if (p.script !== 'base' && cur) {
      // Tras un hueco real (p. ej. "= \frac{a}{b}" en un párrafo) el índice empieza una palabra nueva.
      if (p.spaceBefore && p.x0 >= cur.x1 && p.text.trim() && !LIMIT_OP_RE.test(rawOf(cur).trim())) newWord(p);
      addPart({ text: (p.spaceBefore ? ' ' : '') + p.text, script: p.script, math: p.math }, p);
      breakNext = /\s$/.test(p.text);
      return;
    }

    if (p.spaceBefore) breakNext = true;
    // Cada palabra guarda su propio sub-fragmento (posición estimada por proporción de caracteres),
    // para poder rearmar en 2D solo la parte matemática de un fragmento como "= 0, entonces...".
    const len = p.text.length || 1;
    let offset = 0;
    for (const chunk of p.text.split(/(\s+)/)) {
      const start = offset;
      offset += chunk.length;
      if (!chunk) continue;
      if (/^\s+$/.test(chunk)) { breakNext = true; continue; }
      const sub = chunk.length === p.text.length ? p : {
        ...p, text: chunk, spaceBefore: start > 0 || p.spaceBefore,
        x0: p.x0 + (p.x1 - p.x0) * start / len, x1: p.x0 + (p.x1 - p.x0) * offset / len
      };
      if (breakNext || !cur) {
        newWord(sub);
        breakNext = false;
      }
      addPart({ text: chunk, script: 'base', math: p.math }, sub);
    }
  });

  return words;
}

// Une palabras cortadas con guion al final de línea: "conver-" + "sión" -> "conversión".
export function joinHyphenatedLines(lines) {
  for (let i = 0; i < lines.length - 1; i++) {
    const cur = lines[i].words, next = lines[i + 1].words;
    if (!cur.length || !next.length) continue;
    const lastWord = cur[cur.length - 1];
    const lastPart = lastWord.parts[lastWord.parts.length - 1];
    const firstPart = next[0].parts[0];
    if (lastPart.script === 'base' && !lastPart.math && /[A-Za-zÀ-ÿ][-‐]$/.test(lastPart.text) &&
        firstPart.script === 'base' && !firstPart.math && /^[a-záéíóúñü]/.test(firstPart.text)) {
      lastPart.text = lastPart.text.slice(0, -1) + firstPart.text;
      lastWord.parts.push(...next[0].parts.slice(1));
      next.shift();
      // El resto del renglón es continuación de un párrafo, nunca una ecuación aparte.
      lines[i + 1].hyphenContinuation = true;
    }
  }
}

export const rawOf = word => word.parts.map(p => p.text).join('');

export function isFootnoteWord(word) {
  const scripts = word.parts.filter(p => p.script !== 'base');
  if (!scripts.length || word.parts.some(p => p.math)) return false;
  if (scripts.some(p => p.script !== 'sup' || !/^[\d*†‡,]+$/.test(p.text.trim()))) return false;
  const base = word.parts.filter(p => p.script === 'base').map(p => p.text).join('');
  return /^[A-Za-zÀ-ÿ]{3,}[.,;:)»”"]*$/.test(base) || /[.,;:)»”"]$/.test(base);
}

export function classifyWord(word, index) {
  if (isFootnoteWord(word)) return 'text';
  const raw = rawOf(word);
  // Marcador de enumeración al inicio del renglón: (i), (ii), (a)...
  if (index === 0 && /^\((?:[ivx]{1,4}|[a-h])\)$/.test(raw)) return 'text';
  // "Pérez¹": llamada de nota al pie con superíndice Unicode, no una potencia.
  if (/^[A-Za-zÀ-ÿ]{3,}[¹²³⁰⁴-⁹]+[.,;:]?$/.test(raw)) return 'text';
  if (word.parts.some(p => p.math || p.script !== 'base') || MATH_CHAR_RE.test(raw)) return 'strong';
  if (FORMULA_RE.test(raw) && /[=<>+^]/.test(raw)) return 'strong';
  if (SPANISH_SINGLE_RE.test(raw)) return 'single';
  if (WEAK_RE.test(raw)) return 'weak';
  return 'text';
}

// Marca qué palabras de la línea forman parte de una fórmula.
export function mathMask(words) {
  const cls = words.map(classifyWord);
  const inMath = cls.map(c => c === 'strong');
  const canJoin = (j, neighbor) =>
    cls[j] === 'weak' || (cls[j] === 'single' && OPERATOR_WORD_RE.test(rawOf(words[neighbor])));

  cls.forEach((c, i) => {
    if (c !== 'strong') return;
    for (let j = i - 1, nb = i; j >= 0 && !inMath[j] && canJoin(j, nb); nb = j, j--) inMath[j] = true;
    for (let j = i + 1, nb = i; j < words.length && !inMath[j] && canJoin(j, nb); nb = j, j++) inMath[j] = true;
  });
  return { cls, inMath };
}

export function renderMathWord(word) {
  const out = [];
  const parts = [];
  // Un "superíndice" y un "subíndice" uno encima del otro, al inicio de la palabra o tras un operador
  // ("-\frac{α}{β}"), son una fracción en línea; tras una letra (x_i^2) son índices de verdad.
  for (let k = 0; k < word.parts.length; k++) {
    const a = word.parts[k], b = word.parts[k + 1];
    const prev = parts[parts.length - 1];
    const afterOperator = !prev || (prev.script === 'base' && /[-−+=·×÷(,:]\s*$/.test(prev.text));
    if (b && a.script !== 'base' && b.script !== 'base' && a.script !== b.script && afterOperator &&
        a.x1 > b.x0 && b.x1 > a.x0) {
      const [num, den] = a.script === 'sub' ? [b, a] : [a, b];
      parts.push({ script: 'frac', tex: `\\frac{${textToLatex(num.text).trim()}}{${textToLatex(den.text).trim()}}` });
      k++;
    } else {
      parts.push(a);
    }
  }
  parts.forEach(p => {
    if (p.script === 'frac') { out.push({ script: 'base', tex: p.tex }); return; }
    if (p.script === 'sup' && /^[′″']+$/.test(p.text.trim())) {
      out.push({ script: 'base', tex: p.text.trim().replace(/″/g, "''").replace(/′/g, "'") });
      return;
    }
    const tex = p.script === 'base' ? textToLatex(p.text) : textToLatex(p.text).trim();
    const prev = out[out.length - 1];
    if (p.script === 'sup2' && prev && prev.script === 'sup') prev.tex += '^{' + tex + '}';
    else out.push({ script: p.script === 'sup2' ? 'sup' : p.script, tex });
  });
  return out.map(o => (o.script === 'base' ? o.tex : (o.script === 'sup' ? '^{' : '_{') + o.tex + '}')).join('');
}

export function renderTextWord(word) {
  return word.parts.map(p => (p.script === 'base'
    ? normalizePdfText(p.text)
    : `<sup>${normalizePdfText(p.text.trim())}</sup>`)).join('').replace(/[\uE000\uE001]/g, '');
}

// Saca de la fórmula la puntuación final y los paréntesis que no le pertenecen.
export function peelRunPunctuation(run) {
  run = run.map(w => ({ ...w, parts: w.parts.map(p => ({ ...p })) }));
  const rawRun = run.map(rawOf).join(' ');
  let open = (rawRun.match(/\(/g) || []).length - (rawRun.match(/\)/g) || []).length;
  let before = '', after = '';

  const first = run[0].parts[0];
  while (open > 0 && first.script === 'base' && first.text.startsWith('(')) {
    before += '(';
    first.text = first.text.slice(1);
    open--;
  }

  const lastWord = run[run.length - 1];
  const last = lastWord.parts[lastWord.parts.length - 1];
  if (last.script === 'base') {
    let m;
    while ((m = last.text.match(/[.,;:?!)]$/))) {
      if (m[0] === ')') {
        if (open >= 0) break;
        open++;
      }
      after = m[0] + after;
      last.text = last.text.slice(0, -1);
    }
  }

  run = run
    .map(w => ({ ...w, parts: w.parts.filter(p => p.text.trim() !== '') }))
    .filter(w => w.parts.length);
  return { before, after, run };
}

// Quita la viñeta inicial de una línea, si la tiene.
export function stripBullet(words) {
  if (!words.length) return { words, list: false };
  const firstPart = words[0].parts[0];
  if (firstPart.script !== 'base' || !BULLET_RE.test(firstPart.text)) return { words, list: false };
  words = words.slice();
  const rest = firstPart.text.replace(BULLET_RE, '');
  if (rest) words[0] = { ...words[0], parts: [{ ...firstPart, text: rest }, ...words[0].parts.slice(1)] };
  else if (words[0].parts.length > 1) words[0] = { ...words[0], parts: words[0].parts.slice(1) };
  else words.shift();
  return { words, list: true };
}

// Una línea es candidata a ecuación si todas sus palabras son matemáticas (o números/letras sueltas).
export function isMathCandidate(line) {
  if (!line.words.length || line.hyphenContinuation || stripBullet(line.words).list) return false;
  const { cls } = mathMask(line.words);
  // Los puntos sueltos (filas de ⋮ en matrices) no rompen la ecuación.
  return cls.every((c, i) => c !== 'text' || /^[.,;:…]+$/.test(rawOf(line.words[i])));
}

// Texto corrido (no una etiqueta): al menos 3 palabras normales de 3+ letras.
export function isProse(words) {
  const { cls } = mathMask(words);
  return words.filter((w, i) => cls[i] === 'text' && /[A-Za-zÀ-ÿ]{3,}/.test(rawOf(w))).length >= 3;
}
