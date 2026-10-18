/* Tablas de símbolos y conversión de texto del PDF a LaTeX (compatible con KaTeX). */

import { attachMathAccents } from './lines.js';

// Caracteres que no se supo convertir a LaTeX (y se quitaron de la fórmula): { carácter: veces }.
export const droppedChars = {};

// Acentos matemáticos que TeX dibuja como un carácter aparte encima de la letra.
export const MATH_ACCENTS = { '~': '\u20D7', 'ˆ': '\u0302', '^': '\u0302', '˜': '\u0303', '¯': '\u0304', '˙': '\u0307', '¨': '\u0308',
  // A veces pdf.js ya entrega el acento como carácter combinante suelto (fragmento de ancho cero).
  '\u20D7': '\u20D7', '\u0302': '\u0302', '\u0303': '\u0303', '\u0304': '\u0304', '\u0307': '\u0307', '\u0308': '\u0308'
};
export const ACCENT_COMMANDS = { '\u20D7': '\\vec', '\u0302': '\\hat', '\u0303': '\\tilde', '\u0304': '\\bar', '\u0307': '\\dot', '\u0308': '\\ddot' };

export const LIGATURES = { 'ﬀ': 'ff', 'ﬁ': 'fi', 'ﬂ': 'fl', 'ﬃ': 'ffi', 'ﬄ': 'ffl', 'ﬅ': 'st', 'ﬆ': 'st' };

// Acentos sueltos (típicos de PDFs de LaTeX: "informaci´on") -> carácter combinante.
export const SPACING_ACCENTS = { '´': '\u0301', '`': '\u0300', '¨': '\u0308', '˜': '\u0303', 'ˆ': '\u0302' };

export const UNICODE_SUPERSCRIPTS = {
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
  '⁺': '+', '⁻': '-', '⁼': '=', '⁽': '(', '⁾': ')', 'ⁿ': 'n', 'ⁱ': 'i'
};
export const UNICODE_SUBSCRIPTS = {
  '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9',
  '₊': '+', '₋': '-', '₌': '=', '₍': '(', '₎': ')',
  'ₐ': 'a', 'ₑ': 'e', 'ₒ': 'o', 'ₓ': 'x', 'ᵢ': 'i', 'ⱼ': 'j', 'ₙ': 'n', 'ₖ': 'k', 'ₘ': 'm', 'ₜ': 't'
};

