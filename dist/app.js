(() => {
  // src/converters/docx.js
  async function convertDocx(file, onProgress) {
    onProgress(10, "Leyendo documento Word...");
    const buf = await file.arrayBuffer();
    onProgress(35, "Extrayendo contenido...");
    const { value: html, messages } = await mammoth.convertToHtml({ arrayBuffer: buf });
    if (messages && messages.length) console.warn("Mammoth:", messages);
    onProgress(70, "Convirtiendo a Markdown...");
    const turndownService = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" });
    if (window.turndownPluginGfm) turndownService.use(turndownPluginGfm.gfm);
    const markdown = turndownService.turndown(html);
    return markdown.trim();
  }

  // src/converters/image.js
  function traducirEstadoTesseract(status2) {
    const map = {
      "loading tesseract core": "Cargando motor OCR",
      "initializing tesseract": "Inicializando OCR",
      "loading language traineddata": "Cargando datos de idioma",
      "initializing api": "Inicializando",
      "recognizing text": "Reconociendo texto"
    };
    return map[status2] || status2;
  }
  async function convertImage(file, onProgress) {
    onProgress(5, "Preparando OCR (espa\xF1ol + ingl\xE9s)...");
    const { data } = await Tesseract.recognize(file, "spa+eng", {
      logger: (m) => {
        if (m.status && typeof m.progress === "number") {
          onProgress(5 + Math.round(m.progress * 90), traducirEstadoTesseract(m.status) + "...");
        }
      }
    });
    return (data && data.text ? data.text : "").trim();
  }

  // src/converters/pdf/fonts.js
  var MATH_FONT_RE = /CMMI|CMSY|CMEX|CMBSY|MSAM|MSBM|EUFM|EUSM|RSFS|Math|Symbol|MT ?Extra/i;
  var CMEX_CHARS = (() => {
    const map = {};
    const set = (start, chars) => [...chars].forEach((c, i) => {
      map[start + i] = c;
    });
    set(0, "()[]\u230A\u230B\u2308\u2309{}\u27E8\u27E9|\u2016/\\");
    set(16, "()()[]\u230A\u230B\u2308\u2309{}\u27E8\u27E9/\\");
    set(32, "()[]\u230A\u230B\u2308\u2309{}\u27E8\u27E9/\\/\\");
    set(48, "()\u2308\u2309\u230A\u230B||{}{}{}||");
    set(64, "()()\u27E8\u27E9\u2294\u2294\u222E\u222E\u2299\u2299\u2295\u2295\u2297\u2297");
    set(80, "\u2211\u220F\u222B\u22C3\u22C2\u228E\u22C0\u22C1\u2211\u220F\u222B\u22C3\u22C2\u228E\u22C0\u22C1");
    set(96, "\u2210\u2210^^^~~~[]\u230A\u230B\u2308\u2309{}");
    set(112, "\u221A\u221A\u221A\u221A\u221A|||\u2191\u2193\u2191\u2193{}{}");
    return map;
  })();
  var CMSY_LOW = "\u2212\xB7\xD7\u2217\xF7\u22C4\xB1\u2213\u2295\u2296\u2297\u2298\u2299\u25EF\u25E6\u2022\u224D\u2261\u2286\u2287\u2264\u2265\u2AAF\u2AB0\u223C\u2248\u2282\u2283\u226A\u226B\u227A\u227B";
  var CMMI_LOW = "\u0393\u0394\u0398\u039B\u039E\u03A0\u03A3\u03A5\u03A6\u03A8\u03A9\u03B1\u03B2\u03B3\u03B4\u03F5\u03B6\u03B7\u03B8\u03B9\u03BA\u03BB\u03BC\u03BD\u03BE\u03C0\u03C1\u03C3\u03C4\u03C5\u03D5\u03C7";
  var CMR_LOW = [
    "\u0393",
    "\u0394",
    "\u0398",
    "\u039B",
    "\u039E",
    "\u03A0",
    "\u03A3",
    "\u03A5",
    "\u03A6",
    "\u03A8",
    "\u03A9",
    "ff",
    "fi",
    "fl",
    "ffi",
    "ffl",
    "\u0131",
    "\u0237",
    "`",
    "\xB4",
    "\u02C7",
    "\u02D8",
    "\xAF",
    "\u02DA",
    "\xB8",
    "\xDF",
    "\xE6",
    "\u0153",
    "\xF8",
    "\xC6",
    "\u0152",
    "\xD8"
  ];
  var SYMBOL_CHARS = {
    34: "\u2200",
    36: "\u2203",
    39: "\u220B",
    42: "\u2217",
    45: "\u2212",
    64: "\u2245",
    92: "\u2234",
    94: "\u22A5",
    126: "\u223C",
    162: "\u2032",
    163: "\u2264",
    165: "\u221E",
    171: "\u2194",
    172: "\u2190",
    173: "\u2191",
    174: "\u2192",
    175: "\u2193",
    176: "\xB0",
    177: "\xB1",
    178: "\u2033",
    179: "\u2265",
    180: "\xD7",
    181: "\u221D",
    182: "\u2202",
    183: "\u2022",
    184: "\xF7",
    185: "\u2260",
    186: "\u2261",
    187: "\u2248",
    188: "\u2026",
    196: "\u2297",
    197: "\u2295",
    198: "\u2205",
    199: "\u2229",
    200: "\u222A",
    201: "\u2283",
    202: "\u2287",
    203: "\u2284",
    204: "\u2282",
    205: "\u2286",
    206: "\u2208",
    207: "\u2209",
    208: "\u2220",
    209: "\u2207",
    213: "\u220F",
    214: "\u221A",
    215: "\xB7",
    216: "\xAC",
    217: "\u2227",
    218: "\u2228",
    219: "\u21D4",
    220: "\u21D0",
    222: "\u21D2",
    225: "\u27E8",
    229: "\u2211",
    241: "\u27E9",
    242: "\u222B"
  };
  var SYMBOL_GREEK_UPPER = "\u0391\u0392\u03A7\u0394\u0395\u03A6\u0393\u0397\u0399\u03D1\u039A\u039B\u039C\u039D\u039F\u03A0\u0398\u03A1\u03A3\u03A4\u03A5\u03C2\u03A9\u039E\u03A8\u0396";
  var SYMBOL_GREEK_LOWER = "\u03B1\u03B2\u03C7\u03B4\u03B5\u03C6\u03B3\u03B7\u03B9\u03D5\u03BA\u03BB\u03BC\u03BD\u03BF\u03C0\u03B8\u03C1\u03C3\u03C4\u03C5\u03D6\u03C9\u03BE\u03C8\u03B6";
  var WINGDINGS_CHARS = { 108: "\u25CF", 110: "\u25A0", 113: "\u2751", 118: "\u2756", 167: "\u25AA", 216: "\u27A2", 252: "\u2713", 251: "\u2717" };
  var BB_BMP = { C: "\u2102", H: "\u210D", N: "\u2115", P: "\u2119", Q: "\u211A", R: "\u211D", Z: "\u2124" };
  var CAL_BMP = { B: "\u212C", E: "\u2130", F: "\u2131", H: "\u210B", I: "\u2110", L: "\u2112", M: "\u2133", R: "\u211B" };
  var toDoubleStruck = (L) => BB_BMP[L] || String.fromCodePoint(120120 + L.charCodeAt(0) - 65);
  var toScript = (L) => CAL_BMP[L] || String.fromCodePoint(119964 + L.charCodeAt(0) - 65);
  function fontKind(fontName) {
    if (/CMEX|LMMathExtension/i.test(fontName)) return "cmex";
    if (/CMSY|CMBSY|LMMathSymbols/i.test(fontName)) return "cmsy";
    if (/CMMI|LMMathItalic/i.test(fontName)) return "cmmi";
    if (/MSBM/i.test(fontName)) return "msbm";
    if (/Wingdings/i.test(fontName)) return "wingdings";
    if (/Symbol/i.test(fontName)) return "symbol";
    if (/\+CM[A-Z]*\d|\+LMRoman/i.test(fontName)) return "cmr";
    return "text";
  }
  var UNICODE_ALIASES = {
    "\u2329": "\u27E8",
    "\u232A": "\u27E9",
    // 〈 〉 (técnicos) -> ⟨ ⟩
    "\u3008": "\u27E8",
    "\u3009": "\u27E9",
    // 〈 〉 (CJK) -> ⟨ ⟩
    "\u27EE": "(",
    "\u27EF": ")",
    "\u2223": "|",
    "\u2044": "/",
    "\u2236": ":",
    "\u2206": "\u0394",
    // ∆ (incremento) -> Δ
    "\uFE37": "",
    "\uFE38": ""
    // piezas de llaves horizontales (\overbrace, \underbrace): solo dibujo
  };
  function decodePdfChars(str, fontName) {
    const kind = fontKind(fontName);
    let out = "";
    for (const ch of str) {
      const code = ch.codePointAt(0);
      if (UNICODE_ALIASES[ch]) {
        out += UNICODE_ALIASES[ch];
        continue;
      }
      if (kind === "cmex" && (code < 32 || /[0-9A-Za-z]/.test(ch)) && CMEX_CHARS[code] !== void 0) {
        out += CMEX_CHARS[code];
        continue;
      }
      if (kind === "msbm" && /[A-Z]/.test(ch)) {
        out += toDoubleStruck(ch);
        continue;
      }
      if (kind === "cmsy" && /[A-Z]/.test(ch)) {
        out += toScript(ch);
        continue;
      }
      if (kind === "cmsy" && ch === "6") {
        out += "\u0338";
        continue;
      }
      if (code < 32) {
        if (kind === "cmsy") out += CMSY_LOW[code] || "";
        else if (kind === "cmmi") out += CMMI_LOW[code] || "";
        else if (kind === "cmr") out += CMR_LOW[code] || "";
        continue;
      }
      if (code >= 61440 && code <= 61695) {
        const c = code - 61440;
        if (kind === "wingdings") out += WINGDINGS_CHARS[c] || "\u2022";
        else if (c >= 65 && c <= 90) out += SYMBOL_GREEK_UPPER[c - 65];
        else if (c >= 97 && c <= 122) out += SYMBOL_GREEK_LOWER[c - 97];
        else if (SYMBOL_CHARS[c]) out += SYMBOL_CHARS[c];
        else if (c >= 32 && c < 127) out += String.fromCharCode(c);
        continue;
      }
      if (DELIM_PIECES[code] !== void 0) {
        out += DELIM_PIECES[code];
        continue;
      }
      if (code >= 57344 && code <= 63743) continue;
      out += ch;
    }
    return out;
  }
  var DELIM_PIECES = {
    63717: "",
    63718: "",
    63719: "",
    63732: "",
    63733: "",
    63723: "(",
    63724: "(",
    63725: "(",
    63734: ")",
    63735: ")",
    63736: ")",
    63726: "[",
    63727: "[",
    63728: "[",
    63737: "]",
    63738: "]",
    63739: "]",
    63729: "{",
    63730: "{",
    63731: "{",
    63740: "}",
    63741: "}",
    63742: "}"
  };
  async function loadPdfFontNames(page, items) {
    const ids = [...new Set(items.filter((it) => it.str).map((it) => it.fontName))];
    if (!ids.length) return () => "";
    const names = {};
    await Promise.all(ids.map((id) => new Promise((resolve) => {
      const timer = setTimeout(resolve, 1e3);
      try {
        page.commonObjs.get(id, (font) => {
          names[id] = (font && font.name || "").replace(/^[A-Z]{6}\+/, "");
          clearTimeout(timer);
          resolve();
        });
      } catch (e) {
        clearTimeout(timer);
        resolve();
      }
    })));
    return (id) => names[id] || "";
  }

  // src/converters/pdf/words.js
  function piecesToWords(pieces) {
    const words = [];
    let cur = null;
    let breakNext = true;
    const addPart = (part, p) => {
      cur.x0 = Math.min(cur.x0, p.x0);
      cur.x1 = Math.max(cur.x1, p.x1);
      cur.pieces.push(p);
      if (part.script === "base") {
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
    const newWord = (p) => {
      cur = { parts: [], pieces: [], x0: p.x0, x1: p.x1, bold: true, italic: true };
      words.push(cur);
    };
    let carry = null;
    pieces.forEach((orig, idx) => {
      const p = carry ? { ...orig, text: carry.text + orig.text, spaceBefore: carry.spaceBefore } : orig;
      carry = null;
      const next = pieces[idx + 1];
      const trimmed = p.text.trim();
      if (next && !p.math && trimmed.length === 1 && SPACING_ACCENTS[trimmed] && next.script === "base") {
        carry = { text: trimmed, spaceBefore: p.spaceBefore };
        return;
      }
      if (p.script !== "base" && cur) {
        if (p.spaceBefore && p.x0 >= cur.x1 && p.text.trim() && !LIMIT_OP_RE.test(rawOf(cur).trim())) newWord(p);
        addPart({ text: (p.spaceBefore ? " " : "") + p.text, script: p.script, math: p.math }, p);
        breakNext = /\s$/.test(p.text);
        return;
      }
      if (p.spaceBefore) breakNext = true;
      const len = p.text.length || 1;
      let offset = 0;
      for (const chunk of p.text.split(/(\s+)/)) {
        const start = offset;
        offset += chunk.length;
        if (!chunk) continue;
        if (/^\s+$/.test(chunk)) {
          breakNext = true;
          continue;
        }
        const sub = chunk.length === p.text.length ? p : {
          ...p,
          text: chunk,
          spaceBefore: start > 0 || p.spaceBefore,
          x0: p.x0 + (p.x1 - p.x0) * start / len,
          x1: p.x0 + (p.x1 - p.x0) * offset / len
        };
        if (breakNext || !cur) {
          newWord(sub);
          breakNext = false;
        }
        addPart({ text: chunk, script: "base", math: p.math }, sub);
      }
    });
    return words;
  }
  function joinHyphenatedLines(lines) {
    for (let i = 0; i < lines.length - 1; i++) {
      const cur = lines[i].words, next = lines[i + 1].words;
      if (!cur.length || !next.length) continue;
      const lastWord = cur[cur.length - 1];
      const lastPart = lastWord.parts[lastWord.parts.length - 1];
      const firstPart = next[0].parts[0];
      if (lastPart.script === "base" && !lastPart.math && /[A-Za-zÀ-ÿ][-‐]$/.test(lastPart.text) && firstPart.script === "base" && !firstPart.math && /^[a-záéíóúñü]/.test(firstPart.text)) {
        lastPart.text = lastPart.text.slice(0, -1) + firstPart.text;
        lastWord.parts.push(...next[0].parts.slice(1));
        next.shift();
        lines[i + 1].hyphenContinuation = true;
      }
    }
  }
  var rawOf = (word) => word.parts.map((p) => p.text).join("");
  function isFootnoteWord(word) {
    const scripts = word.parts.filter((p) => p.script !== "base");
    if (!scripts.length || word.parts.some((p) => p.math)) return false;
    if (scripts.some((p) => p.script !== "sup" || !/^[\d*†‡,]+$/.test(p.text.trim()))) return false;
    const base = word.parts.filter((p) => p.script === "base").map((p) => p.text).join("");
    return /^[A-Za-zÀ-ÿ]{3,}[.,;:)»”"]*$/.test(base) || /[.,;:)»”"]$/.test(base);
  }
  function classifyWord(word, index) {
    if (isFootnoteWord(word)) return "text";
    const raw = rawOf(word);
    if (index === 0 && /^\((?:[ivx]{1,4}|[a-h])\)$/.test(raw)) return "text";
    if (/^[A-Za-zÀ-ÿ]{3,}[¹²³⁰⁴-⁹]+[.,;:]?$/.test(raw)) return "text";
    if (word.parts.some((p) => p.math || p.script !== "base") || MATH_CHAR_RE.test(raw)) return "strong";
    if (FORMULA_RE.test(raw) && /[=<>+^]/.test(raw)) return "strong";
    if (SPANISH_SINGLE_RE.test(raw)) return "single";
    if (WEAK_RE.test(raw)) return "weak";
    return "text";
  }
  function mathMask(words) {
    const cls = words.map(classifyWord);
    const inMath = cls.map((c) => c === "strong");
    const canJoin = (j, neighbor) => cls[j] === "weak" || cls[j] === "single" && OPERATOR_WORD_RE.test(rawOf(words[neighbor]));
    cls.forEach((c, i) => {
      if (c !== "strong") return;
      for (let j = i - 1, nb = i; j >= 0 && !inMath[j] && canJoin(j, nb); nb = j, j--) inMath[j] = true;
      for (let j = i + 1, nb = i; j < words.length && !inMath[j] && canJoin(j, nb); nb = j, j++) inMath[j] = true;
    });
    return { cls, inMath };
  }
  function renderMathWord(word) {
    const out = [];
    const parts = [];
    for (let k = 0; k < word.parts.length; k++) {
      const a = word.parts[k], b = word.parts[k + 1];
      const prev = parts[parts.length - 1];
      const afterOperator = !prev || prev.script === "base" && /[-−+=·×÷(,:]\s*$/.test(prev.text);
      if (b && a.script !== "base" && b.script !== "base" && a.script !== b.script && afterOperator && a.x1 > b.x0 && b.x1 > a.x0) {
        const [num, den] = a.script === "sub" ? [b, a] : [a, b];
        parts.push({ script: "frac", tex: `\\frac{${textToLatex(num.text).trim()}}{${textToLatex(den.text).trim()}}` });
        k++;
      } else {
        parts.push(a);
      }
    }
    parts.forEach((p) => {
      if (p.script === "frac") {
        out.push({ script: "base", tex: p.tex });
        return;
      }
      if (p.script === "sup" && /^[′″']+$/.test(p.text.trim())) {
        out.push({ script: "base", tex: p.text.trim().replace(/″/g, "''").replace(/′/g, "'") });
        return;
      }
      const tex = p.script === "base" ? textToLatex(p.text) : textToLatex(p.text).trim();
      const prev = out[out.length - 1];
      if (p.script === "sup2" && prev && prev.script === "sup") prev.tex += "^{" + tex + "}";
      else out.push({ script: p.script === "sup2" ? "sup" : p.script, tex });
    });
    return out.map((o) => o.script === "base" ? o.tex : (o.script === "sup" ? "^{" : "_{") + o.tex + "}").join("");
  }
  function renderTextWord(word) {
    return word.parts.map((p) => p.script === "base" ? normalizePdfText(p.text) : `<sup>${normalizePdfText(p.text.trim())}</sup>`).join("").replace(/[\uE000\uE001]/g, "");
  }
  function peelRunPunctuation(run) {
    run = run.map((w) => ({ ...w, parts: w.parts.map((p) => ({ ...p })) }));
    const rawRun = run.map(rawOf).join(" ");
    let open = (rawRun.match(/\(/g) || []).length - (rawRun.match(/\)/g) || []).length;
    let before = "", after = "";
    const first = run[0].parts[0];
    while (open > 0 && first.script === "base" && first.text.startsWith("(")) {
      before += "(";
      first.text = first.text.slice(1);
      open--;
    }
    const lastWord = run[run.length - 1];
    const last = lastWord.parts[lastWord.parts.length - 1];
    if (last.script === "base") {
      let m;
      while (m = last.text.match(/[.,;:?!)]$/)) {
        if (m[0] === ")") {
          if (open >= 0) break;
          open++;
        }
        after = m[0] + after;
        last.text = last.text.slice(0, -1);
      }
    }
    run = run.map((w) => ({ ...w, parts: w.parts.filter((p) => p.text.trim() !== "") })).filter((w) => w.parts.length);
    return { before, after, run };
  }
  function stripBullet(words) {
    if (!words.length) return { words, list: false };
    const firstPart = words[0].parts[0];
    if (firstPart.script !== "base" || !BULLET_RE.test(firstPart.text)) return { words, list: false };
    words = words.slice();
    const rest = firstPart.text.replace(BULLET_RE, "");
    if (rest) words[0] = { ...words[0], parts: [{ ...firstPart, text: rest }, ...words[0].parts.slice(1)] };
    else if (words[0].parts.length > 1) words[0] = { ...words[0], parts: words[0].parts.slice(1) };
    else words.shift();
    return { words, list: true };
  }
  function isMathCandidate(line) {
    if (!line.words.length || line.hyphenContinuation || stripBullet(line.words).list) return false;
    const { cls } = mathMask(line.words);
    return cls.every((c, i) => c !== "text" || /^[.,;:…]+$/.test(rawOf(line.words[i])));
  }
  function isProse(words) {
    const { cls } = mathMask(words);
    return words.filter((w, i) => cls[i] === "text" && /[A-Za-zÀ-ÿ]{3,}/.test(rawOf(w))).length >= 3;
  }

  // src/converters/pdf/lines.js
  function attachMathAccents(pieces) {
    let pendingVec = false;
    pieces.forEach((p) => {
      if (!p.math) return;
      if (pendingVec && /^[A-Za-z0-9]/.test(p.text)) {
        p.text = p.text[0] + "\u20D7" + p.text.slice(1);
        pendingVec = false;
      }
      if (p.text.length > 1 && p.text.includes("~")) {
        p.text = p.text.replace(/~([A-Za-z0-9])/g, "$1\u20D7");
        if (/~$/.test(p.text)) {
          p.text = p.text.slice(0, -1);
          pendingVec = true;
        }
      }
    });
    return pieces.filter((acc, i) => {
      if (acc.text === "\u0338") {
        const next = pieces.slice(i + 1).find((p) => p.text.trim());
        const rest = next ? next.text.trimStart() : "";
        if (!rest) return false;
        const rel = [...rest][0];
        acc.text = "\u0338" + rel;
        acc.math = true;
        next.text = rest.slice(rel.length);
        next.spaceBefore = /^\s/.test(next.text);
        return true;
      }
      const mark = MATH_ACCENTS[acc.text];
      if (!mark || acc.script !== "base") return true;
      if (acc.text === "~" && !acc.math) return true;
      const center = (acc.x0 + acc.x1) / 2;
      const nextVis = pieces.slice(i + 1).find((p) => p.text.trim());
      const prevVis = pieces.slice(0, i).reverse().find((p) => p.text.trim());
      const target = [nextVis, prevVis].find((t) => t && (t.math || acc.text === "~") && t.text.trim() && !MATH_ACCENTS[t.text] && center >= t.x0 - 0.5 && center <= t.x1 + 0.5) || ((acc.text === "~" || acc.x1 - acc.x0 < 1) && nextVis && /^\s*[A-Za-z0-9]/.test(nextVis.text) ? nextVis : null);
      if (!target) return true;
      target.math = true;
      const chars = [...target.text];
      let idx = Math.min(chars.length - 1, Math.max(0, Math.floor((center - target.x0) / ((target.x1 - target.x0) / chars.length || 1))));
      while (idx > 0 && !/[\p{L}\p{N}]/u.test(chars[idx])) idx--;
      chars.splice(idx + 1, 0, mark);
      target.text = chars.join("");
      if (target === nextVis) target.spaceBefore = acc.spaceBefore;
      return false;
    });
  }
  function scriptFor(fs, dy, baseFs) {
    if (fs >= baseFs * 0.92) return "base";
    if (dy > baseFs * 0.15) return "sup";
    if (dy < -baseFs * 0.1) return "sub";
    return "base";
  }
  function bodyFontSize(lines) {
    const weight = {};
    lines.forEach((l) => l.pieces.forEach((p) => {
      const k = Math.round(p.fs * 2) / 2;
      weight[k] = (weight[k] || 0) + p.text.length;
    }));
    const best = Object.entries(weight).sort((a, b) => b[1] - a[1])[0];
    return best ? parseFloat(best[0]) : 10;
  }
  function buildPdfLines(items, fontNameOf) {
    const lines = [];
    let line = null;
    let prevEnd = 0;
    let prevStr = "";
    for (const item of items) {
      if (!item.str) continue;
      const t = item.transform;
      if (Math.abs(t[1]) > Math.abs(t[0]) * 0.1) continue;
      const fontName = fontNameOf(item.fontName);
      const decoded = decodePdfChars(item.str, fontName);
      if (!decoded) continue;
      const chars = [...decoded.trim()];
      if (chars.length > 1 && MATH_FONT_RE.test(fontName) && chars.every((c) => BIG_SYMBOL_RE.test(c))) {
        const w2 = (item.width || 0) / chars.length;
        items.splice(items.indexOf(item) + 1, 0, ...chars.slice(1).map((c, k) => ({
          ...item,
          str: c,
          width: w2,
          transform: [t[0], t[1], t[2], t[3], t[4] + w2 * (k + 1), t[5]],
          _decoded: true
        })));
        item.str = chars[0];
        item.width = w2;
        item._decoded = true;
      }
      const text = item._decoded ? item.str : decoded;
      const bold = /CMBX|CMB\d|Bold|Black|Heavy|Semibold|Demi/i.test(fontName);
      const italic = /CMTI|CMSL|CMBXTI|Italic|Oblique/i.test(fontName);
      const fs = Math.hypot(t[2], t[3]) || item.height || 10;
      const x = t[4], y = t[5];
      const w = item.width || 0;
      const math = MATH_FONT_RE.test(fontName);
      const big = math && BIG_SYMBOL_RE.test(text.trim());
      let script = "base";
      if (line) {
        const dy = y - line.baseY;
        const small = fs < line.fontSize * 0.92;
        const wrapped = Math.abs(dy) > fs * 0.15 && x < prevEnd - fs * 3;
        if (wrapped) {
          line = null;
        } else if (line.provisional) {
          if (!big && !small && text.trim() && Math.abs(dy) < fs * 1.5) {
            line.baseY = y;
            line.fontSize = fs;
            line.provisional = false;
            line.pieces.forEach((p) => {
              if (!p.big) p.script = scriptFor(p.fs, p.y - y, fs);
            });
          } else if (Math.abs(dy) > line.fontSize * 1.5) {
            line = null;
          }
        } else if (big && dy > -fs * 0.5 && dy < fs * 1.6) {
        } else if (small && dy > line.fontSize * 0.15 && dy <= line.fontSize * 1) {
          script = "sup";
        } else if (small && dy < -line.fontSize * 0.1 && dy >= -line.fontSize * 0.75) {
          script = "sub";
        } else if (Math.abs(dy) > line.fontSize * 0.4) {
          line = null;
        }
        const last = line && line.pieces[line.pieces.length - 1];
        if (script === "sup" && last && /^sup/.test(last.script) && fs < last.fs * 0.92 && y > last.y + last.fs * 0.15) {
          script = "sup2";
        }
      }
      if (!line) {
        const prev = lines[lines.length - 1];
        line = { baseY: y, fontSize: fs, provisional: big, pieces: [], paraBreak: false };
        if (prev) line.paraBreak = y > prev.baseY + prev.fontSize || prev.baseY - y > prev.fontSize * 1.8;
        lines.push(line);
        prevEnd = x;
        prevStr = "";
      }
      const gap = x - prevEnd;
      const spaceBefore = line.pieces.length > 0 && (/\s$/.test(prevStr) || /^\s/.test(text) || gap > fs * 0.2 || gap < -fs * 2);
      const arrow = /vect/i.test(fontName);
      line.pieces.push({ text, script, math, big, bold, italic, arrow, spaceBefore, x0: x, x1: x + w, y, fs });
      prevEnd = x + w;
      prevStr = text;
    }
    lines.forEach((l) => {
      l.pieces = attachMathAccents(l.pieces);
    });
    return lines;
  }
  var visible = (l) => l.pieces.filter((p) => p.text.trim());
  function attachOverArrows(lines) {
    const all = lines.flatMap((l) => l.pieces);
    lines.forEach((l) => {
      l.pieces = l.pieces.filter((a) => {
        if (!a.arrow) return true;
        const targets = all.filter((p) => !p.arrow && p.text.trim() && p.y < a.y - a.fs * 0.15 && p.y > a.y - a.fs * 1.3 && p.x1 > a.x0 + 1 && p.x0 < a.x1 - 1).sort((p, q) => p.x0 - q.x0);
        targets.forEach((p, k) => {
          const chars = [...p.text];
          const cw = (p.x1 - p.x0) / chars.length || 1;
          const i0 = Math.max(0, Math.floor((a.x0 - p.x0) / cw + 0.3));
          const i1 = Math.min(chars.length, Math.ceil((a.x1 - p.x0) / cw - 0.3));
          if (i1 <= i0) return;
          const inner = chars.slice(i0, i1).join("").replace(/\s+/g, "");
          p.text = chars.slice(0, i0).join("") + (k === 0 ? OA_OPEN : "") + inner + (k === targets.length - 1 ? OA_CLOSE : "") + chars.slice(i1).join("");
          p.math = true;
          if (k > 0) p.spaceBefore = false;
        });
        return !targets.length;
      });
    });
    lines.forEach((l) => {
      l.pieces = l.pieces.filter((p) => !p.arrow);
    });
  }
  function reunifyLines(lines) {
    const out = [];
    lines.forEach((l) => {
      const ps = visible(l);
      if (!ps.length || l.provisional) {
        out.push(l);
        return;
      }
      const x0 = Math.min(...ps.map((p) => p.x0));
      const host = out.slice(-8).reverse().find((h) => !h.provisional && visible(h).length && Math.abs(h.baseY - l.baseY) < Math.min(h.fontSize, l.fontSize) * 0.15 && x0 >= Math.max(...visible(h).map((p) => p.x1)) - 2);
      if (!host) {
        out.push(l);
        return;
      }
      const gap = x0 - Math.max(...visible(host).map((p) => p.x1));
      ps[0].spaceBefore = gap > ps[0].fs * 0.2;
      host.pieces.push(...l.pieces.filter((p) => p.text.trim() || p !== l.pieces[0]));
    });
    return out;
  }
  function absorbSatellites(lines, bodyFs) {
    const hosts = lines.filter((l) => l.words.length && !l.figureLabel && !isMathCandidate(l));
    lines.forEach((l) => {
      if (!l.words.length || l.figureLabel || !isMathCandidate(l)) return;
      const b = lineBox(l);
      const candidates = hosts.filter((h) => Math.abs(h.baseY - l.baseY) < bodyFs * 1.45 && // (El vector puede ser lo último del renglón: sus filas sobresalen un poco a la derecha.)
      lineBox(h).x0 <= b.x0 + 1 && b.x0 <= lineBox(h).x1 + bodyFs * 2 && h.pieces.some((p) => p.math && p.text.trim() && p.x1 > b.x0 - bodyFs * 2 && p.x0 < b.x1 + bodyFs * 2));
      const delimBefore = (h) => h.pieces.some((p) => p.big && p.x1 <= b.x0 + 1 && p.x1 > b.x0 - bodyFs * 3);
      const ownDelim = visible(l).some((p) => p.big);
      const valid = candidates.filter((h) => ownDelim || delimBefore(h));
      if (!valid.length) return;
      const host = valid.sort((h1, h2) => delimBefore(h2) - delimBefore(h1) || Math.abs(h1.baseY - l.baseY) - Math.abs(h2.baseY - l.baseY))[0];
      (host.satellites = host.satellites || []).push(...visible(l));
      l.absorbed = true;
    });
  }
  function lineBox(line) {
    const ps = line.pieces.filter((p) => p.text.trim());
    return { x0: Math.min(...ps.map((p) => p.x0)), x1: Math.max(...ps.map((p) => p.x1)) };
  }

  // src/converters/pdf/latex.js
  var droppedChars = {};
  var MATH_ACCENTS = {
    "~": "\u20D7",
    "\u02C6": "\u0302",
    "^": "\u0302",
    "\u02DC": "\u0303",
    "\xAF": "\u0304",
    "\u02D9": "\u0307",
    "\xA8": "\u0308",
    // A veces pdf.js ya entrega el acento como carácter combinante suelto (fragmento de ancho cero).
    "\u20D7": "\u20D7",
    "\u0302": "\u0302",
    "\u0303": "\u0303",
    "\u0304": "\u0304",
    "\u0307": "\u0307",
    "\u0308": "\u0308"
  };
  var ACCENT_COMMANDS = { "\u20D7": "\\vec", "\u0302": "\\hat", "\u0303": "\\tilde", "\u0304": "\\bar", "\u0307": "\\dot", "\u0308": "\\ddot" };
  var LIGATURES = { "\uFB00": "ff", "\uFB01": "fi", "\uFB02": "fl", "\uFB03": "ffi", "\uFB04": "ffl", "\uFB05": "st", "\uFB06": "st" };
  var SPACING_ACCENTS = { "\xB4": "\u0301", "`": "\u0300", "\xA8": "\u0308", "\u02DC": "\u0303", "\u02C6": "\u0302" };
  var UNICODE_SUPERSCRIPTS = {
    "\u2070": "0",
    "\xB9": "1",
    "\xB2": "2",
    "\xB3": "3",
    "\u2074": "4",
    "\u2075": "5",
    "\u2076": "6",
    "\u2077": "7",
    "\u2078": "8",
    "\u2079": "9",
    "\u207A": "+",
    "\u207B": "-",
    "\u207C": "=",
    "\u207D": "(",
    "\u207E": ")",
    "\u207F": "n",
    "\u2071": "i"
  };
  var UNICODE_SUBSCRIPTS = {
    "\u2080": "0",
    "\u2081": "1",
    "\u2082": "2",
    "\u2083": "3",
    "\u2084": "4",
    "\u2085": "5",
    "\u2086": "6",
    "\u2087": "7",
    "\u2088": "8",
    "\u2089": "9",
    "\u208A": "+",
    "\u208B": "-",
    "\u208C": "=",
    "\u208D": "(",
    "\u208E": ")",
    "\u2090": "a",
    "\u2091": "e",
    "\u2092": "o",
    "\u2093": "x",
    "\u1D62": "i",
    "\u2C7C": "j",
    "\u2099": "n",
    "\u2096": "k",
    "\u2098": "m",
    "\u209C": "t"
  };
  var LATEX_SYMBOLS = {
    // Letras griegas
    "\u03B1": "\\alpha",
    "\u03B2": "\\beta",
    "\u03B3": "\\gamma",
    "\u03B4": "\\delta",
    "\u03B5": "\\varepsilon",
    "\u03F5": "\\epsilon",
    "\u03B6": "\\zeta",
    "\u03B7": "\\eta",
    "\u03B8": "\\theta",
    "\u03D1": "\\vartheta",
    "\u03B9": "\\iota",
    "\u03BA": "\\kappa",
    "\u03BB": "\\lambda",
    "\u03BC": "\\mu",
    "\u03BD": "\\nu",
    "\u03BE": "\\xi",
    "\u03C0": "\\pi",
    "\u03D6": "\\varpi",
    "\u03C1": "\\rho",
    "\u03F1": "\\varrho",
    "\u03C3": "\\sigma",
    "\u03C2": "\\varsigma",
    "\u03C4": "\\tau",
    "\u03C5": "\\upsilon",
    "\u03C6": "\\varphi",
    "\u03D5": "\\phi",
    "\u03C7": "\\chi",
    "\u03C8": "\\psi",
    "\u03C9": "\\omega",
    "\u03BF": "o",
    "\u0393": "\\Gamma",
    "\u0394": "\\Delta",
    "\u0398": "\\Theta",
    "\u039B": "\\Lambda",
    "\u039E": "\\Xi",
    "\u03A0": "\\Pi",
    "\u03A3": "\\Sigma",
    "\u03A5": "\\Upsilon",
    "\u03A6": "\\Phi",
    "\u03A8": "\\Psi",
    "\u03A9": "\\Omega",
    "\u0391": "A",
    "\u0392": "B",
    "\u0395": "E",
    "\u0396": "Z",
    "\u0397": "H",
    "\u0399": "I",
    "\u039A": "K",
    "\u039C": "M",
    "\u039D": "N",
    "\u039F": "O",
    "\u03A1": "P",
    "\u03A4": "T",
    "\u03A7": "X",
    // Operadores y relaciones
    "\xB1": "\\pm",
    "\u2213": "\\mp",
    "\xD7": "\\times",
    "\xF7": "\\div",
    "\xB7": "\\cdot",
    "\u2217": "\\ast",
    "\u2218": "\\circ",
    "\u2212": "-",
    "\u22C4": "\\diamond",
    "\u2296": "\\ominus",
    "\u2298": "\\oslash",
    "\u2299": "\\odot",
    "\u25EF": "\\bigcirc",
    "\u25E6": "\\circ",
    "\u2022": "\\bullet",
    "\u2294": "\\sqcup",
    "\u228E": "\\uplus",
    "\u2264": "\\leq",
    "\u2265": "\\geq",
    "\u2260": "\\neq",
    "\u2248": "\\approx",
    "\u2261": "\\equiv",
    "\u223C": "\\sim",
    "\u2243": "\\simeq",
    "\u2245": "\\cong",
    "\u221D": "\\propto",
    "\u226A": "\\ll",
    "\u226B": "\\gg",
    "\u224D": "\\asymp",
    "\u227A": "\\prec",
    "\u227B": "\\succ",
    "\u2AAF": "\\preceq",
    "\u2AB0": "\\succeq",
    "\u2208": "\\in",
    "\u2209": "\\notin",
    "\u220B": "\\ni",
    "\u2282": "\\subset",
    "\u2283": "\\supset",
    "\u2286": "\\subseteq",
    "\u2287": "\\supseteq",
    "\u2284": "\\not\\subset",
    "\u2288": "\\nsubseteq",
    "\u2262": "\\not\\equiv",
    "\u2241": "\\nsim",
    "\u2249": "\\not\\approx",
    "\u226E": "\\nless",
    "\u226F": "\\ngtr",
    "\u2270": "\\nleq",
    "\u2271": "\\ngeq",
    "\u222A": "\\cup",
    "\u2229": "\\cap",
    "\u2205": "\\emptyset",
    "\u2216": "\\setminus",
    "\u2200": "\\forall",
    "\u2203": "\\exists",
    "\u2204": "\\nexists",
    "\xAC": "\\neg",
    "\u2227": "\\land",
    "\u2228": "\\lor",
    "\u2295": "\\oplus",
    "\u2297": "\\otimes",
    "\u2234": "\\therefore",
    "\u2192": "\\to",
    "\u2190": "\\leftarrow",
    "\u2194": "\\leftrightarrow",
    "\u21D2": "\\Rightarrow",
    "\u21D0": "\\Leftarrow",
    "\u21D4": "\\Leftrightarrow",
    "\u21A6": "\\mapsto",
    "\u2191": "\\uparrow",
    "\u2193": "\\downarrow",
    "\u2211": "\\sum",
    "\u220F": "\\prod",
    "\u2210": "\\coprod",
    "\u222B": "\\int",
    "\u222C": "\\iint",
    "\u222D": "\\iiint",
    "\u222E": "\\oint",
    "\u22C3": "\\bigcup",
    "\u22C2": "\\bigcap",
    "\u22C0": "\\bigwedge",
    "\u22C1": "\\bigvee",
    "\u2202": "\\partial",
    "\u2207": "\\nabla",
    "\u221E": "\\infty",
    "\u221A": "\\sqrt",
    "\u211D": "\\mathbb{R}",
    "\u2115": "\\mathbb{N}",
    "\u2124": "\\mathbb{Z}",
    "\u211A": "\\mathbb{Q}",
    "\u2102": "\\mathbb{C}",
    "\u210D": "\\mathbb{H}",
    "\u2119": "\\mathbb{P}",
    "\u212C": "\\mathcal{B}",
    "\u2130": "\\mathcal{E}",
    "\u2131": "\\mathcal{F}",
    "\u210B": "\\mathcal{H}",
    "\u2110": "\\mathcal{I}",
    "\u2112": "\\mathcal{L}",
    "\u2133": "\\mathcal{M}",
    "\u211B": "\\mathcal{R}",
    "\u27E8": "\\langle",
    "\u27E9": "\\rangle",
    "\u230A": "\\lfloor",
    "\u230B": "\\rfloor",
    "\u2308": "\\lceil",
    "\u2309": "\\rceil",
    "\u2016": "\\|",
    "\u2032": "'",
    "\u2033": "''",
    "\u2113": "\\ell",
    "\u210F": "\\hbar",
    "\u2220": "\\angle",
    "\u22A5": "\\perp",
    "\u2225": "\\parallel",
    "\u22EF": "\\cdots",
    "\u22EE": "\\vdots",
    "\u22F1": "\\ddots",
    "\u2026": "\\ldots",
    "\xB0": "^{\\circ}",
    "\u2013": "-",
    "\u2014": "-",
    "\xBD": "\\frac{1}{2}",
    "\u2153": "\\frac{1}{3}",
    "\u2154": "\\frac{2}{3}",
    "\xBC": "\\frac{1}{4}",
    "\xBE": "\\frac{3}{4}"
  };
  var escapeForCharClass = (chars) => chars.replace(/[\]\\^-]/g, "\\$&");
  var LATEX_SYMBOL_RE = new RegExp("[" + escapeForCharClass(Object.keys(LATEX_SYMBOLS).join("")) + "]", "g");
  var SUP_RUN_RE = new RegExp("[" + Object.keys(UNICODE_SUPERSCRIPTS).join("") + "]+", "g");
  var SUB_RUN_RE = new RegExp("[" + Object.keys(UNICODE_SUBSCRIPTS).join("") + "]+", "g");
  var MATH_CHAR_RE = new RegExp(
    "[" + escapeForCharClass(Object.keys(LATEX_SYMBOLS).filter((c) => !"\xB7\u2032\u2033\u2016\u25E6\u2022\u2026\xB0\u2013\u2014\xBD\u2153\u2154\xBC\xBE\u0391\u0392\u0395\u0396\u0397\u0399\u039A\u039C\u039D\u039F\u03A1\u03A4\u03A7\u03BF".includes(c)).join("") + Object.keys(UNICODE_SUPERSCRIPTS).join("") + Object.keys(UNICODE_SUBSCRIPTS).join("")) + "]|[\\u{1D400}-\\u{1D7FF}]",
    "u"
  );
  var MATH_ALNUM_RE = /[\u{1D400}-\u{1D7FF}]/gu;
  var MATH_FUNCTIONS = "arcsin|arccos|arctan|sinh|cosh|tanh|sin|cos|tan|cot|sec|csc|log|ln|exp|lim|max|min|sup|inf|det|gcd";
  var LATEX_FUNC_RE = new RegExp("(?<![\\\\A-Za-z])(" + MATH_FUNCTIONS + ")", "g");
  var SPANISH_FUNCS = { "l\xEDm": "lim", "m\xE1x": "max", "m\xEDn": "min" };
  var SPANISH_FUNC_RE = /(^|[^A-Za-zÀ-ÿ])(lím|máx|mín)(?![A-Za-zÀ-ÿ])/g;
  var OPERATOR_WORD_RE = /^[=<>+\-−*/×÷·±∓≤≥≠≈≡∼≃≅∝∈∉⊂⊃⊆⊇∪∩→←↔⇒⇐⇔↦]+$/;
  var RELATION_RE = /[=<>≤≥≠≈≡∼≃≅∝∈∉⊂⊃⊆⊇→⇒⇔↦]/;
  var FORMULA_RE = /^[A-Za-z0-9().,+\-*/=<>^|!'[\]]+$/;
  var WEAK_RE = new RegExp(
    "^[(\\[]*(-?\\d+([.,]\\d+)*|[A-Za-z]|[A-Za-z]{1,3}\\([^()]*\\)|[A-Za-z0-9]{1,2}([-/][A-Za-z0-9]{1,2})+|" + MATH_FUNCTIONS + "|l\xEDm|m\xE1x|m\xEDn)[)\\],.;:]*$|^[-/()[\\]|]+$"
  );
  var SPANISH_SINGLE_RE = /^[aeouyAEOUY][,.;:]?$/;
  var EQ_LABEL_RE = /^\((\d+(?:\.\d+)*[a-z]?)\)$/;
  var BIG_SYMBOL_RE = /^[∑∏∐∫∬∭∮⋃⋂⋀⋁√()[\]{}|‖⟨⟩⌊⌋⌈⌉]$/;
  var LIMIT_OP_RE = /^([∑∏∐∫∬∭∮⋃⋂⋀⋁]|lim|lím|max|máx|min|mín|sup|inf)$/;
  var BULLET_RE = /^[•◦▪▫●○■□‣⁃∙➢❖❑✓]\s*/;
  function normalizePdfText(s, { keepMathAlphabets = false } = {}) {
    return s.replace(/\u00AD/g, "").replace(/[ﬀ-ﬆ]/g, (c) => LIGATURES[c] || c).replace(MATH_ALNUM_RE, (c) => {
      const cp = c.codePointAt(0);
      if (keepMathAlphabets && (cp >= 119964 && cp <= 120015 || cp >= 120120 && cp <= 120171)) return c;
      return c.normalize("NFKC");
    }).replace(/([´`¨˜ˆ])\s?([a-zA-Zı])/g, (m, accent, letter) => {
      const composed = ((letter === "\u0131" ? "i" : letter) + SPACING_ACCENTS[accent]).normalize("NFC");
      return composed.length === 1 ? composed : m;
    });
  }
  function fixPunctuation(s) {
    return s.replace(/\s+([,.;:!?)\]}»”’])/g, "$1").replace(/([¿¡(\[{«“‘])\s+/g, "$1").replace(/([a-záéíóúñü]{2,}[,;])(?=[A-Za-zÁÉÍÓÚÑáéíóúñ])/g, "$1 ").replace(/([a-záéíóúñü][.:?!])(?=[A-ZÁÉÍÓÚÑ¿¡][a-záéíóúñü])/g, "$1 ").replace(/\s{2,}/g, " ").trim();
  }
  var OA_OPEN = "\uE000";
  var OA_CLOSE = "\uE001";
  var NEGATED = { "=": "\u2260", "\u2208": "\u2209", "\u2261": "\u2262", "\u2282": "\u2284", "\u2286": "\u2288", "\u223C": "\u2241", "\u2248": "\u2249", "<": "\u226E", ">": "\u226F", "\u2264": "\u2270", "\u2265": "\u2271", "\u2203": "\u2204" };
  function textToLatex(raw) {
    return normalizePdfText(raw, { keepMathAlphabets: true }).replace(/\u0338\s*(.)/gu, (m, rel) => NEGATED[rel] || "\\not " + rel).replace(/\u0338/g, "").replace(/[\\{}%#&$_]/g, (c) => c === "\\" ? "\\backslash " : "\\" + c).replace(/\^(?![A-Za-z0-9({])/g, "\\wedge ").replace(SPANISH_FUNC_RE, (m, pre, fn) => pre + "\\" + SPANISH_FUNCS[fn] + " ").replace(LATEX_FUNC_RE, "\\$1 ").replace(/\.\s?\.\s?\./g, "\\ldots ").replace(SUP_RUN_RE, (m) => "^{" + [...m].map((c) => UNICODE_SUPERSCRIPTS[c]).join("") + "}").replace(SUB_RUN_RE, (m) => "_{" + [...m].map((c) => UNICODE_SUBSCRIPTS[c]).join("") + "}").replace(/[\u{1D538}-\u{1D56B}]/gu, (c) => "\\mathbb{" + String.fromCharCode(65 + (c.codePointAt(0) - 120120) % 26) + "}").replace(/[\u{1D49C}-\u{1D4CF}]/gu, (c) => "\\mathcal{" + String.fromCharCode(65 + (c.codePointAt(0) - 119964) % 26) + "}").replace(LATEX_SYMBOL_RE, (c) => {
      const cmd = LATEX_SYMBOLS[c];
      return /[a-zA-Z]$/.test(cmd) ? cmd + " " : cmd;
    }).replace(
      /(\\[a-zA-Z]+(?:\{[A-Za-z]\})? ?|[A-Za-z0-9])([\u20D7\u0302\u0303\u0304\u0307\u0308])/g,
      (m, base, acc) => `${ACCENT_COMMANDS[acc]}{${base.trim()}}`
    ).replace(/\uE000\s*([^\uE000\uE001]*?)\s*\uE001/g, (m, inner) => `\\overrightarrow{${inner.trim()}}`).replace(/[\uE000\uE001]/g, "").replace(/[^\x20-\x7E]/gu, (c) => {
      if (/\p{L}/u.test(c) || "\xBF\xA1\u201C\u201D\xAB\xBB".includes(c)) return `\\text{${c}}`;
      droppedChars[c] = (droppedChars[c] || 0) + 1;
      return "";
    }).replace(/\s{2,}/g, " ");
  }
  function fixSqrt(tex) {
    return tex.replace(
      /\\sqrt\s*(\\frac\{[^{}]*\}\{[^{}]*\}|\([^()]*\)|\\[a-zA-Z]+(?:\{[^{}]*\})?|[A-Za-z0-9.]+)(\^\{[^{}]*\})?/g,
      (m, arg, sup) => "\\sqrt{" + (arg.startsWith("(") ? arg.slice(1, -1) : arg) + (sup || "") + "}"
    ).replace(/\\sqrt(?![{a-zA-Z])\s*/g, "\\surd ");
  }
  function fixDoubleScripts(tex) {
    let out = "";
    const states = [{ sup: false, sub: false }];
    const argFlags = [];
    let pendingArg = false;
    const top = () => states[states.length - 1];
    const reset = () => {
      top().sup = false;
      top().sub = false;
    };
    for (let i = 0; i < tex.length; i++) {
      const c = tex[i];
      if (c === "\\") {
        const m = tex.slice(i).match(/^\\([a-zA-Z]+|.)/);
        out += m[0];
        i += m[0].length - 1;
        if (pendingArg) pendingArg = false;
        else if (/^\\(left|right|big|Big|bigg|Bigg)/.test(m[0])) {
        } else reset();
        continue;
      }
      if (c === "^" || c === "_" || c === "'") {
        const key = c === "_" ? "sub" : "sup";
        if (top()[key]) {
          out += "{}";
          reset();
        }
        top()[key] = true;
        out += c;
        if (c !== "'") pendingArg = true;
        continue;
      }
      if (c === "{") {
        argFlags.push(pendingArg);
        pendingArg = false;
        states.push({ sup: false, sub: false });
        out += c;
        continue;
      }
      if (c === "}") {
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
  var tidyTex = (tex) => fixDoubleScripts(fixSqrt(tex).replace(/\.\s?\.\s?\./g, "\\ldots ").replace(/\\cdot\s*\\cdot\s*\\cdot/g, "\\cdots ").replace(/\s{2,}/g, " ").trim());

  // src/converters/pdf/matrices.js
  var DELIM_CHAR_RE = /^[()[\]{}|‖⟨⟩⌊⌋⌈⌉]$/;
  var DELIM_OPENERS = { "(": ")", "[": "]", "{": "}", "\u27E8": "\u27E9", "\u230A": "\u230B", "\u2308": "\u2309" };
  var DELIM_TEX = {
    "(": "(",
    ")": ")",
    "[": "[",
    "]": "]",
    "{": "\\{",
    "}": "\\}",
    "|": "|",
    "\u2016": "\\|",
    "\u27E8": "\\langle",
    "\u27E9": "\\rangle",
    "\u230A": "\\lfloor",
    "\u230B": "\\rfloor",
    "\u2308": "\\lceil",
    "\u2309": "\\rceil"
  };
  var MATRIX_ENVS = { "()": "pmatrix", "[]": "bmatrix", "{}": "Bmatrix", "||": "vmatrix", "\u2016\u2016": "Vmatrix" };
  function mergeDelimiters(pieces) {
    const rest = [], groups = [];
    pieces.forEach((p) => {
      if (!p.big || !DELIM_CHAR_RE.test(p.text.trim())) {
        rest.push(p);
        return;
      }
      const ch = p.text.trim();
      const g = groups.find((g2) => g2.ch === ch && Math.abs(g2.x0 - p.x0) < 1.5 && p.y > g2.yMin - p.fs * 2.5 && p.y < g2.yMax + p.fs * 2.5);
      if (g) {
        g.yMin = Math.min(g.yMin, p.y);
        g.yMax = Math.max(g.yMax, p.y);
        g.x1 = Math.max(g.x1, p.x1);
      } else {
        groups.push({ ch, x0: p.x0, x1: p.x1, yMin: p.y, yMax: p.y, base: p });
      }
    });
    groups.forEach((g) => rest.push({ ...g.base, text: g.ch, x1: g.x1, y: (g.yMin + g.yMax) / 2, delim: true }));
    return rest;
  }
  function collapseDots(pieces) {
    const dots = pieces.filter((p) => p.text.trim() === ".");
    const used = /* @__PURE__ */ new Set(), extra = [];
    dots.forEach((d) => {
      if (used.has(d)) return;
      const step = (a, dx) => dots.find((e) => !used.has(e) && e !== a && e !== d && a.y - e.y > 1.5 && a.y - e.y < a.fs * 0.8 && (dx ? e.x0 - a.x0 > 1.5 && e.x0 - a.x0 < a.fs * 1.5 : Math.abs(e.x0 - a.x0) < 1));
      for (const diagonal of [false, true]) {
        const d2 = step(d, diagonal), d3 = d2 && step(d2, diagonal);
        if (!d3) continue;
        [d, d2, d3].forEach((x) => used.add(x));
        extra.push({ ...d2, text: diagonal ? "\u22F1" : "\u22EE", x0: d.x0, x1: d3.x1, math: true });
        break;
      }
    });
    return pieces.filter((p) => !used.has(p)).concat(extra);
  }
  function matrixRows(content, fs0) {
    const rows = [];
    content.filter((p) => p.fs >= fs0 * 0.9 || /[⋮⋱]/.test(p.text)).sort((a, b) => b.y - a.y).forEach((p) => {
      const row = rows.find((r) => Math.abs(r.y - p.y) < fs0 * 0.45);
      if (!row) rows.push({ y: p.y, pieces: [] });
    });
    rows.sort((a, b) => b.y - a.y);
    content.forEach((p) => {
      const row = rows.reduce((best, r) => Math.abs(r.y - p.y) < Math.abs(best.y - p.y) ? r : best, rows[0]);
      if (row) row.pieces.push(p);
    });
    return rows.filter((r) => r.pieces.length);
  }
  function matrixCells(rowPieces, fs0) {
    const cells = [];
    [...rowPieces].sort((a, b) => a.x0 - b.x0).forEach((p) => {
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
  function extractMatrices(pieces, fs0) {
    const delims = pieces.filter((p) => p.delim).sort((a, b) => a.x0 - b.x0);
    const pairs = [], stack = [];
    delims.forEach((d) => {
      const ch = d.text;
      const top = stack[stack.length - 1];
      if (DELIM_OPENERS[ch]) stack.push({ open: d, bars: [] });
      else if ((ch === "|" || ch === "\u2016") && top && top.open.text !== ch && DELIM_OPENERS[top.open.text]) top.bars.push(d);
      else if ((ch === "|" || ch === "\u2016") && !(top && top.open.text === ch)) stack.push({ open: d, bars: [] });
      else if (top && (DELIM_OPENERS[top.open.text] === ch || top.open.text === ch)) pairs.push({ ...stack.pop(), close: d });
    });
    stack.filter((s) => s.open.text === "{").forEach((s) => pairs.push({ ...s, close: null }));
    const consumed = /* @__PURE__ */ new Set(), atoms = [];
    pairs.forEach(({ open, close, bars }) => {
      if (consumed.has(open) || close && consumed.has(close)) return;
      const xMax = close ? close.x0 + 1 : Infinity;
      const content = pieces.filter((p) => !p.delim && !consumed.has(p) && p.text.trim() && p.x0 >= open.x1 - 1 && p.x1 <= xMax);
      const rows = matrixRows(content, fs0);
      if (rows.length < 2) return;
      const rowCells = rows.map((r) => matrixCells(r.pieces, fs0));
      const multiColumn = rowCells.some((c) => c.length > 1);
      if (rows.length === 2 && !multiColumn && rows[0].y - rows[1].y >= fs0 * 1.28) return;
      const columns = [];
      rowCells.flat().sort((a, b) => a.x0 - b.x0).forEach((c) => {
        const col = columns.find((k) => overlaps(k, c, 1));
        if (col) {
          col.x0 = Math.min(col.x0, c.x0);
          col.x1 = Math.max(col.x1, c.x1);
        } else columns.push({ x0: c.x0, x1: c.x1 });
      });
      columns.sort((a, b) => a.x0 - b.x0);
      const body = rowCells.map((cells) => {
        const slots = columns.map(() => []);
        cells.forEach((c) => {
          const k = columns.findIndex((col) => overlaps(col, c, 1));
          slots[k < 0 ? 0 : k].push(...c.pieces);
        });
        return slots.map((s) => renderBox(s)).join(" & ");
      }).join(" \\\\ ");
      let tex;
      if (!close) {
        tex = `\\begin{cases} ${body} \\end{cases}`;
      } else if (bars.length) {
        const spec = columns.map((col, k) => "c" + (k < columns.length - 1 && bars.some((b) => b.x0 >= col.x1 - 1 && b.x1 <= columns[k + 1].x0 + 1) ? "|" : "")).join("");
        tex = `\\left${DELIM_TEX[open.text]} \\begin{array}{${spec}} ${body} \\end{array} \\right${DELIM_TEX[close.text]}`;
      } else if (MATRIX_ENVS[open.text + close.text]) {
        tex = `\\begin{${MATRIX_ENVS[open.text + close.text]}} ${body} \\end{${MATRIX_ENVS[open.text + close.text]}}`;
      } else {
        tex = `\\left${DELIM_TEX[open.text]} \\begin{matrix} ${body} \\end{matrix} \\right${DELIM_TEX[close.text]}`;
      }
      [open, close, ...bars, ...content].forEach((p) => p && consumed.add(p));
      const x1 = close ? close.x1 : Math.max(...content.map((p) => p.x1));
      atoms.push({ x0: open.x0, x1, raw: "", tex, upper: "", lower: "", scripts: "" });
    });
    return { atoms, rest: pieces.filter((p) => !consumed.has(p)) };
  }

  // src/converters/pdf/equations.js
  function renderBox(pieces) {
    if (!pieces.length) return "";
    const ref = pieces.reduce((a, b) => b.fs > a.fs ? b : a);
    const sorted = pieces.map((p) => {
      const dy = p.y - ref.y;
      const small = p.fs < ref.fs * 0.92;
      const script = small && dy > ref.fs * 0.15 ? "sup" : small && dy < -ref.fs * 0.1 ? "sub" : "base";
      return { ...p, script };
    }).sort((a, b) => a.x0 - b.x0);
    return tidyTex(piecesToWords(withGapSpaces(sorted)).map(renderMathWord).join(" "));
  }
  function withGapSpaces(sorted) {
    return sorted.map((p, i) => ({
      ...p,
      // Los símbolos grandes (∑, ∫, √, paréntesis altos) siempre van como palabra aparte.
      spaceBefore: i > 0 && (p.x0 - sorted[i - 1].x1 > p.fs * 0.2 || /^\s/.test(p.text) || p.big && p.script === "base" || sorted[i - 1].big && p.script === "base")
    }));
  }
  function groupBoxes(pieces, mainPieces) {
    const boxes = [];
    const blocked = (x0, x1) => mainPieces.some((m) => m.text.trim() && m.x0 >= x0 - 0.5 && m.x1 <= x1 + 0.5);
    [...pieces].sort((a, b) => a.x0 - b.x0).forEach((p) => {
      const box = boxes.find((b) => Math.abs(b.y - p.y) < Math.max(b.fs, p.fs) * 0.5 && p.x0 - b.x1 < Math.max(b.fs, p.fs) * 0.8 && !blocked(b.x1, p.x0));
      if (box) {
        box.pieces.push(p);
        box.x1 = Math.max(box.x1, p.x1);
        if (p.fs > box.fs) {
          box.fs = p.fs;
          box.y = p.y;
        }
      } else {
        boxes.push({ pieces: [p], x0: p.x0, x1: p.x1, y: p.y, fs: p.fs });
      }
    });
    return boxes.filter((b) => b.pieces.some((p) => p.text.trim()));
  }
  var overlaps = (a, b, pad = 0) => a.x0 < b.x1 + pad && b.x0 < a.x1 + pad;
  function renderEquation(pieces, Y0, fs0) {
    const matrices = extractMatrices(collapseDots(mergeDelimiters(pieces)), fs0);
    pieces = matrices.rest;
    const arrows = [];
    pieces.filter((p) => Math.abs(p.y - Y0) <= fs0 * 0.25 && /^[-−→⟶\s]+$/.test(p.text) && p.text.trim()).sort((a, b) => a.x0 - b.x0).forEach((p) => {
      const run = arrows[arrows.length - 1];
      if (run && !run.done && p.x0 - run.x1 < fs0 * 0.3) {
        run.x1 = p.x1;
        run.pieces.push(p);
      } else arrows.push({ x0: p.x0, x1: p.x1, pieces: [p] });
      if (/[→⟶]/.test(p.text)) arrows[arrows.length - 1].done = true;
    });
    const longArrows = arrows.filter((a) => a.done && a.x1 - a.x0 > fs0 * 1.5);
    const inArrow = (p) => longArrows.find((a) => p.x0 >= a.x0 - 1 && p.x1 <= a.x1 + 1);
    const main = [], above = [], below = [];
    for (const p of pieces) {
      const dy = p.y - Y0;
      const small = p.fs < fs0 * 0.92;
      if (longArrows.some((a) => a.pieces.includes(p))) continue;
      if (inArrow(p) && Math.abs(dy) > fs0 * 0.15) (dy > 0 ? above : below).push(p);
      else if (p.big) main.push({ ...p, script: "base" });
      else if (small && dy > fs0 * 0.15 && dy <= fs0 * 0.6) main.push({ ...p, script: "sup" });
      else if (small && dy < -fs0 * 0.1 && dy >= -fs0 * 0.5) main.push({ ...p, script: "sub" });
      else if (Math.abs(dy) <= fs0 * 0.25) main.push({ ...p, script: "base" });
      else (dy > 0 ? above : below).push(p);
    }
    const atoms = piecesToWords(withGapSpaces(main.sort((a, b) => a.x0 - b.x0))).map((w) => ({ x0: w.x0, x1: w.x1, raw: rawOf(w).trim(), tex: renderMathWord(w).trim(), upper: "", lower: "", scripts: "" }));
    const ups = groupBoxes(above, main), downs = groupBoxes(below, main);
    const used = /* @__PURE__ */ new Set();
    let tag = null;
    longArrows.forEach((a) => {
      const label2 = (list) => {
        const boxes = list.filter((b) => !used.has(b) && overlaps(b, a)).sort((x, y) => y.y - x.y);
        boxes.forEach((b) => used.add(b));
        const texs = boxes.map((b) => renderBox(b.pieces)).filter(Boolean);
        return texs.length > 1 ? `\\substack{${texs.join(" \\\\ ")}}` : texs[0] || "";
      };
      const up = label2(ups), down = label2(downs);
      const tex2 = up || down ? `\\xrightarrow${down ? `[${down}]` : ""}{${up}}` : "\\longrightarrow";
      atoms.push({ x0: a.x0, x1: a.x1, raw: "", tex: tex2, upper: "", lower: "", scripts: "" });
    });
    atoms.forEach((atom) => {
      if (!LIMIT_OP_RE.test(atom.raw)) return;
      const reach = { x0: atom.x0 - fs0 * 0.3, x1: atom.x1 + fs0 * 0.8 };
      const pick = (list) => list.find((b) => !used.has(b) && b.fs < fs0 * 0.92 && overlaps(b, reach));
      const up = pick(ups), down = pick(downs);
      if (up) {
        used.add(up);
        atom.upper = renderBox(up.pieces);
      }
      if (down) {
        used.add(down);
        atom.lower = renderBox(down.pieces);
      }
    });
    ups.forEach((up) => {
      if (used.has(up)) return;
      const down = downs.find((d) => !used.has(d) && overlaps(up, d));
      if (!down) return;
      used.add(up);
      used.add(down);
      atoms.push({
        x0: Math.min(up.x0, down.x0),
        x1: Math.max(up.x1, down.x1),
        raw: "",
        tex: `\\frac{${renderBox(up.pieces)}}{${renderBox(down.pieces)}}`,
        upper: "",
        lower: "",
        scripts: ""
      });
    });
    atoms.push(...matrices.atoms);
    atoms.sort((a, b) => a.x0 - b.x0);
    [...ups, ...downs].forEach((box) => {
      if (used.has(box)) return;
      const isUp = ups.includes(box);
      const raw = box.pieces.map((p) => p.text).join("").replace(/\s/g, "");
      const tex2 = renderBox(box.pieces);
      const label2 = raw.match(EQ_LABEL_RE);
      if (label2) {
        tag = tag || label2[1];
        return;
      }
      const prev = [...atoms].reverse().find((a) => a.x0 <= box.x0) || atoms[0];
      if (!prev || /^[.,;:]+$/.test(raw)) atoms.push({ x0: box.x0, x1: box.x1, raw: "", tex: tex2, upper: "", lower: "", scripts: "" });
      else prev.scripts += (isUp ? "^{" : "_{") + tex2 + "}";
    });
    atoms.sort((a, b) => a.x0 - b.x0);
    const last = atoms[atoms.length - 1];
    const label = last && last.raw.match(EQ_LABEL_RE);
    if (label && atoms.length > 1) {
      tag = tag || label[1];
      atoms.pop();
    }
    const parts = [];
    atoms.forEach((a, i) => {
      let tex2 = a.tex;
      if (a.lower) tex2 += `_{${a.lower}}`;
      if (a.upper) tex2 += `^{${a.upper}}`;
      tex2 += a.scripts;
      if (i > 0 && parts[parts.length - 1] === "\\sqrt") {
        parts[parts.length - 1] = `\\sqrt{${tex2}}`;
        return;
      }
      parts.push(tex2);
    });
    let tex = tidyTex(parts.join(" "));
    if (tag) tex += ` \\tag{${tag}}`;
    return tex;
  }
  function renderDisplayCluster(lines) {
    const pieces = lines.flatMap((l) => l.pieces).filter((p) => p.text.trim());
    const normal = pieces.filter((p) => !p.big);
    const fsMax = Math.max(...(normal.length ? normal : pieces).map((p) => p.fs));
    const full = pieces.filter((p) => p.fs >= fsMax * 0.9 && !p.big);
    const rows = [];
    full.forEach((p) => {
      const row = rows.find((r) => Math.abs(r.y - p.y) < fsMax * 0.25);
      if (row) {
        row.width += p.x1 - p.x0;
        row.rel = row.rel || RELATION_RE.test(p.text);
      } else rows.push({ y: p.y, width: p.x1 - p.x0, rel: RELATION_RE.test(p.text) });
    });
    let mains = rows.filter((r) => r.rel);
    if (!mains.length) mains = rows.length ? [rows.reduce((a, b) => b.width > a.width ? b : a)] : [{ y: pieces[0].y }];
    mains.sort((a, b) => b.y - a.y);
    mains = mains.filter((r, i) => i === 0 || mains[i - 1].y - r.y > fsMax * 1);
    const groups = mains.map(() => []);
    pieces.forEach((p) => {
      const py = p.big ? p.y - fsMax : p.y;
      let best = 0;
      mains.forEach((r, i) => {
        if (Math.abs(py - r.y) < Math.abs(py - mains[best].y)) best = i;
      });
      groups[best].push(p);
    });
    return mains.map((r, i) => renderEquation(groups[i], r.y, fsMax)).filter(Boolean);
  }

  // src/converters/pdf/inline.js
  function renderInline2D(group, line) {
    const pieces = [...new Set(group.flatMap((w) => w.pieces || []))].filter((p) => p.text.trim()).sort((a, b) => a.x0 - b.x0);
    if (!pieces.length || !line || !line.satellites) return null;
    const fs = line.fontSize;
    let x0 = pieces[0].x0 - 1, x1 = Math.max(...pieces.map((p) => p.x1)) + 1;
    const sats = [];
    let grew = true;
    while (grew) {
      grew = false;
      line.satellites.forEach((s) => {
        if (s.used || sats.includes(s) || s.x1 < x0 - fs * 0.5 || s.x0 > x1 + fs * 0.5) return;
        sats.push(s);
        x0 = Math.min(x0, s.x0);
        x1 = Math.max(x1, s.x1);
        grew = true;
      });
    }
    if (!sats.length) return null;
    sats.forEach((s) => {
      s.used = true;
    });
    let after = "";
    while (pieces.length > 1 && /^[.,;:?!]+$/.test(pieces[pieces.length - 1].text.trim()) && !pieces[pieces.length - 1].big) {
      after = pieces.pop().text.trim() + after;
    }
    const tex = renderEquation([...pieces, ...sats], line.baseY, line.fontSize).replace(/\s*\\tag\{[^}]*\}/, "");
    return { tex, after };
  }
  function renderPdfLine(lineWords, line) {
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
        const styleOf = (w) => (w.bold ? "b" : "") + (w.italic ? "i" : "");
        for (let k = 0; k < group.length; ) {
          const style = styleOf(group[k]);
          const run2 = [];
          while (k < group.length && styleOf(group[k]) === style) run2.push(group[k++]);
          const s = fixPunctuation(run2.map(renderTextWord).join(" ").replace(/\*/g, "\\*"));
          const mark = { b: "**", i: "*", bi: "***" }[style] || "";
          segs.push({ type: "text", s: s && mark ? mark + s + mark : s });
        }
        continue;
      }
      const twoD = renderInline2D(group, line);
      if (twoD) {
        if (twoD.tex) segs.push({ type: "math", s: twoD.tex });
        if (twoD.after) segs.push({ type: "text", s: twoD.after });
        continue;
      }
      const { before, after, run } = peelRunPunctuation(group);
      if (before) segs.push({ type: "text", s: before });
      const tex = run.length ? tidyTex(run.map(renderMathWord).join(" ")) : "";
      if (tex) segs.push({ type: "math", s: tex });
      if (after) segs.push({ type: "text", s: after });
    }
    (line && line.satellites || []).filter((s) => !s.used).forEach((s) => {
      s.used = true;
      segs.push({ type: "math", s: renderBox([s]) });
    });
    let md = "";
    for (const seg of segs) {
      const piece = seg.type === "math" ? `$${seg.s}$` : fixPunctuation(seg.s).replace(/\$/g, "\\$");
      if (!piece) continue;
      if (md && !/^[,.;:!?)\]}»”]/.test(piece) && !/[¿¡(\[{«“]$/.test(md)) md += " ";
      md += piece;
    }
    return (list ? "- " : "") + md;
  }

  // src/converters/pdf/figures.js
  function drawingBoxes(opList) {
    const O = pdfjsLib.OPS;
    const boxes = [];
    const stack = [];
    let ctm = [1, 0, 0, 1, 0, 0];
    let pending = null;
    const mul = (m, c) => [
      m[0] * c[0] + m[1] * c[2],
      m[0] * c[1] + m[1] * c[3],
      m[2] * c[0] + m[3] * c[2],
      m[2] * c[1] + m[3] * c[3],
      m[4] * c[0] + m[5] * c[2] + c[4],
      m[4] * c[1] + m[5] * c[3] + c[5]
    ];
    const boxOf = (x0, y0, x1, y1) => {
      const pts = [[x0, y0], [x0, y1], [x1, y0], [x1, y1]].map(([x, y]) => [x * ctm[0] + y * ctm[2] + ctm[4], x * ctm[1] + y * ctm[3] + ctm[5]]);
      const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
      return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys), n: 1 };
    };
    const PAINT = /* @__PURE__ */ new Set([
      O.stroke,
      O.closeStroke,
      O.fill,
      O.eoFill,
      O.fillStroke,
      O.eoFillStroke,
      O.closeFillStroke,
      O.closeEOFillStroke,
      O.shadingFill
    ]);
    opList.fnArray.forEach((fn, i) => {
      const args = opList.argsArray[i];
      if (fn === O.save) stack.push(ctm);
      else if (fn === O.restore) ctm = stack.pop() || ctm;
      else if (fn === O.transform) ctm = mul(args, ctm);
      else if (fn === O.paintFormXObjectBegin) {
        stack.push(ctm);
        if (args && args[0]) ctm = mul(args[0], ctm);
      } else if (fn === O.paintFormXObjectEnd) ctm = stack.pop() || ctm;
      else if (fn === O.constructPath) {
        const mm = args && args[2];
        if (mm && mm.length === 4 && isFinite(mm[0])) {
          pending = boxOf(mm[0], mm[2], mm[1], mm[3]);
          pending.n = Math.max(1, Math.ceil((args[0] && args[0].length || 1) / 2));
        }
      } else if (PAINT.has(fn)) {
        if (pending) boxes.push(pending);
        pending = null;
      } else if (fn === O.endPath) {
        pending = null;
      } else if (fn === O.paintImageXObject || fn === O.paintInlineImageXObject || fn === O.paintImageMaskXObject) {
        const b = boxOf(0, 0, 1, 1);
        b.n = 10;
        boxes.push(b);
      }
    });
    return boxes;
  }
  function findFigures(opList, lines, bodyFs) {
    if (!opList || typeof pdfjsLib === "undefined" || !pdfjsLib.OPS) return [];
    const pad = 3;
    const boxes = drawingBoxes(opList).filter((b) => !(b.y1 - b.y0 < 2 && b.x1 - b.x0 > bodyFs * 35));
    const parent = boxes.map((b, i) => i);
    const find = (i) => parent[i] === i ? i : parent[i] = find(parent[i]);
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
    const pieces = lines.flatMap((l) => l.pieces).filter((p) => p.text.trim());
    const figures = clusters.filter((c) => {
      const w = c.x1 - c.x0, h = c.y1 - c.y0;
      if (c.n < 6 || w < bodyFs * 4 || h < bodyFs * 3) return false;
      const textArea = pieces.filter((p) => p.x0 >= c.x0 - 1 && p.x1 <= c.x1 + 1 && p.y >= c.y0 - 1 && p.y <= c.y1 + 1).reduce((s, p) => s + (p.x1 - p.x0) * p.fs, 0);
      return textArea / (w * h) < 0.12;
    });
    const merged = [];
    figures.sort((a, b) => a.x0 - b.x0).forEach((f) => {
      const g = merged.find((m) => Math.min(m.y1, f.y1) - Math.max(m.y0, f.y0) > Math.min(m.y1 - m.y0, f.y1 - f.y0) * 0.5);
      if (g) Object.assign(g, { x0: Math.min(g.x0, f.x0), y0: Math.min(g.y0, f.y0), x1: Math.max(g.x1, f.x1), y1: Math.max(g.y1, f.y1), n: g.n + f.n });
      else merged.push({ ...f });
    });
    return merged.sort((a, b) => b.y1 - a.y1);
  }
  var CAPTION_RE = /^(Figura|Figure|Fig\.|Gráfica|Imagen|Tabla)/i;
  function attachFigures(lines, figures, pageNumber, bodyFs) {
    const topLine = lines.filter((l) => l.words.length).reduce((a, b) => b.baseY > a.baseY ? b : a, { baseY: -Infinity });
    figures.forEach((fig, k) => {
      fig.name = `figuras/pagina-${String(pageNumber).padStart(3, "0")}-${k + 1}.png`;
      const draw = { x0: fig.x0, x1: fig.x1 };
      const insideDrawing = (p) => p.x0 >= draw.x0 - bodyFs && p.x1 <= draw.x1 + bodyFs;
      const grow = (ps) => ps.forEach((p) => {
        fig.x0 = Math.min(fig.x0, p.x0);
        fig.x1 = Math.max(fig.x1, p.x1);
        fig.y0 = Math.min(fig.y0, p.y - p.fs * 0.3);
        fig.y1 = Math.max(fig.y1, p.y + p.fs);
      });
      fig.labelLines = [];
      const inBand = (l) => l.baseY >= fig.y0 - bodyFs * 0.6 && l.baseY <= fig.y1 + bodyFs * 0.3;
      const proseColumns = lines.filter((l) => !l.absorbed && !l.captionOf && l.words.length && l.baseY > fig.y0 + bodyFs && l.baseY < fig.y1 - bodyFs).map((l) => visible(l).filter((p) => !insideDrawing(p))).filter((ps) => ps.length && isProse(piecesToWords(ps.map((p) => ({ ...p }))))).map((ps) => ({ x0: Math.min(...ps.map((p) => p.x0)), x1: Math.max(...ps.map((p) => p.x1)) }));
      lines.forEach((l) => {
        if (l.figureLabel || l.absorbed || l.captionOf || !l.words.length) return;
        const ps = visible(l);
        const inPs = ps.filter(insideDrawing), outPs = ps.filter((p) => !insideDrawing(p));
        const nearTop = !outPs.length && l.baseY > fig.y1 && l.baseY <= fig.y1 + bodyFs * 1.4;
        if (!inBand(l) && !nearTop) return;
        if (l === topLine && l.baseY >= fig.y1 - 2 || CAPTION_RE.test(rawOf(l.words[0]).trim())) return;
        const prose = outPs.length > 0 && isProse(piecesToWords(outPs.map((p) => ({ ...p }))));
        const inColumn = outPs.some((p) => proseColumns.some((c) => p.x1 > c.x0 && p.x0 < c.x1));
        const allProse = !outPs.length && isProse(piecesToWords(inPs.map((p) => ({ ...p }))));
        if (!outPs.length && !allProse || outPs.length && !prose && !inColumn) {
          l.figureLabel = fig;
          fig.labelLines.push(l);
          grow(ps);
        } else if (prose && inPs.length) {
          const label = { ...l, pieces: inPs, words: piecesToWords(inPs.map((p) => ({ ...p }))) };
          fig.labelLines.push(label);
          grow(inPs);
          l.pieces = l.pieces.filter((p) => !inPs.includes(p));
          l.words = piecesToWords(l.pieces);
        }
      });
      const start = lines.findIndex((l) => !l.figureLabel && l.words.length && l.baseY < fig.y0 + bodyFs && l.baseY > fig.y0 - bodyFs * 5 && CAPTION_RE.test(rawOf(l.words[0]).trim()));
      fig.captionLines = [];
      if (start >= 0) {
        let prev = lines[start];
        fig.captionLines.push(prev);
        for (let j = start + 1; j < lines.length && fig.captionLines.length < 5; j++) {
          const l = lines[j];
          if (!l.words.length || l.figureLabel) continue;
          const text = l.words.map(rawOf).join(" ");
          const prevText = prev.words.map(rawOf).join(" ").trim();
          if (/[.:]$/.test(prevText) || prev.baseY - l.baseY > bodyFs * 1.5 || l.baseY >= prev.baseY) break;
          if (isProse(l.words) && Math.abs(lineBox(l).x0 - lineBox(prev).x0) > bodyFs * 3 && !/^[a-záéíóú]/.test(text)) break;
          fig.captionLines.push(l);
          prev = l;
        }
        fig.captionLines.forEach((l) => {
          l.captionOf = fig;
        });
      }
      fig.caption = fig.captionLines.map((l) => normalizePdfText(l.words.map(rawOf).join(" "))).join(" ").replace(/[\uE000\uE001]/g, "").replace(/\s+/g, " ").trim();
      const anchor = lines.find((l) => l.baseY <= fig.y1 + bodyFs * 0.3);
      if (anchor) (anchor.figuresBefore = anchor.figuresBefore || []).push(fig);
      else fig.orphan = true;
    });
  }
  async function renderFigureImages(page, figures) {
    if (!figures.length || typeof document === "undefined") return;
    const viewport = page.getViewport({ scale: 2.5 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    for (const fig of figures) {
      const m = 3;
      const [ax, ay, bx, by] = viewport.convertToViewportRectangle([fig.x0 - m, fig.y0 - m, fig.x1 + m, fig.y1 + m]);
      const left = Math.max(0, Math.floor(Math.min(ax, bx))), top = Math.max(0, Math.floor(Math.min(ay, by)));
      const w = Math.min(canvas.width - left, Math.ceil(Math.abs(bx - ax))), h = Math.min(canvas.height - top, Math.ceil(Math.abs(by - ay)));
      if (w <= 0 || h <= 0) continue;
      const out = document.createElement("canvas");
      out.width = w;
      out.height = h;
      out.getContext("2d").drawImage(canvas, left, top, w, h, 0, 0, w, h);
      fig.blob = await new Promise((resolve) => out.toBlob(resolve, "image/png"));
    }
  }
  function figureMarkdown(fig) {
    const alt = (fig.caption || "Figura").replace(/[[\]]/g, "");
    const parts = [`![${alt}](${fig.name})`];
    if (fig.captionLines && fig.captionLines.length) {
      parts.push(fig.captionLines.map((l) => renderPdfLine(l.words, l)).filter(Boolean).join(" "));
    }
    const labels = (fig.labelLines || []).sort((a, b) => b.baseY - a.baseY || lineBox(a).x0 - lineBox(b).x0).map((l) => renderPdfLine(l.words, l)).filter((md) => md && !/^[\s\d.,−\-+()$]*$/.test(md));
    if (labels.length) parts.push(`> **Texto en la figura:** ${labels.join(" \xB7 ")}`);
    return parts.join("\n\n");
  }

  // src/converters/pdf/layout.js
  function lineKey(line) {
    return normalizePdfText(line.words.map(rawOf).join("")).replace(/\d+/g, "#").replace(/\s+/g, "");
  }
  function removeRunningHeaders(pages) {
    const edgeLines = (p) => {
      const ls = p.lines.filter((l) => l.words.length).sort((a, b) => b.baseY - a.baseY);
      return /* @__PURE__ */ new Set([...ls.slice(0, 2), ...ls.slice(-3)]);
    };
    const counts = {};
    pages.forEach((p) => {
      p.edges = edgeLines(p);
      new Set([...p.edges].map(lineKey)).forEach((k) => {
        counts[k] = (counts[k] || 0) + 1;
      });
    });
    pages.forEach((p) => {
      p.lines = p.lines.filter((l) => {
        if (!p.edges.has(l)) return true;
        const key = lineKey(l);
        return !(counts[key] >= 3 || /^#?$/.test(key));
      });
    });
  }
  function pageLayout(lines, bodyFs) {
    const body = lines.filter((l) => l.words.length && Math.abs(l.fontSize - bodyFs) < 0.6);
    const xs = body.map((l) => Math.round(lineBox(l).x0));
    const freq = {};
    xs.forEach((x) => {
      freq[x] = (freq[x] || 0) + 1;
    });
    const left = xs.length ? +Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0] : 72;
    const rights = body.map((l) => lineBox(l).x1).sort((a, b) => a - b);
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
  var LIST_START_RE = /^(\((?:[ivxlc]+|[a-z]|\d+)\)|[a-z]\)|\d+\)|- )\s?/;
  var TOC_LINE_RE = /(\.\s?){4,}\s*\d+\s*$/;
  function headingLevel(line, md, bodyFs) {
    const text = md.replace(/\*+/g, "").trim();
    if (!text || text.length > 110 || /\$\$/.test(md) || TOC_LINE_RE.test(text)) return 0;
    const ratio = line.fontSize / bodyFs;
    const lettered = line.words.filter((w) => /[A-Za-zÀ-ÿ]{2,}/.test(rawOf(w)));
    const allBold = lettered.length > 0 && lettered.every((w) => w.bold);
    if (ratio >= 1.7) return 1;
    if (ratio >= 1.35) return 2;
    if (ratio >= 1.12) return 3;
    if (allBold && text.length < 80 && !/[.:!?]$/.test(text) && !/\s\d+$/.test(text) && !text.includes("$")) return 4;
    return 0;
  }
  function renderPdfBlocks(lines, figures = []) {
    const blocks = [];
    const bodyFs = bodyFontSize(lines);
    lines = lines.filter((l) => l.figuresBefore || !l.absorbed && l.words.length);
    const layout = pageLayout(lines, bodyFs);
    let para = null;
    const flush = () => {
      if (!para) return;
      const joined = para.lines.reduce((acc, l) => acc && /[^\\$]\$$/.test(acc) && /^\$[^$]/.test(l) ? acc.slice(0, -1) + " " + l.slice(1) : acc ? acc + " " + l : l, "");
      const text = joined.replace(/\*\*\* \*\*\*/g, " ").replace(/\*\* \*\*/g, " ").replace(/(?<!\*)\* \*(?!\*)/g, " ").replace(/(\p{Ll})- (\p{Ll})/gu, "$1$2").replace(/\s{2,}/g, " ").trim();
      if (text) blocks.push({ type: "p", text });
      para = null;
    };
    const pushBlock = (type, text) => {
      flush();
      blocks.push({ type, text });
    };
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      (line.figuresBefore || []).forEach((fig) => {
        if (!fig.emitted) {
          fig.emitted = true;
          pushBlock("figure", figureMarkdown(fig));
        }
      });
      if (line.figureLabel || line.captionOf || line.absorbed || !line.words.length) continue;
      if (isMathCandidate(line)) {
        let j = i + 1, yMin = line.baseY, yMax = line.baseY;
        const onlyDelims = (l) => l.pieces.every((p) => !p.text.trim() || p.big && DELIM_CHAR_RE.test(p.text.trim()));
        while (j < lines.length && !lines[j].figureLabel && !lines[j].figuresBefore && isMathCandidate(lines[j])) {
          const y = lines[j].baseY, reach = bodyFs * (onlyDelims(lines[j]) ? 6 : 2.6);
          if (y < yMin - reach || y > yMax + reach) break;
          yMin = Math.min(yMin, y);
          yMax = Math.max(yMax, y);
          j++;
        }
        const cluster = lines.slice(i, j);
        if (cluster.some((l) => mathMask(l.words).cls.includes("strong"))) {
          renderDisplayCluster(cluster).forEach((tex) => pushBlock("math", `$$
${tex}
$$`));
          i = j - 1;
          continue;
        }
      }
      const md = renderPdfLine(line.words, line);
      if (!md) continue;
      const level = headingLevel(line, md, bodyFs);
      if (level) {
        const text = md.replace(/\*\*/g, "").trim();
        const last = blocks[blocks.length - 1];
        if (!para && last && last.type === "h" && last.level === level && last.y - line.baseY < line.fontSize * 1.6) {
          last.text += " " + text;
          last.y = line.baseY;
        } else {
          flush();
          blocks.push({ type: "h", level, text, y: line.baseY });
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
        const columnRight = para.beforeLast ? Math.max(lineBox(para.beforeLast).x1, prevBox.x1) : Math.min(layout.right, box.x1);
        const tall = (l) => l.satellites && l.satellites.length || l.pieces.some((p) => p.big);
        const maxGap = layout.lineGap * (tall(prev) || tall(line) ? 2.3 : 1.35);
        newPara = gap > maxGap || gap < 0 || // espacio extra o salto de columna
        LIST_START_RE.test(md) || TOC_LINE_RE.test(md) || TOC_LINE_RE.test(para.lines[para.lines.length - 1]) || prevBox.x1 < columnRight - bodyFs * 3 || // el renglón anterior terminó corto
        box.x0 > layout.left + bodyFs * 0.8 && next && next.words.length && box.x0 > lineBox(next).x0 + bodyFs * 0.8;
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
    figures.filter((f) => !f.emitted).forEach((f) => {
      f.emitted = true;
      blocks.push({ type: "figure", text: figureMarkdown(f) });
    });
    return blocks;
  }
  function blocksToMarkdown(blocks) {
    return blocks.map((b) => {
      if (b.type === "h") return "#".repeat(Math.min(6, b.level + 1)) + " " + b.text;
      return b.text;
    }).join("\n\n");
  }

  // src/converters/pdf/index.js
  if (typeof window !== "undefined") pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  async function convertPdf(file, onProgress) {
    onProgress(5, "Cargando PDF...");
    Object.keys(droppedChars).forEach((k) => delete droppedChars[k]);
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf, disableFontFace: true }).promise;
    const total = pdf.numPages;
    const pages = [];
    const files = [];
    for (let i = 1; i <= total; i++) {
      onProgress(5 + Math.round(i / total * 85), `Extrayendo p\xE1gina ${i} de ${total}...`);
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      let opList = null;
      try {
        opList = await page.getOperatorList();
      } catch (e) {
      }
      const fontNameOf = await loadPdfFontNames(page, content.items);
      const rawLines = buildPdfLines(content.items, fontNameOf);
      attachOverArrows(rawLines);
      const lines = reunifyLines(rawLines);
      lines.forEach((ln) => {
        ln.words = piecesToWords(ln.pieces);
      });
      joinHyphenatedLines(lines);
      const bodyFs = bodyFontSize(lines);
      const figures = findFigures(opList, lines, bodyFs);
      absorbSatellites(lines, bodyFs);
      attachFigures(lines, figures, i, bodyFs);
      try {
        await renderFigureImages(page, figures);
      } catch (e) {
        console.warn("No se pudo recortar una figura de la p\xE1gina " + i, e);
      }
      figures.forEach((f) => {
        if (f.blob) files.push({ path: f.name, blob: f.blob });
      });
      pages.push({ number: i, lines, figures, height: page.view[3] - page.view[1] });
      page.cleanup();
    }
    onProgress(95, "Armando p\xE1rrafos y t\xEDtulos...");
    removeRunningHeaders(pages);
    const parts = [];
    pages.forEach((p) => {
      const blocks = renderPdfBlocks(p.lines, p.figures);
      const prev = parts[parts.length - 1];
      const first = blocks[0];
      if (prev && prev.lastBlock && prev.lastBlock.type === "p" && first && first.type === "p" && !/[.:!?]$/.test(prev.lastBlock.text) && /^[a-záéíóúñ$(]/.test(first.text)) {
        prev.lastBlock.text += " " + first.text;
        blocks.shift();
      }
      parts.push({ number: p.number, blocks, lastBlock: blocks[blocks.length - 1] || prev && prev.lastBlock });
    });
    const markdown = parts.map((p) => `<!-- P\xE1gina ${p.number} -->` + (p.blocks.length ? "\n\n" + blocksToMarkdown(p.blocks) : "")).join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
    if (Object.keys(droppedChars).length) console.warn("Caracteres sin traducci\xF3n a LaTeX (omitidos):", droppedChars);
    return files.length ? { markdown, files } : markdown;
  }

  // src/converters/pptx.js
  function extractSlideNumber(path) {
    const m = path.match(/(\d+)\.xml$/);
    return m ? parseInt(m[1], 10) : 0;
  }
  function parseSlideShapes(slideDoc) {
    let title = "";
    const bullets = [];
    const shapes = Array.from(slideDoc.getElementsByTagName("p:sp"));
    shapes.forEach((sp) => {
      const ph = sp.getElementsByTagName("p:ph")[0];
      const phType = ph ? ph.getAttribute("type") : null;
      const txBody = sp.getElementsByTagName("p:txBody")[0];
      if (!txBody) return;
      const paraTexts = Array.from(txBody.getElementsByTagName("a:p")).map((p) => Array.from(p.getElementsByTagName("a:t")).map((r) => r.textContent).join("")).filter((t) => t.trim() !== "");
      if (phType === "title" || phType === "ctrTitle") {
        title = paraTexts.join(" ");
      } else {
        bullets.push(...paraTexts);
      }
    });
    return { title, bullets };
  }
  function parseNotesText(notesDoc) {
    const shapes = Array.from(notesDoc.getElementsByTagName("p:sp"));
    const lines = [];
    shapes.forEach((sp) => {
      const ph = sp.getElementsByTagName("p:ph")[0];
      const phType = ph ? ph.getAttribute("type") : null;
      if (phType && phType !== "body") return;
      const txBody = sp.getElementsByTagName("p:txBody")[0];
      if (!txBody) return;
      Array.from(txBody.getElementsByTagName("a:p")).forEach((p) => {
        const text = Array.from(p.getElementsByTagName("a:t")).map((r) => r.textContent).join("");
        if (text.trim()) lines.push(text);
      });
    });
    return lines.join("\n");
  }
  async function convertPptx(file, onProgress) {
    onProgress(5, "Leyendo PowerPoint...");
    const buf = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(buf);
    const presFile = zip.file("ppt/presentation.xml");
    const relsFile = zip.file("ppt/_rels/presentation.xml.rels");
    if (!presFile || !relsFile) {
      throw new Error("El archivo no parece ser un .pptx v\xE1lido.");
    }
    const presDoc = new DOMParser().parseFromString(await presFile.async("text"), "application/xml");
    const relsDoc = new DOMParser().parseFromString(await relsFile.async("text"), "application/xml");
    const relMap = {};
    Array.from(relsDoc.getElementsByTagName("Relationship")).forEach((r) => {
      relMap[r.getAttribute("Id")] = r.getAttribute("Target");
    });
    let slidePaths = Array.from(presDoc.getElementsByTagName("p:sldId")).map((s) => relMap[s.getAttribute("r:id")]).filter(Boolean).map((target) => {
      target = target.replace(/^\.?\//, "");
      return target.startsWith("ppt/") ? target : "ppt/" + target;
    });
    if (!slidePaths.length) {
      slidePaths = Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a, b) => extractSlideNumber(a) - extractSlideNumber(b));
    }
    const total = slidePaths.length;
    let md = "";
    for (let i = 0; i < total; i++) {
      onProgress(5 + Math.round((i + 1) / total * 90), `Procesando slide ${i + 1} de ${total}...`);
      const path = slidePaths[i];
      const slideDoc = new DOMParser().parseFromString(await zip.file(path).async("text"), "application/xml");
      const { title, bullets } = parseSlideShapes(slideDoc);
      md += `

## Slide ${i + 1}

`;
      if (title) md += `### ${title}

`;
      bullets.forEach((b) => {
        md += `- ${b}
`;
      });
      const slideFileName = path.split("/").pop();
      const relsPath = `ppt/slides/_rels/${slideFileName}.rels`;
      const slideRelsFile = zip.file(relsPath);
      if (slideRelsFile) {
        const slideRelsDoc = new DOMParser().parseFromString(await slideRelsFile.async("text"), "application/xml");
        const noteRel = Array.from(slideRelsDoc.getElementsByTagName("Relationship")).find((r) => (r.getAttribute("Type") || "").includes("notesSlide"));
        if (noteRel) {
          const notesPath = noteRel.getAttribute("Target").replace("../", "ppt/");
          const notesFile = zip.file(notesPath);
          if (notesFile) {
            const notesDoc = new DOMParser().parseFromString(await notesFile.async("text"), "application/xml");
            const notesText = parseNotesText(notesDoc).trim();
            if (notesText) md += `
**Notas del presentador:**
${notesText}
`;
          }
        }
      }
    }
    return md.trim();
  }

  // src/converters/xlsx.js
  var CHART_TYPE_LABELS = {
    barChart: "Gr\xE1fico de barras",
    bar3DChart: "Gr\xE1fico de barras 3D",
    lineChart: "Gr\xE1fico de l\xEDneas",
    line3DChart: "Gr\xE1fico de l\xEDneas 3D",
    pieChart: "Gr\xE1fico circular",
    pie3DChart: "Gr\xE1fico circular 3D",
    ofPieChart: "Gr\xE1fico circular compuesto",
    doughnutChart: "Gr\xE1fico de anillos",
    areaChart: "Gr\xE1fico de \xE1rea",
    area3DChart: "Gr\xE1fico de \xE1rea 3D",
    scatterChart: "Gr\xE1fico de dispersi\xF3n",
    bubbleChart: "Gr\xE1fico de burbujas",
    radarChart: "Gr\xE1fico de radar",
    stockChart: "Gr\xE1fico de cotizaciones",
    surfaceChart: "Gr\xE1fico de superficie",
    surface3DChart: "Gr\xE1fico de superficie 3D"
  };
  function getEls(root, localName) {
    if (!root) return [];
    return Array.from(root.getElementsByTagName("*")).filter((el) => el.localName === localName);
  }
  function escapeMdCell(val) {
    if (val === void 0 || val === null) return "";
    return String(val).replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>").trim();
  }
  function sheetToMarkdownTable(ws) {
    if (!ws || !ws["!ref"]) return "_Hoja vac\xEDa._\n";
    const range = XLSX.utils.decode_range(ws["!ref"]);
    const grid = [];
    for (let r = range.s.r; r <= range.e.r; r++) {
      const row = [];
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cell = ws[XLSX.utils.encode_cell({ r, c })];
        let val = "";
        if (cell) {
          val = cell.w !== void 0 && cell.w !== "" ? cell.w : cell.v !== void 0 ? cell.v : "";
        }
        row.push(val);
      }
      grid.push(row);
    }
    (ws["!merges"] || []).forEach((m) => {
      const topVal = grid[m.s.r - range.s.r][m.s.c - range.s.c];
      for (let r = m.s.r; r <= m.e.r; r++) {
        for (let c = m.s.c; c <= m.e.c; c++) {
          grid[r - range.s.r][c - range.s.c] = topVal;
        }
      }
    });
    if (!grid.length) return "_Hoja vac\xEDa._\n";
    const header = grid[0].map(escapeMdCell);
    const numCols = header.length;
    let md = "| " + header.map((h) => h || " ").join(" | ") + " |\n";
    md += "| " + header.map(() => "---").join(" | ") + " |\n";
    for (let i = 1; i < grid.length; i++) {
      const row = grid[i];
      md += "| " + Array.from({ length: numCols }, (_, ci) => escapeMdCell(row[ci])).join(" | ") + " |\n";
    }
    return md;
  }
  function extractChartSheetName(ref) {
    if (!ref) return null;
    const m = ref.match(/^'?([^'!]+)'?!/);
    return m ? m[1] : null;
  }
  function parseChartXml(xmlDoc) {
    const plotArea = getEls(xmlDoc, "plotArea")[0];
    if (!plotArea) return null;
    const chartTypeEl = Array.from(plotArea.children).find((el) => /Chart$/.test(el.localName));
    const chartType = chartTypeEl ? chartTypeEl.localName : null;
    const typeLabel = CHART_TYPE_LABELS[chartType] || "Gr\xE1fico";
    let title = "";
    const titleEl = getEls(xmlDoc, "title")[0];
    if (titleEl) {
      const strCache = getEls(titleEl, "strCache")[0];
      if (strCache) {
        title = getEls(strCache, "pt").map((p) => (getEls(p, "v")[0] || {}).textContent || "").join(" ");
      } else {
        const runs = getEls(titleEl, "r");
        if (runs.length) title = runs.map((r) => (getEls(r, "t")[0] || {}).textContent || "").join("");
      }
    }
    const serEls = chartTypeEl ? getEls(chartTypeEl, "ser") : [];
    if (!serEls.length) return null;
    const readRef = (refEl) => {
      if (!refEl) return { ref: "", pts: [] };
      const f = getEls(refEl, "f")[0];
      const ref = f ? f.textContent : "";
      const cache = getEls(refEl, "strCache")[0] || getEls(refEl, "numCache")[0];
      const pts = cache ? getEls(cache, "pt").map((p) => ({
        idx: parseInt(p.getAttribute("idx"), 10),
        val: (getEls(p, "v")[0] || {}).textContent || ""
      })) : [];
      return { ref, pts };
    };
    const series = serEls.map((ser, i) => {
      const txV = getEls(getEls(ser, "tx")[0], "v")[0];
      const name = txV && txV.textContent || "Serie " + (i + 1);
      let catEl = getEls(ser, "cat")[0];
      let valEl = getEls(ser, "val")[0];
      let usingXY = false;
      if (!catEl && !valEl) {
        catEl = getEls(ser, "xVal")[0];
        valEl = getEls(ser, "yVal")[0];
        usingXY = true;
      }
      const cat = readRef(catEl);
      const val = readRef(valEl);
      return { name, catRef: cat.ref, categories: cat.pts, valRef: val.ref, values: val.pts, usingXY };
    });
    const maxLen = Math.max(0, ...series.map((s) => Math.max(s.categories.length, s.values.length)));
    const withCats = series.find((s) => s.categories.length);
    const catLabel = series[0] && series[0].usingXY ? "X" : "Categor\xEDa";
    const header = [catLabel, ...series.map((s) => s.name)];
    let table = "| " + header.map(escapeMdCell).join(" | ") + " |\n";
    table += "| " + header.map(() => "---").join(" | ") + " |\n";
    for (let i = 0; i < maxLen; i++) {
      const catPt = withCats ? withCats.categories.find((p) => p.idx === i) : null;
      const row = [catPt ? catPt.val : String(i + 1)];
      series.forEach((s) => {
        const p = s.values.find((pt) => pt.idx === i);
        row.push(p ? p.val : "");
      });
      table += "| " + row.map(escapeMdCell).join(" | ") + " |\n";
    }
    const sheetName = extractChartSheetName(series[0] && (series[0].catRef || series[0].valRef));
    return { typeLabel, title, table, sheetName };
  }
  async function extractChartsFromXlsx(buf, sheetNames) {
    const result = {};
    try {
      const zip = await JSZip.loadAsync(buf);
      const chartPaths = Object.keys(zip.files).filter((name) => /^xl\/charts\/chart\d+\.xml$/i.test(name));
      for (const path of chartPaths) {
        try {
          const xmlText = await zip.files[path].async("text");
          const xmlDoc = new DOMParser().parseFromString(xmlText, "application/xml");
          const info = parseChartXml(xmlDoc);
          if (!info) continue;
          const key = info.sheetName && sheetNames.includes(info.sheetName) ? info.sheetName : "__otros__";
          (result[key] = result[key] || []).push(info);
        } catch (e) {
          console.warn("No se pudo procesar el gr\xE1fico en " + path, e);
        }
      }
    } catch (e) {
      console.warn("No se pudieron leer los gr\xE1ficos del archivo Excel (\xBFes un .xls antiguo?)", e);
    }
    return result;
  }
  function appendChartsMarkdown(charts) {
    let md = "";
    charts.forEach((chart) => {
      const titlePart = chart.title ? ` - "${chart.title}"` : "";
      md += `

> \u{1F4CA} Datos de la gr\xE1fica: ${chart.typeLabel}${titlePart}

`;
      md += chart.table;
    });
    return md;
  }
  async function convertExcel(file, onProgress) {
    onProgress(5, "Leyendo libro de Excel...");
    const buf = await file.arrayBuffer();
    let workbook;
    try {
      workbook = XLSX.read(buf, { type: "array" });
    } catch (e) {
      throw new Error("No se pudo leer el archivo. \xBFSeguro que es un Excel v\xE1lido (.xlsx/.xls)?");
    }
    const isXlsx = /\.xlsx$/i.test(file.name);
    onProgress(20, "Buscando gr\xE1ficos...");
    const chartsBySheet = isXlsx ? await extractChartsFromXlsx(buf, workbook.SheetNames) : {};
    let md = "";
    const total = workbook.SheetNames.length;
    workbook.SheetNames.forEach((sheetName, idx) => {
      onProgress(20 + Math.round((idx + 1) / total * 70), `Procesando hoja "${sheetName}"...`);
      md += `

## Hoja: ${sheetName}

`;
      md += sheetToMarkdownTable(workbook.Sheets[sheetName]);
      md += appendChartsMarkdown(chartsBySheet[sheetName] || []);
    });
    if (chartsBySheet["__otros__"] && chartsBySheet["__otros__"].length) {
      md += "\n\n## Gr\xE1ficas adicionales\n";
      md += appendChartsMarkdown(chartsBySheet["__otros__"]);
    }
    return md.trim();
  }

  // src/converters/index.js
  var CONVERTERS = {
    pdf: {
      icon: "\u{1F4C4}",
      extensions: ["pdf"],
      accept: ".pdf,application/pdf",
      hint: "Haz clic o arrastra tu PDF aqu\xED",
      convert: convertPdf
    },
    docx: {
      icon: "\u{1F4DD}",
      extensions: ["docx"],
      accept: ".docx",
      hint: "Haz clic o arrastra tu documento Word (.docx) aqu\xED",
      convert: convertDocx
    },
    pptx: {
      icon: "\u{1F4CA}",
      extensions: ["pptx"],
      accept: ".pptx",
      hint: "Haz clic o arrastra tu presentaci\xF3n PowerPoint (.pptx) aqu\xED",
      convert: convertPptx
    },
    xlsx: {
      icon: "\u{1F4C8}",
      extensions: ["xlsx", "xls"],
      accept: ".xlsx,.xls",
      hint: "Haz clic o arrastra tu libro de Excel (.xlsx/.xls) aqu\xED",
      convert: convertExcel
    },
    image: {
      icon: "\u{1F5BC}\uFE0F",
      extensions: ["jpg", "jpeg", "png", "webp"],
      accept: ".jpg,.jpeg,.png,.webp,image/*",
      hint: "Haz clic o arrastra tu imagen (JPG, PNG, WEBP) aqu\xED",
      convert: convertImage
    }
  };
  function detectConverterId(filename) {
    const ext = filename.split(".").pop().toLowerCase();
    for (const [id, conv] of Object.entries(CONVERTERS)) {
      if (conv.extensions.includes(ext)) return id;
    }
    return null;
  }

  // src/main.js
  var tabs = document.querySelectorAll(".tab");
  var drop = document.getElementById("drop");
  var dropIcon = document.getElementById("drop-icon");
  var dropHint = document.getElementById("drop-hint");
  var fileInput = document.getElementById("file-input");
  var status = document.getElementById("status");
  var progressWrap = document.getElementById("progress-wrap");
  var progressBar = document.getElementById("progress-bar");
  var resultActions = document.getElementById("result-actions");
  var downloadBtn = document.getElementById("download-btn");
  var copyBtn = document.getElementById("copy-btn");
  var preview = document.getElementById("preview");
  var fragmentPanel = document.getElementById("fragment-panel");
  var fragmentMeta = document.getElementById("fragment-meta");
  var fragmentDisplay = document.getElementById("fragment-display");
  var fragmentPrevBtn = document.getElementById("fragment-prev-btn");
  var fragmentNextBtn = document.getElementById("fragment-next-btn");
  var fragmentCopyBtn = document.getElementById("fragment-copy-btn");
  var fragmentDownloadBtn = document.getElementById("fragment-download-btn");
  var FRAGMENT_WORD_LIMIT = 9e3;
  var markdownOut = "";
  var extraFiles = [];
  var fileBaseName = "documento";
  var currentTab = "pdf";
  var fragmentChunks = [];
  var fragmentIndex = 0;
  function splitMarkdownIntoFragments(text, maxWords = FRAGMENT_WORD_LIMIT) {
    const normalized = (text || "").trim();
    if (!normalized) return [""];
    const words = normalized.split(/\s+/);
    const chunks = [];
    let current = [];
    for (const word of words) {
      if (current.length >= maxWords) {
        chunks.push(current.join(" "));
        current = [];
      }
      current.push(word);
    }
    if (current.length) chunks.push(current.join(" "));
    return chunks.length ? chunks : [""];
  }
  function renderFragmentPanel() {
    if (!fragmentChunks.length) {
      fragmentPanel.style.display = "none";
      return;
    }
    const total = fragmentChunks.length;
    const current = fragmentChunks[fragmentIndex] || "";
    const wordCount = current.trim() ? current.trim().split(/\s+/).length : 0;
    fragmentMeta.textContent = `Fragmento ${fragmentIndex + 1} de ${total} \u2022 ${wordCount} palabras`;
    fragmentDisplay.textContent = current;
    fragmentPrevBtn.disabled = fragmentIndex === 0;
    fragmentNextBtn.textContent = fragmentIndex === total - 1 ? "\xDAltimo fragmento" : "Siguiente \u25B6";
    fragmentNextBtn.disabled = fragmentIndex === total - 1;
  }
  function resetResultUI() {
    resultActions.style.display = "none";
    preview.style.display = "none";
    preview.value = "";
    progressWrap.style.display = "none";
    progressBar.style.width = "0%";
    status.style.display = "none";
    status.classList.remove("error");
    status.textContent = "";
    markdownOut = "";
    extraFiles = [];
    downloadBtn.textContent = "\u2B07 Descargar .md";
    fragmentChunks = [];
    fragmentIndex = 0;
    fragmentPanel.style.display = "none";
    fragmentMeta.textContent = "0 fragmentos";
    fragmentDisplay.textContent = "";
  }
  function setActiveTab(id) {
    currentTab = id;
    tabs.forEach((btn) => btn.classList.toggle("active", btn.dataset.format === id));
    const conv = CONVERTERS[id];
    dropHint.textContent = conv.hint;
    dropIcon.textContent = conv.icon;
    fileInput.accept = conv.accept;
    resetResultUI();
  }
  tabs.forEach((btn) => btn.addEventListener("click", () => setActiveTab(btn.dataset.format)));
  drop.addEventListener("click", () => fileInput.click());
  drop.addEventListener("dragover", (e) => {
    e.preventDefault();
    drop.classList.add("dragover");
  });
  drop.addEventListener("dragleave", () => drop.classList.remove("dragover"));
  drop.addEventListener("drop", (e) => {
    e.preventDefault();
    drop.classList.remove("dragover");
    if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener("change", (e) => {
    if (e.target.files.length) handleFile(e.target.files[0]);
  });
  async function handleFile(file) {
    const detectedId = detectConverterId(file.name);
    if (!detectedId) {
      resetResultUI();
      status.style.display = "block";
      status.classList.add("error");
      status.textContent = `\u26A0\uFE0F No se reconoce el tipo de archivo "${file.name}". Formatos soportados: PDF, Word (.docx), PowerPoint (.pptx), Excel (.xlsx/.xls), Im\xE1genes (JPG/PNG/WEBP).`;
      return;
    }
    setActiveTab(detectedId);
    const converter = CONVERTERS[detectedId];
    fileBaseName = file.name.replace(/\.[^/.]+$/, "");
    progressWrap.style.display = "block";
    status.style.display = "block";
    status.textContent = "Preparando...";
    try {
      const result = await converter.convert(file, (pct, msg) => {
        progressBar.style.width = Math.min(100, Math.max(0, pct)) + "%";
        if (msg) status.textContent = msg;
      });
      const body = typeof result === "string" ? result : result.markdown;
      extraFiles = result && result.files || [];
      markdownOut = "# " + fileBaseName + "\n\n" + body;
      if (extraFiles.length) downloadBtn.textContent = `\u2B07 Descargar .zip (.md + ${extraFiles.length} figuras)`;
      fragmentChunks = splitMarkdownIntoFragments(markdownOut);
      fragmentIndex = 0;
      progressWrap.style.display = "none";
      status.textContent = "\u2705 Conversi\xF3n completada.";
      resultActions.style.display = "flex";
      preview.style.display = "block";
      preview.value = markdownOut;
      fragmentPanel.style.display = "block";
      renderFragmentPanel();
    } catch (err) {
      console.error(err);
      progressWrap.style.display = "none";
      status.classList.add("error");
      status.textContent = "\u26A0\uFE0F Ocurri\xF3 un error al procesar el archivo: " + (err && err.message ? err.message : String(err));
    }
  }
  function downloadMarkdown(text, filename) {
    downloadBlob(new Blob([text], { type: "text/markdown;charset=utf-8" }), filename);
  }
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1e3);
  }
  downloadBtn.addEventListener("click", async () => {
    if (!markdownOut) return;
    if (!extraFiles.length) {
      downloadMarkdown(markdownOut, fileBaseName + ".md");
      return;
    }
    const zip = new JSZip();
    zip.file(fileBaseName + ".md", markdownOut);
    extraFiles.forEach((f) => zip.file(f.path, f.blob));
    downloadBlob(await zip.generateAsync({ type: "blob" }), fileBaseName + ".zip");
  });
  fragmentDownloadBtn.addEventListener("click", () => {
    const currentFragment = fragmentChunks[fragmentIndex] || "";
    if (!currentFragment.trim()) return;
    const suffix = fragmentChunks.length > 1 ? `-parte-${fragmentIndex + 1}` : "";
    downloadMarkdown(currentFragment, fileBaseName + suffix + ".md");
  });
  copyBtn.addEventListener("click", async () => {
    await navigator.clipboard.writeText(markdownOut);
    copyBtn.textContent = "\u2713 Copiado";
    setTimeout(() => {
      copyBtn.textContent = "\u{1F4CB} Copiar texto";
    }, 1500);
  });
  fragmentPrevBtn.addEventListener("click", () => {
    if (fragmentIndex > 0) {
      fragmentIndex -= 1;
      renderFragmentPanel();
    }
  });
  fragmentNextBtn.addEventListener("click", () => {
    if (fragmentIndex < fragmentChunks.length - 1) {
      fragmentIndex += 1;
      renderFragmentPanel();
    }
  });
  fragmentCopyBtn.addEventListener("click", async () => {
    const currentFragment = fragmentChunks[fragmentIndex] || "";
    if (!currentFragment.trim()) return;
    await navigator.clipboard.writeText(currentFragment);
    fragmentCopyBtn.textContent = "\u2713 Fragmento copiado";
    setTimeout(() => {
      fragmentCopyBtn.textContent = "\u{1F4CB} Copiar fragmento";
    }, 1500);
  });
})();
//# sourceMappingURL=app.js.map
