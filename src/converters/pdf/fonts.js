/* Fuentes del PDF: nombres reales y decodificación de caracteres sin tabla Unicode
   (TeX: CMEX, CMSY, CMMI, MSBM; Word: Symbol, Wingdings; piezas de delimitadores altos). */

// Fuentes matemáticas habituales: TeX (CMMI, CMSY, CMEX, AMS), Latin Modern / Cambria / STIX Math, Symbol.
export const MATH_FONT_RE = /CMMI|CMSY|CMEX|CMBSY|MSAM|MSBM|EUFM|EUSM|RSFS|Math|Symbol|MT ?Extra/i;

/* --- Decodificación de fuentes sin tabla Unicode ---
   Las fuentes de TeX (sobre todo CMEX) y las Symbol/Wingdings de Word suelen
   llegar como caracteres de control o del área privada (U+F0xx), que KaTeX
   rechaza ("Unexpected character"). Se traducen según la fuente. */

// CMEX: delimitadores grandes, operadores grandes y radicales, por código de carácter.
export const CMEX_CHARS = (() => {
  const map = {};
  const set = (start, chars) => [...chars].forEach((c, i) => { map[start + i] = c; });
  set(0x00, '()[]⌊⌋⌈⌉{}⟨⟩|‖/\\');
  set(0x10, '()()[]⌊⌋⌈⌉{}⟨⟩/\\');
  set(0x20, '()[]⌊⌋⌈⌉{}⟨⟩/\\/\\');
  set(0x30, '()⌈⌉⌊⌋||{}{}{}||');
  set(0x40, '()()⟨⟩⊔⊔∮∮⊙⊙⊕⊕⊗⊗');
  set(0x50, '∑∏∫⋃⋂⊎⋀⋁∑∏∫⋃⋂⊎⋀⋁');
  set(0x60, '∐∐^^^~~~[]⌊⌋⌈⌉{}');
  set(0x70, '√√√√√|||↑↓↑↓{}{}');
  return map;
})();
// CMSY 0x00-0x1F (si pdf.js no logra mapearlos por nombre de glifo).
export const CMSY_LOW = '−·×∗÷⋄±∓⊕⊖⊗⊘⊙◯◦•≍≡⊆⊇≤≥⪯⪰∼≈⊂⊃≪≫≺≻';
// CMMI 0x00-0x1F: letras griegas.
export const CMMI_LOW = 'ΓΔΘΛΞΠΣΥΦΨΩαβγδϵζηθικλμνξπρστυϕχ';
// CMR 0x00-0x1F: griegas mayúsculas, ligaduras y acentos.
export const CMR_LOW = ['Γ', 'Δ', 'Θ', 'Λ', 'Ξ', 'Π', 'Σ', 'Υ', 'Φ', 'Ψ', 'Ω', 'ff', 'fi', 'fl', 'ffi', 'ffl',
  'ı', 'ȷ', '`', '´', 'ˇ', '˘', '¯', '˚', '¸', 'ß', 'æ', 'œ', 'ø', 'Æ', 'Œ', 'Ø'];

// Codificación de la fuente Symbol (Word la entrega como U+F000 + código).
export const SYMBOL_CHARS = {
  0x22: '∀', 0x24: '∃', 0x27: '∋', 0x2A: '∗', 0x2D: '−', 0x40: '≅', 0x5C: '∴', 0x5E: '⊥', 0x7E: '∼',
  0xA2: '′', 0xA3: '≤', 0xA5: '∞', 0xAB: '↔', 0xAC: '←', 0xAD: '↑', 0xAE: '→', 0xAF: '↓',
  0xB0: '°', 0xB1: '±', 0xB2: '″', 0xB3: '≥', 0xB4: '×', 0xB5: '∝', 0xB6: '∂', 0xB7: '•', 0xB8: '÷',
  0xB9: '≠', 0xBA: '≡', 0xBB: '≈', 0xBC: '…', 0xC4: '⊗', 0xC5: '⊕', 0xC6: '∅', 0xC7: '∩', 0xC8: '∪',
  0xC9: '⊃', 0xCA: '⊇', 0xCB: '⊄', 0xCC: '⊂', 0xCD: '⊆', 0xCE: '∈', 0xCF: '∉', 0xD0: '∠', 0xD1: '∇',
  0xD5: '∏', 0xD6: '√', 0xD7: '·', 0xD8: '¬', 0xD9: '∧', 0xDA: '∨', 0xDB: '⇔', 0xDC: '⇐', 0xDE: '⇒',
  0xE1: '⟨', 0xE5: '∑', 0xF1: '⟩', 0xF2: '∫'
};
export const SYMBOL_GREEK_UPPER = 'ΑΒΧΔΕΦΓΗΙϑΚΛΜΝΟΠΘΡΣΤΥςΩΞΨΖ'; // A..Z
export const SYMBOL_GREEK_LOWER = 'αβχδεφγηιϕκλμνοπθρστυϖωξψζ'; // a..z
// Viñetas habituales de Wingdings.
export const WINGDINGS_CHARS = { 0x6C: '●', 0x6E: '■', 0x71: '❑', 0x76: '❖', 0xA7: '▪', 0xD8: '➢', 0xFC: '✓', 0xFB: '✗' };

// Letras con variante de pizarra (\mathbb) o caligráfica (\mathcal) en el plano básico de Unicode.
export const BB_BMP = { C: 'ℂ', H: 'ℍ', N: 'ℕ', P: 'ℙ', Q: 'ℚ', R: 'ℝ', Z: 'ℤ' };
export const CAL_BMP = { B: 'ℬ', E: 'ℰ', F: 'ℱ', H: 'ℋ', I: 'ℐ', L: 'ℒ', M: 'ℳ', R: 'ℛ' };
export const toDoubleStruck = L => BB_BMP[L] || String.fromCodePoint(0x1D538 + L.charCodeAt(0) - 65);
export const toScript = L => CAL_BMP[L] || String.fromCodePoint(0x1D49C + L.charCodeAt(0) - 65);

