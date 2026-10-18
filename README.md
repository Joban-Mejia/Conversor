# Conversor Universal a Markdown

Convierte PDF, Word (.docx), PowerPoint (.pptx), Excel (.xlsx/.xls) e imágenes (OCR) a Markdown, todo en el navegador: el archivo nunca sale del equipo.

El conversor de PDF está pensado para documentos matemáticos hechos con LaTeX. Genera fórmulas en LaTeX válidas para KaTeX (`$...$` y `$$...$$`), incluidas matrices, vectores, fracciones y límites. También reconstruye párrafos y títulos, y recorta las figuras como PNG, con el texto que tienen dentro transcrito debajo.

## Uso

Abre `index.html` con doble clic. La página carga `dist/app.js`, que se genera desde `src/`:

```bash
npm install          # una vez
npm run build        # genera dist/app.js
npm run dev          # recompila solo al guardar cambios en src/ (recarga la página para verlos)
```

Si hay figuras, el botón de descarga entrega un `.zip` con el `.md` y la carpeta `figuras/`.

## Pruebas

```bash
npm test                                          # PDFs de prueba en tests/fixtures (LaTeX real)
LIBRO_PDF="ruta/al/libro.pdf" npm test            # además, un libro completo
npm run test:navegador -- ruta/al/archivo.pdf     # punta a punta en Edge/Chrome; guarda el .zip en tests/salida/
```

Los tests validan cada fórmula con KaTeX y comprueban casos concretos: figuras al costado del texto, `\vv{PQ}`, vectores en línea, `⟨ ⟩`, matrices y `≠`. Para agregar un caso nuevo, se escribe en `tests/fixtures/*.tex`, se compila con `pdflatex` y se agrega la comprobación en `tests/pdf.test.js`.

## Arquitectura

```
src/
  main.js                 interfaz: pestañas, carga, vista previa, fragmentos, descargas
  converters/
    index.js              registro de conversores (extensiones, accept, función)
    docx.js pptx.js xlsx.js image.js
    pdf/
      index.js            convertPdf: orquesta las etapas página por página
      fonts.js            nombres de fuentes y decodificación (CMEX, CMSY, MSBM, Symbol, Wingdings…)
      lines.js            renglones: línea base, índices, acentos, flechas \vv, satélites
      words.js            palabras: agrupación, clasificación texto/fórmula, LaTeX por palabra
      latex.js            tablas de símbolos y conversión a LaTeX (+ red de seguridad para KaTeX)
      inline.js           renglones de texto con fórmulas en línea (también las de dos alturas)
      equations.js        ecuaciones en bloque en 2D: fracciones, límites, flechas con etiqueta
      matrices.js         delimitadores altos, pmatrix/bmatrix/array/cases, ⋮ y ⋱
      figures.js          detección de figuras por operaciones de dibujo, etiquetas, pie, recorte
      layout.js           encabezados/pies repetidos, párrafos, títulos
tests/                    node:test + fixtures LaTeX; e2e/ con puppeteer
```

El flujo del PDF, por página: fragmentos de texto (pdf.js) → `fonts` → renglones (`lines`) → palabras (`words`) → figuras y satélites → bloques (`layout`: párrafos, títulos, `equations`/`matrices`, `inline`) → Markdown.

Las librerías (pdf.js, mammoth, turndown, JSZip, SheetJS, Tesseract) se cargan desde CDN en `index.html` y se usan como variables globales.

Para agregar un formato nuevo, se escribe `async function convertX(file, onProgress)` en `src/converters/`. Debe devolver el Markdown, o `{ markdown, files }` si además extrae archivos. Luego se registra en `src/converters/index.js`.
