/* Conversor de PDF: orquesta la extracción página por página. */

import { attachFigures, findFigures, renderFigureImages } from './figures.js';
import { loadPdfFontNames } from './fonts.js';
import { droppedChars } from './latex.js';
import { blocksToMarkdown, removeRunningHeaders, renderPdfBlocks } from './layout.js';
import { absorbSatellites, attachOverArrows, bodyFontSize, buildPdfLines, reunifyLines } from './lines.js';
import { joinHyphenatedLines, piecesToWords } from './words.js';

// En el navegador; en Node (tests) pdf.js usa su propio worker.
if (typeof window !== 'undefined') pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

export async function convertPdf(file, onProgress) {
  onProgress(5, 'Cargando PDF...');
  Object.keys(droppedChars).forEach(k => delete droppedChars[k]);
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf, disableFontFace: true }).promise;
  const total = pdf.numPages;
  const pages = [];
  const files = [];

  for (let i = 1; i <= total; i++) {
    onProgress(5 + Math.round((i / total) * 85), `Extrayendo página ${i} de ${total}...`);
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    let opList = null;
    try { opList = await page.getOperatorList(); } catch (e) { /* sin figuras ni nombres de fuente */ }
    const fontNameOf = await loadPdfFontNames(page, content.items);

    const rawLines = buildPdfLines(content.items, fontNameOf);
    attachOverArrows(rawLines);
    const lines = reunifyLines(rawLines);
    lines.forEach(ln => { ln.words = piecesToWords(ln.pieces); });
    joinHyphenatedLines(lines);

    const bodyFs = bodyFontSize(lines);
    const figures = findFigures(opList, lines, bodyFs);
    // Primero los satélites (filas de vectores en línea), para que no se confundan con etiquetas de figuras.
    absorbSatellites(lines, bodyFs);
    attachFigures(lines, figures, i, bodyFs);
    try {
      await renderFigureImages(page, figures);
    } catch (e) {
      console.warn('No se pudo recortar una figura de la página ' + i, e);
    }
    figures.forEach(f => { if (f.blob) files.push({ path: f.name, blob: f.blob }); });

    pages.push({ number: i, lines, figures, height: page.view[3] - page.view[1] });
    page.cleanup();
  }

  onProgress(95, 'Armando párrafos y títulos...');
  removeRunningHeaders(pages);

  // Une el párrafo que sigue en la página siguiente ("...el sistema" | "lineal tiene...").
  const parts = [];
  pages.forEach(p => {
    const blocks = renderPdfBlocks(p.lines, p.figures);
    const prev = parts[parts.length - 1];
    const first = blocks[0];
    if (prev && prev.lastBlock && prev.lastBlock.type === 'p' && first && first.type === 'p' &&
        !/[.:!?]$/.test(prev.lastBlock.text) && /^[a-záéíóúñ$(]/.test(first.text)) {
      prev.lastBlock.text += ' ' + first.text;
      blocks.shift();
    }
    parts.push({ number: p.number, blocks, lastBlock: blocks[blocks.length - 1] || (prev && prev.lastBlock) });
  });

  const markdown = parts
    .map(p => `<!-- Página ${p.number} -->` + (p.blocks.length ? '\n\n' + blocksToMarkdown(p.blocks) : ''))
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (Object.keys(droppedChars).length) console.warn('Caracteres sin traducción a LaTeX (omitidos):', droppedChars);
  return files.length ? { markdown, files } : markdown;
}