export const LATEX_SYMBOLS = {
  // Letras griegas
  'α': '\\alpha', 'β': '\\beta', 'γ': '\\gamma', 'δ': '\\delta', 'ε': '\\varepsilon', 'ϵ': '\\epsilon',
  'ζ': '\\zeta', 'η': '\\eta', 'θ': '\\theta', 'ϑ': '\\vartheta', 'ι': '\\iota', 'κ': '\\kappa',
  'λ': '\\lambda', 'μ': '\\mu', 'ν': '\\nu', 'ξ': '\\xi', 'π': '\\pi', 'ϖ': '\\varpi', 'ρ': '\\rho',
  'ϱ': '\\varrho', 'σ': '\\sigma', 'ς': '\\varsigma', 'τ': '\\tau', 'υ': '\\upsilon', 'φ': '\\varphi',
  'ϕ': '\\phi', 'χ': '\\chi', 'ψ': '\\psi', 'ω': '\\omega', 'ο': 'o',
  'Γ': '\\Gamma', 'Δ': '\\Delta', 'Θ': '\\Theta', 'Λ': '\\Lambda', 'Ξ': '\\Xi', 'Π': '\\Pi',
  'Σ': '\\Sigma', 'Υ': '\\Upsilon', 'Φ': '\\Phi', 'Ψ': '\\Psi', 'Ω': '\\Omega',
  'Α': 'A', 'Β': 'B', 'Ε': 'E', 'Ζ': 'Z', 'Η': 'H', 'Ι': 'I', 'Κ': 'K', 'Μ': 'M', 'Ν': 'N', 'Ο': 'O',
  'Ρ': 'P', 'Τ': 'T', 'Χ': 'X',
  // Operadores y relaciones
  '±': '\\pm', '∓': '\\mp', '×': '\\times', '÷': '\\div', '·': '\\cdot', '∗': '\\ast', '∘': '\\circ', '−': '-',
  '⋄': '\\diamond', '⊖': '\\ominus', '⊘': '\\oslash', '⊙': '\\odot', '◯': '\\bigcirc', '◦': '\\circ',
  '•': '\\bullet', '⊔': '\\sqcup', '⊎': '\\uplus',
  '≤': '\\leq', '≥': '\\geq', '≠': '\\neq', '≈': '\\approx', '≡': '\\equiv', '∼': '\\sim', '≃': '\\simeq',
  '≅': '\\cong', '∝': '\\propto', '≪': '\\ll', '≫': '\\gg', '≍': '\\asymp', '≺': '\\prec', '≻': '\\succ',
  '⪯': '\\preceq', '⪰': '\\succeq',
  '∈': '\\in', '∉': '\\notin', '∋': '\\ni', '⊂': '\\subset', '⊃': '\\supset', '⊆': '\\subseteq',
  '⊇': '\\supseteq', '⊄': '\\not\\subset', '⊈': '\\nsubseteq', '≢': '\\not\\equiv', '≁': '\\nsim',
  '≉': '\\not\\approx', '≮': '\\nless', '≯': '\\ngtr', '≰': '\\nleq', '≱': '\\ngeq', '∪': '\\cup', '∩': '\\cap', '∅': '\\emptyset', '∖': '\\setminus',
  '∀': '\\forall', '∃': '\\exists', '∄': '\\nexists', '¬': '\\neg', '∧': '\\land', '∨': '\\lor',
  '⊕': '\\oplus', '⊗': '\\otimes', '∴': '\\therefore',
  '→': '\\to', '←': '\\leftarrow', '↔': '\\leftrightarrow', '⇒': '\\Rightarrow', '⇐': '\\Leftarrow',
  '⇔': '\\Leftrightarrow', '↦': '\\mapsto', '↑': '\\uparrow', '↓': '\\downarrow',
  '∑': '\\sum', '∏': '\\prod', '∐': '\\coprod', '∫': '\\int', '∬': '\\iint', '∭': '\\iiint', '∮': '\\oint',
  '⋃': '\\bigcup', '⋂': '\\bigcap', '⋀': '\\bigwedge', '⋁': '\\bigvee',
  '∂': '\\partial', '∇': '\\nabla', '∞': '\\infty', '√': '\\sqrt',
  'ℝ': '\\mathbb{R}', 'ℕ': '\\mathbb{N}', 'ℤ': '\\mathbb{Z}', 'ℚ': '\\mathbb{Q}', 'ℂ': '\\mathbb{C}',
  'ℍ': '\\mathbb{H}', 'ℙ': '\\mathbb{P}',
  'ℬ': '\\mathcal{B}', 'ℰ': '\\mathcal{E}', 'ℱ': '\\mathcal{F}', 'ℋ': '\\mathcal{H}', 'ℐ': '\\mathcal{I}',
  'ℒ': '\\mathcal{L}', 'ℳ': '\\mathcal{M}', 'ℛ': '\\mathcal{R}',
  '⟨': '\\langle', '⟩': '\\rangle', '⌊': '\\lfloor', '⌋': '\\rfloor', '⌈': '\\lceil', '⌉': '\\rceil',
  '‖': '\\|', '′': "'", '″': "''", 'ℓ': '\\ell', 'ℏ': '\\hbar', '∠': '\\angle', '⊥': '\\perp',
  '∥': '\\parallel', '⋯': '\\cdots', '⋮': '\\vdots', '⋱': '\\ddots', '…': '\\ldots',
  '°': '^{\\circ}', '–': '-', '—': '-',
  '½': '\\frac{1}{2}', '⅓': '\\frac{1}{3}', '⅔': '\\frac{2}{3}', '¼': '\\frac{1}{4}', '¾': '\\frac{3}{4}'
};

