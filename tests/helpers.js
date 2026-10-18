// Utilidades de los tests: pdf.js en Node y validación de fórmulas con KaTeX.
import { createRequire } from 'node:module';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
globalThis.pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
const katex = require('katex');

const { convertPdf } = await import('../src/converters/pdf/index.js');

// Convierte un PDF y devuelve solo el Markdown (en Node no se recortan imágenes).
export async function convertPdfFile(path) {
  const data = fs.readFileSync(path);
  const file = { arrayBuffer: async () => new Uint8Array(data).buffer };
  const result = await convertPdf(file, () => {});
  return typeof result === 'string' ? result : result.markdown;
}

// Todas las fórmulas ($...$ y $$...$$) que KaTeX no puede procesar.
export function katexErrors(md) {
  const re = /\$\$\n([\s\S]*?)\n\$\$|(?<![\x5c])\$([^$\n]+?)(?<![\x5c])\$/g; // \x5c = barra invertida
  const errors = [];
  let total = 0;
  for (const m of md.matchAll(re)) {
    const tex = m[1] ?? m[2];
    total++;
    try {
      katex.renderToString(tex, { displayMode: !!m[1], throwOnError: true, strict: 'ignore' });
    } catch (e) {
      errors.push({ tex, message: e.message });
    }
  }
  return { total, errors };
}