export function fontKind(fontName) {
  if (/CMEX|LMMathExtension/i.test(fontName)) return 'cmex';
  if (/CMSY|CMBSY|LMMathSymbols/i.test(fontName)) return 'cmsy';
  if (/CMMI|LMMathItalic/i.test(fontName)) return 'cmmi';
  if (/MSBM/i.test(fontName)) return 'msbm';
  if (/Wingdings/i.test(fontName)) return 'wingdings';
  if (/Symbol/i.test(fontName)) return 'symbol';
  if (/\+CM[A-Z]*\d|\+LMRoman/i.test(fontName)) return 'cmr';
  return 'text';
}

// Variantes Unicode de un mismo símbolo -> la forma que entienden las tablas de abajo.
// (Escapes \u a propósito: varios de estos símbolos tienen gemelos visualmente idénticos en otros bloques.)
export const UNICODE_ALIASES = {
  '\u2329': '\u27E8', '\u232A': '\u27E9', // 〈 〉 (técnicos) -> ⟨ ⟩
  '\u3008': '\u27E8', '\u3009': '\u27E9', // 〈 〉 (CJK) -> ⟨ ⟩
  '\u27EE': '(', '\u27EF': ')', '\u2223': '|', '\u2044': '/', '\u2236': ':',
  '\u2206': '\u0394', // ∆ (incremento) -> Δ
  '\uFE37': '', '\uFE38': '' // piezas de llaves horizontales (\overbrace, \underbrace): solo dibujo
};

export function decodePdfChars(str, fontName) {
  const kind = fontKind(fontName);
  let out = '';
  for (const ch of str) {
    const code = ch.codePointAt(0);
    if (UNICODE_ALIASES[ch]) { out += UNICODE_ALIASES[ch]; continue; }
    if (kind === 'cmex' && (code < 0x20 || /[0-9A-Za-z]/.test(ch)) && CMEX_CHARS[code] !== undefined) { out += CMEX_CHARS[code]; continue; }
    if (kind === 'msbm' && /[A-Z]/.test(ch)) { out += toDoubleStruck(ch); continue; }
    if (kind === 'cmsy' && /[A-Z]/.test(ch)) { out += toScript(ch); continue; }
    // CMSY 0x36 es la barra de negación que TeX superpone (≠ = barra + "=").
    if (kind === 'cmsy' && ch === '6') { out += '\u0338'; continue; }
    if (code < 0x20) {
      if (kind === 'cmsy') out += CMSY_LOW[code] || '';
      else if (kind === 'cmmi') out += CMMI_LOW[code] || '';
      else if (kind === 'cmr') out += CMR_LOW[code] || '';
      continue; // cualquier otro carácter de control se descarta
    }
    if (code >= 0xF000 && code <= 0xF0FF) {
      const c = code - 0xF000;
      if (kind === 'wingdings') out += WINGDINGS_CHARS[c] || '•';
      else if (c >= 0x41 && c <= 0x5A) out += SYMBOL_GREEK_UPPER[c - 0x41];
      else if (c >= 0x61 && c <= 0x7A) out += SYMBOL_GREEK_LOWER[c - 0x61];
      else if (SYMBOL_CHARS[c]) out += SYMBOL_CHARS[c];
      else if (c >= 0x20 && c < 0x7F) out += String.fromCharCode(c);
      continue;
    }
    if (DELIM_PIECES[code] !== undefined) { out += DELIM_PIECES[code]; continue; }
    if (code >= 0xE000 && code <= 0xF8FF) continue; // resto del área privada: sin significado conocido
    out += ch;
  }
  return out;
}

// Piezas de delimitadores altos (parte superior/extensión/inferior) del área privada de Adobe.
// Se traducen al delimitador completo; las piezas apiladas se funden después en uno solo.
export const DELIM_PIECES = {
  0xF8E5: '', 0xF8E6: '', 0xF8E7: '', 0xF8F4: '', 0xF8F5: '',
  0xF8EB: '(', 0xF8EC: '(', 0xF8ED: '(', 0xF8F6: ')', 0xF8F7: ')', 0xF8F8: ')',
  0xF8EE: '[', 0xF8EF: '[', 0xF8F0: '[', 0xF8F9: ']', 0xF8FA: ']', 0xF8FB: ']',
  0xF8F1: '{', 0xF8F2: '{', 0xF8F3: '{', 0xF8FC: '}', 0xF8FD: '}', 0xF8FE: '}'
};

// Los nombres reales de las fuentes solo llegan al hilo principal después de pedir la lista de operadores.
export async function loadPdfFontNames(page, items) {
  const ids = [...new Set(items.filter(it => it.str).map(it => it.fontName))];
  if (!ids.length) return () => '';

  const names = {};
  await Promise.all(ids.map(id => new Promise(resolve => {
    const timer = setTimeout(resolve, 1000);
    try {
      page.commonObjs.get(id, font => {
        // Sin el prefijo aleatorio del subconjunto ("QBOLDO+CMR10" -> "CMR10"): podría parecer "BOLD".
        names[id] = ((font && font.name) || '').replace(/^[A-Z]{6}\+/, '');
        clearTimeout(timer);
        resolve();
      });
    } catch (e) {
      clearTimeout(timer);
      resolve();
    }
  })));
  return id => names[id] || '';
}