export const escapeForCharClass = chars => chars.replace(/[\]\\^-]/g, '\\$&');
export const LATEX_SYMBOL_RE = new RegExp('[' + escapeForCharClass(Object.keys(LATEX_SYMBOLS).join('')) + ']', 'g');
export const SUP_RUN_RE = new RegExp('[' + Object.keys(UNICODE_SUPERSCRIPTS).join('') + ']+', 'g');
export const SUB_RUN_RE = new RegExp('[' + Object.keys(UNICODE_SUBSCRIPTS).join('') + ']+', 'g');
// Caracteres que por sí solos delatan una fórmula (excluye los que también aparecen en texto normal).
export const MATH_CHAR_RE = new RegExp(
  '[' + escapeForCharClass(Object.keys(LATEX_SYMBOLS).filter(c => !'·′″‖◦•…°–—½⅓⅔¼¾ΑΒΕΖΗΙΚΜΝΟΡΤΧο'.includes(c)).join('') +
    Object.keys(UNICODE_SUPERSCRIPTS).join('') + Object.keys(UNICODE_SUBSCRIPTS).join('')) +
  ']|[\\u{1D400}-\\u{1D7FF}]', 'u'
);
export const MATH_ALNUM_RE = /[\u{1D400}-\u{1D7FF}]/gu;

