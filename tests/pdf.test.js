// Tests del conversor de PDF con PDFs reales generados con LaTeX (tests/fixtures/*.tex).
// Ejecutar: npm test
// Opcional, con el libro completo: LIBRO_PDF="ruta/al/LA-lecture_notes-spanish.pdf" npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { convertPdfFile, katexErrors } from './helpers.js';

const fixture = name => new URL(`./fixtures/${name}.pdf`, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

function assertKatexOk(md) {
  const { total, errors } = katexErrors(md);
  assert.ok(total > 0, 'no se encontró ninguna fórmula');
  assert.deepEqual(errors, [], `fórmulas que KaTeX no acepta:\n${errors.map(e => e.tex + '\n  ' + e.message).join('\n')}`);
}

test('básico: fórmulas en línea, ecuaciones numeradas, sumas, integrales y límites', async () => {
  const md = await convertPdfFile(fixture('basico'));
  assertKatexOk(md);
  assert.match(md, /### 1\. Introducción/);
  assert.match(md, /cumple que \$f \(x\) = x\^\{2\} \+ 2x - 1\$ para todo \$x \\in \\mathbb\{R\}\$/);
  assert.match(md, /¿Qué ocurre si \$\\alpha \\leq \\beta\$\? ¡Es importante!/);
  assert.ok(md.includes('$\\int ^{1}_{0} e^{-x^{2}} dx \\approx 0,7468$'));
  assert.ok(md.includes('\\sum_{i=1}^{n} a_{i} = \\frac{n(n + 1)}{2} \\tag{1}'));
  assert.ok(md.includes('\\lim_{x\\to 0} \\frac{\\sin x}{x} = 1'));
});

test('símbolos: caligráficas, pizarra, raíces, paréntesis grandes y límites de ∫ y ∏', async () => {
  const md = await convertPdfFile(fixture('simbolos'));
  assertKatexOk(md);
  assert.ok(md.includes('$\\mathcal{F}$'));
  assert.ok(md.includes('$\\mathbb{N}$'));
  assert.ok(md.includes('\\sqrt{\\frac{x + 1}{y}}'));
  assert.ok(md.includes('\\int_{0}^{\\infty} e^{-t} dt = 1 \\prod_{k=1}^{m} k = m!'));
  assert.ok(md.includes('\\$100'), 'el $ literal debe ir escapado');
});

test('libro: figuras, texto alrededor, flechas \\vv, vectores en línea, ⟨ ⟩ y matrices', async () => {
  const md = await convertPdfFile(fixture('libro'));
  assertKatexOk(md);
  // Figuras con su pie y el texto que tienen dentro (visible, no en un comentario).
  assert.ok(md.includes('](figuras/pagina-001-1.png)'));
  assert.ok(md.includes('](figuras/pagina-001-2.png)'));
  assert.match(md, /> \*\*Texto en la figura:\*\* .*\$L_\{1\}\$: \$y = 5 - x\$/);
  assert.ok(!/Texto en la figura:\*\*[^\n]*sus representaciones/.test(md), 'el pie de una figura no es etiqueta de otra');
  // El texto que rodea una figura al costado no se pierde.
  assert.ok(md.includes('Esta frase sigue al lado de la figura para comprobar que el texto que la rodea no se pierde'));
  assert.ok(md.includes('escribimos $\\overrightarrow{PQ}$ para el vector'));
  assert.ok(!md.includes('# –'), 'la flecha de \\vv no debe convertirse en un título');
  assert.ok(md.includes('$\\begin{pmatrix} p_{1} \\\\ p_{2} \\end{pmatrix}$'));
  assert.ok(md.includes('el vector cero $\\vec{0}$'));
  assert.ok(md.includes('$\\langle \\begin{pmatrix} 2 \\\\ 3 \\end{pmatrix} , \\begin{pmatrix} -1 \\\\ 5 \\end{pmatrix} \\rangle = 2 \\cdot (-1) + 3 \\cdot 5 = 13$'));
  assert.ok(md.includes('Si $\\beta \\neq 0$, entonces la recta tiene pendiente $- \\frac{\\alpha}{\\beta}$.'));
  assert.ok(md.includes('A = \\begin{pmatrix} a_{11} & a_{12} & \\cdots & a_{1n} \\\\ \\vdots & & & \\vdots \\\\ a_{m1} & a_{m2} & \\cdots & a_{mn} \\end{pmatrix}'));
  assert.ok(md.includes('$$\nx + 2y = 11,\n$$') && md.includes('$$\n3x + 4y = 27.\n$$'), 'cada fila del sistema, su ecuación');
});

const libro = process.env.LIBRO_PDF;
test('libro completo de Álgebra Lineal (opcional)', { skip: !libro || !fs.existsSync(libro) ? 'definir LIBRO_PDF' : false }, async () => {
  const md = await convertPdfFile(libro);
  assertKatexOk(md);
  assert.ok(md.includes('\\overrightarrow{PQ}'));
  assert.ok(md.includes('$\\langle \\begin{pmatrix} 2 \\\\ 3 \\end{pmatrix} , \\begin{pmatrix} -1 \\\\ 5 \\end{pmatrix} \\rangle'));
  assert.ok(md.includes('equivalente a $y = 60 - x$, que identificamos fácilmente'));
  assert.ok(!md.includes('# –'));
});