export const MATH_FUNCTIONS = 'arcsin|arccos|arctan|sinh|cosh|tanh|sin|cos|tan|cot|sec|csc|log|ln|exp|lim|max|min|sup|inf|det|gcd';
// Sin \b final: en el PDF "sin x" suele llegar pegado como "sinx".
export const LATEX_FUNC_RE = new RegExp('(?<![\\\\A-Za-z])(' + MATH_FUNCTIONS + ')', 'g');
// Versiones en español (babel): lím, máx, mín.
export const SPANISH_FUNCS = { 'lím': 'lim', 'máx': 'max', 'mín': 'min' };
export const SPANISH_FUNC_RE = /(^|[^A-Za-zÀ-ÿ])(lím|máx|mín)(?![A-Za-zÀ-ÿ])/g;
export const OPERATOR_WORD_RE = /^[=<>+\-−*/×÷·±∓≤≥≠≈≡∼≃≅∝∈∉⊂⊃⊆⊇∪∩→←↔⇒⇐⇔↦]+$/;
export const RELATION_RE = /[=<>≤≥≠≈≡∼≃≅∝∈∉⊂⊃⊆⊇→⇒⇔↦]/;
export const FORMULA_RE = /^[A-Za-z0-9().,+\-*/=<>^|!'[\]]+$/;
// Palabras "débiles": solo cuentan como fórmula si están junto a algo claramente matemático.
export const WEAK_RE = new RegExp(
  '^[(\\[]*(-?\\d+([.,]\\d+)*|[A-Za-z]|[A-Za-z]{1,3}\\([^()]*\\)|[A-Za-z0-9]{1,2}([-/][A-Za-z0-9]{1,2})+|' +
  MATH_FUNCTIONS + '|lím|máx|mín)[)\\],.;:]*$|^[-/()[\\]|]+$'
);
// Letras sueltas que en español son palabras (a, e, o, u, y).
export const SPANISH_SINGLE_RE = /^[aeouyAEOUY][,.;:]?$/;
export const EQ_LABEL_RE = /^\((\d+(?:\.\d+)*[a-z]?)\)$/;
export const BIG_SYMBOL_RE = /^[∑∏∐∫∬∭∮⋃⋂⋀⋁√()[\]{}|‖⟨⟩⌊⌋⌈⌉]$/;
// Operadores que llevan límites encima/debajo o a la derecha.
export const LIMIT_OP_RE = /^([∑∏∐∫∬∭∮⋃⋂⋀⋁]|lim|lím|max|máx|min|mín|sup|inf)$/;
export const BULLET_RE = /^[•◦▪▫●○■□‣⁃∙➢❖❑✓]\s*/;

export function normalizePdfText(s, { keepMathAlphabets = false } = {}) {
  return s
    .replace(/\u00AD/g, '')
    .replace(/[ﬀ-ﬆ]/g, c => LIGATURES[c] || c)
    .replace(MATH_ALNUM_RE, c => {
      // \mathbb (U+1D538...) y \mathcal (U+1D49C...) se conservan para textToLatex.
      const cp = c.codePointAt(0);
      if (keepMathAlphabets && ((cp >= 0x1D49C && cp <= 0x1D4CF) || (cp >= 0x1D538 && cp <= 0x1D56B))) return c;
      return c.normalize('NFKC');
    })
    .replace(/([´`¨˜ˆ])\s?([a-zA-Zı])/g, (m, accent, letter) => {
      const composed = ((letter === 'ı' ? 'i' : letter) + SPACING_ACCENTS[accent]).normalize('NFC');
      return composed.length === 1 ? composed : m;
    });
}

export function fixPunctuation(s) {
  return s
    .replace(/\s+([,.;:!?)\]}»”’])/g, '$1')
    .replace(/([¿¡(\[{«“‘])\s+/g, '$1')
    .replace(/([a-záéíóúñü]{2,}[,;])(?=[A-Za-zÁÉÍÓÚÑáéíóúñ])/g, '$1 ')
    .replace(/([a-záéíóúñü][.:?!])(?=[A-ZÁÉÍÓÚÑ¿¡][a-záéíóúñü])/g, '$1 ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// Marcadores (área privada) que rodean lo que va bajo una flecha larga; textToLatex los vuelve \overrightarrow{}.
export const OA_OPEN = '\uE000', OA_CLOSE = '\uE001';

export const NEGATED = { '=': '≠', '∈': '∉', '≡': '≢', '⊂': '⊄', '⊆': '⊈', '∼': '≁', '≈': '≉', '<': '≮', '>': '≯', '≤': '≰', '≥': '≱', '∃': '∄' };

export function textToLatex(raw) {
  return normalizePdfText(raw, { keepMathAlphabets: true })
    .replace(/\u0338\s*(.)/gu, (m, rel) => NEGATED[rel] || '\\not ' + rel)
    .replace(/\u0338/g, '')
    .replace(/[\\{}%#&$_]/g, c => (c === '\\' ? '\\backslash ' : '\\' + c))
    .replace(/\^(?![A-Za-z0-9({])/g, '\\wedge ')
    .replace(SPANISH_FUNC_RE, (m, pre, fn) => pre + '\\' + SPANISH_FUNCS[fn] + ' ')
    .replace(LATEX_FUNC_RE, '\\$1 ')
    .replace(/\.\s?\.\s?\./g, '\\ldots ')
    .replace(SUP_RUN_RE, m => '^{' + [...m].map(c => UNICODE_SUPERSCRIPTS[c]).join('') + '}')
    .replace(SUB_RUN_RE, m => '_{' + [...m].map(c => UNICODE_SUBSCRIPTS[c]).join('') + '}')
    .replace(/[\u{1D538}-\u{1D56B}]/gu, c => '\\mathbb{' + String.fromCharCode(65 + ((c.codePointAt(0) - 0x1D538) % 26)) + '}')
    .replace(/[\u{1D49C}-\u{1D4CF}]/gu, c => '\\mathcal{' + String.fromCharCode(65 + ((c.codePointAt(0) - 0x1D49C) % 26)) + '}')
    .replace(LATEX_SYMBOL_RE, c => {
      const cmd = LATEX_SYMBOLS[c];
      return /[a-zA-Z]$/.test(cmd) ? cmd + ' ' : cmd;
    })
    // Letra + acento combinante (de attachMathAccents) -> \vec{v}, \hat{x}...
    .replace(/(\\[a-zA-Z]+(?:\{[A-Za-z]\})? ?|[A-Za-z0-9])([\u20D7\u0302\u0303\u0304\u0307\u0308])/g,
      (m, base, acc) => `${ACCENT_COMMANDS[acc]}{${base.trim()}}`)
    .replace(/\uE000\s*([^\uE000\uE001]*?)\s*\uE001/g, (m, inner) => `\\overrightarrow{${inner.trim()}}`)
    .replace(/[\uE000\uE001]/g, '')
    // Lo que quede fuera de ASCII: letras (é, ñ...) como \text{}, el resto se descarta para que KaTeX no falle.
    .replace(/[^\x20-\x7E]/gu, c => {
      if (/\p{L}/u.test(c) || '¿¡“”«»'.includes(c)) return `\\text{${c}}`;
      droppedChars[c] = (droppedChars[c] || 0) + 1; // se informa al final (consola) para poder ampliar las tablas
      return '';
    })
    .replace(/\s{2,}/g, ' ');
}

// "\sqrt x" -> "\sqrt{x}"; si no se sabe qué abarca la raíz, se deja el símbolo \surd.
export function fixSqrt(tex) {
  return tex
    .replace(/\\sqrt\s*(\\frac\{[^{}]*\}\{[^{}]*\}|\([^()]*\)|\\[a-zA-Z]+(?:\{[^{}]*\})?|[A-Za-z0-9.]+)(\^\{[^{}]*\})?/g,
      (m, arg, sup) => '\\sqrt{' + (arg.startsWith('(') ? arg.slice(1, -1) : arg) + (sup || '') + '}')
    .replace(/\\sqrt(?![{a-zA-Z])\s*/g, '\\surd ');
}

// Red de seguridad: "x^{a}^{b}" o "x_{a}_{b}" (KaTeX: "Double superscript") -> "x^{a}{}^{b}".
export function fixDoubleScripts(tex) {
  let out = '';
  const states = [{ sup: false, sub: false }];
  const argFlags = [];
  let pendingArg = false;
  const top = () => states[states.length - 1];
  const reset = () => { top().sup = false; top().sub = false; };

  for (let i = 0; i < tex.length; i++) {
    const c = tex[i];
    if (c === '\\') {
      const m = tex.slice(i).match(/^\\([a-zA-Z]+|.)/);
      out += m[0];
      i += m[0].length - 1;
      if (pendingArg) pendingArg = false;
      else if (/^\\(left|right|big|Big|bigg|Bigg)/.test(m[0])) { /* no cambia el átomo */ }
      else reset();
      continue;
    }
    if (c === '^' || c === '_' || c === "'") {
      const key = c === '_' ? 'sub' : 'sup';
      if (top()[key]) { out += '{}'; reset(); }
      top()[key] = true;
      out += c;
      if (c !== "'") pendingArg = true;
      continue;
    }
    if (c === '{') {
      argFlags.push(pendingArg);
      pendingArg = false;
      states.push({ sup: false, sub: false });
      out += c;
      continue;
    }
    if (c === '}') {
      if (states.length > 1) states.pop();
      out += c;
      if (!argFlags.pop()) reset();
      continue;
    }
    out += c;
    if (/\s/.test(c)) continue;
    if (pendingArg) pendingArg = false;
    else reset();
  }
  return out;
}

export const tidyTex = tex => fixDoubleScripts(fixSqrt(tex)
  .replace(/\.\s?\.\s?\./g, '\\ldots ')
  .replace(/\\cdot\s*\\cdot\s*\\cdot/g, '\\cdots ')
  .replace(/\s{2,}/g, ' ').trim());
