/* ============================================================
   Conversor Universal a Markdown
   100% client-side. Para agregar un nuevo formato:
     1. Escribe una función async convertX(file, onProgress) que
        devuelva el cuerpo en Markdown (sin el título H1 principal).
     2. Regístrala en CONVERTERS con sus extensiones y accept.
   ============================================================ */

pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

/* ---------------------- 1. PDF ---------------------- */

async function convertPdf(file, onProgress) {
  onProgress(5, 'Cargando PDF...');
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const total = pdf.numPages;
  let md = '';

  for (let i = 1; i <= total; i++) {
    onProgress(5 + Math.round((i / total) * 90), `Extrayendo página ${i} de ${total}...`);
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();

    let lastY = null;
    let lineText = '';
    const pageLines = [];
    for (const item of content.items) {
      if (lastY !== null && Math.abs(item.transform[5] - lastY) > 2) {
        pageLines.push(lineText);
        lineText = '';
      }
      lineText += item.str + ' ';
      lastY = item.transform[5];
    }
    if (lineText.trim()) pageLines.push(lineText);

    md += `\n\n## Página ${i}\n\n` + pageLines.join('\n').trim();
  }

  return md.trim();
}

/* ---------------------- 2. Word (.docx) ---------------------- */

async function convertDocx(file, onProgress) {
  onProgress(10, 'Leyendo documento Word...');
  const buf = await file.arrayBuffer();

  onProgress(35, 'Extrayendo contenido...');
  const { value: html, messages } = await mammoth.convertToHtml({ arrayBuffer: buf });
  if (messages && messages.length) console.warn('Mammoth:', messages);

  onProgress(70, 'Convirtiendo a Markdown...');
  const turndownService = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
  if (window.turndownPluginGfm) turndownService.use(turndownPluginGfm.gfm);
  const markdown = turndownService.turndown(html);

  return markdown.trim();
}

/* ---------------------- 3. PowerPoint (.pptx) ---------------------- */

function extractSlideNumber(path) {
  const m = path.match(/(\d+)\.xml$/);
  return m ? parseInt(m[1], 10) : 0;
}

function parseSlideShapes(slideDoc) {
  let title = '';
  const bullets = [];
  const shapes = Array.from(slideDoc.getElementsByTagName('p:sp'));

  shapes.forEach(sp => {
    const ph = sp.getElementsByTagName('p:ph')[0];
    const phType = ph ? ph.getAttribute('type') : null;
    const txBody = sp.getElementsByTagName('p:txBody')[0];
    if (!txBody) return;

    const paraTexts = Array.from(txBody.getElementsByTagName('a:p'))
      .map(p => Array.from(p.getElementsByTagName('a:t')).map(r => r.textContent).join(''))
      .filter(t => t.trim() !== '');

    if (phType === 'title' || phType === 'ctrTitle') {
      title = paraTexts.join(' ');
    } else {
      bullets.push(...paraTexts);
    }
  });

  return { title, bullets };
}

function parseNotesText(notesDoc) {
  const shapes = Array.from(notesDoc.getElementsByTagName('p:sp'));
  const lines = [];

  shapes.forEach(sp => {
    const ph = sp.getElementsByTagName('p:ph')[0];
    const phType = ph ? ph.getAttribute('type') : null;
    if (phType && phType !== 'body') return; // omite número de slide, fecha, etc.
    const txBody = sp.getElementsByTagName('p:txBody')[0];
    if (!txBody) return;

    Array.from(txBody.getElementsByTagName('a:p')).forEach(p => {
      const text = Array.from(p.getElementsByTagName('a:t')).map(r => r.textContent).join('');
      if (text.trim()) lines.push(text);
    });
  });

  return lines.join('\n');
}

async function convertPptx(file, onProgress) {
  onProgress(5, 'Leyendo PowerPoint...');
  const buf = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buf);

  const presFile = zip.file('ppt/presentation.xml');
  const relsFile = zip.file('ppt/_rels/presentation.xml.rels');
  if (!presFile || !relsFile) {
    throw new Error('El archivo no parece ser un .pptx válido.');
  }

  const presDoc = new DOMParser().parseFromString(await presFile.async('text'), 'application/xml');
  const relsDoc = new DOMParser().parseFromString(await relsFile.async('text'), 'application/xml');

  const relMap = {};
  Array.from(relsDoc.getElementsByTagName('Relationship')).forEach(r => {
    relMap[r.getAttribute('Id')] = r.getAttribute('Target');
  });

  let slidePaths = Array.from(presDoc.getElementsByTagName('p:sldId'))
    .map(s => relMap[s.getAttribute('r:id')])
    .filter(Boolean)
    .map(target => {
      target = target.replace(/^\.?\//, '');
      return target.startsWith('ppt/') ? target : 'ppt/' + target;
    });

  if (!slidePaths.length) {
    slidePaths = Object.keys(zip.files)
      .filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n))
      .sort((a, b) => extractSlideNumber(a) - extractSlideNumber(b));
  }

  const total = slidePaths.length;
  let md = '';

  for (let i = 0; i < total; i++) {
    onProgress(5 + Math.round(((i + 1) / total) * 90), `Procesando slide ${i + 1} de ${total}...`);
    const path = slidePaths[i];
    const slideDoc = new DOMParser().parseFromString(await zip.file(path).async('text'), 'application/xml');
    const { title, bullets } = parseSlideShapes(slideDoc);

    md += `\n\n## Slide ${i + 1}\n\n`;
    if (title) md += `### ${title}\n\n`;
    bullets.forEach(b => { md += `- ${b}\n`; });

    const slideFileName = path.split('/').pop();
    const relsPath = `ppt/slides/_rels/${slideFileName}.rels`;
    const slideRelsFile = zip.file(relsPath);
    if (slideRelsFile) {
      const slideRelsDoc = new DOMParser().parseFromString(await slideRelsFile.async('text'), 'application/xml');
      const noteRel = Array.from(slideRelsDoc.getElementsByTagName('Relationship'))
        .find(r => (r.getAttribute('Type') || '').includes('notesSlide'));

      if (noteRel) {
        const notesPath = noteRel.getAttribute('Target').replace('../', 'ppt/');
        const notesFile = zip.file(notesPath);
        if (notesFile) {
          const notesDoc = new DOMParser().parseFromString(await notesFile.async('text'), 'application/xml');
          const notesText = parseNotesText(notesDoc).trim();
          if (notesText) md += `\n**Notas del presentador:**\n${notesText}\n`;
        }
      }
    }
  }

  return md.trim();
}

/* ---------------------- 4. Excel (.xlsx, .xls) ---------------------- */

const CHART_TYPE_LABELS = {
  barChart: 'Gráfico de barras', bar3DChart: 'Gráfico de barras 3D',
  lineChart: 'Gráfico de líneas', line3DChart: 'Gráfico de líneas 3D',
  pieChart: 'Gráfico circular', pie3DChart: 'Gráfico circular 3D',
  ofPieChart: 'Gráfico circular compuesto',
  doughnutChart: 'Gráfico de anillos',
  areaChart: 'Gráfico de área', area3DChart: 'Gráfico de área 3D',
  scatterChart: 'Gráfico de dispersión',
  bubbleChart: 'Gráfico de burbujas',
  radarChart: 'Gráfico de radar',
  stockChart: 'Gráfico de cotizaciones',
  surfaceChart: 'Gráfico de superficie', surface3DChart: 'Gráfico de superficie 3D'
};

function getEls(root, localName) {
  if (!root) return [];
  return Array.from(root.getElementsByTagName('*')).filter(el => el.localName === localName);
}

function escapeMdCell(val) {
  if (val === undefined || val === null) return '';
  return String(val).replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>').trim();
}

function sheetToMarkdownTable(ws) {
  if (!ws || !ws['!ref']) return '_Hoja vacía._\n';

  const range = XLSX.utils.decode_range(ws['!ref']);
  const grid = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    const row = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      let val = '';
      if (cell) {
        val = (cell.w !== undefined && cell.w !== '') ? cell.w : (cell.v !== undefined ? cell.v : '');
      }
      row.push(val);
    }
    grid.push(row);
  }

  // Celdas combinadas: se repite el valor de la celda superior-izquierda en todo el rango.
  (ws['!merges'] || []).forEach(m => {
    const topVal = grid[m.s.r - range.s.r][m.s.c - range.s.c];
    for (let r = m.s.r; r <= m.e.r; r++) {
      for (let c = m.s.c; c <= m.e.c; c++) {
        grid[r - range.s.r][c - range.s.c] = topVal;
      }
    }
  });

  if (!grid.length) return '_Hoja vacía._\n';

  const header = grid[0].map(escapeMdCell);
  const numCols = header.length;
  let md = '| ' + header.map(h => h || ' ').join(' | ') + ' |\n';
  md += '| ' + header.map(() => '---').join(' | ') + ' |\n';
  for (let i = 1; i < grid.length; i++) {
    const row = grid[i];
    md += '| ' + Array.from({ length: numCols }, (_, ci) => escapeMdCell(row[ci])).join(' | ') + ' |\n';
  }
  return md;
}

function extractChartSheetName(ref) {
  if (!ref) return null;
  const m = ref.match(/^'?([^'!]+)'?!/);
  return m ? m[1] : null;
}

function parseChartXml(xmlDoc) {
  const plotArea = getEls(xmlDoc, 'plotArea')[0];
  if (!plotArea) return null;

  const chartTypeEl = Array.from(plotArea.children).find(el => /Chart$/.test(el.localName));
  const chartType = chartTypeEl ? chartTypeEl.localName : null;
  const typeLabel = CHART_TYPE_LABELS[chartType] || 'Gráfico';

  let title = '';
  const titleEl = getEls(xmlDoc, 'title')[0];
  if (titleEl) {
    const strCache = getEls(titleEl, 'strCache')[0];
    if (strCache) {
      title = getEls(strCache, 'pt').map(p => (getEls(p, 'v')[0] || {}).textContent || '').join(' ');
    } else {
      const runs = getEls(titleEl, 'r');
      if (runs.length) title = runs.map(r => (getEls(r, 't')[0] || {}).textContent || '').join('');
    }
  }

  const serEls = chartTypeEl ? getEls(chartTypeEl, 'ser') : [];
  if (!serEls.length) return null;

  const readRef = (refEl) => {
    if (!refEl) return { ref: '', pts: [] };
    const f = getEls(refEl, 'f')[0];
    const ref = f ? f.textContent : '';
    const cache = getEls(refEl, 'strCache')[0] || getEls(refEl, 'numCache')[0];
    const pts = cache ? getEls(cache, 'pt').map(p => ({
      idx: parseInt(p.getAttribute('idx'), 10),
      val: (getEls(p, 'v')[0] || {}).textContent || ''
    })) : [];
    return { ref, pts };
  };

  const series = serEls.map((ser, i) => {
    const txV = getEls(getEls(ser, 'tx')[0], 'v')[0];
    const name = (txV && txV.textContent) || ('Serie ' + (i + 1));

    let catEl = getEls(ser, 'cat')[0];
    let valEl = getEls(ser, 'val')[0];
    let usingXY = false;
    if (!catEl && !valEl) {
      catEl = getEls(ser, 'xVal')[0];
      valEl = getEls(ser, 'yVal')[0];
      usingXY = true;
    }

    const cat = readRef(catEl);
    const val = readRef(valEl);
    return { name, catRef: cat.ref, categories: cat.pts, valRef: val.ref, values: val.pts, usingXY };
  });

  const maxLen = Math.max(0, ...series.map(s => Math.max(s.categories.length, s.values.length)));
  const withCats = series.find(s => s.categories.length);
  const catLabel = series[0] && series[0].usingXY ? 'X' : 'Categoría';

  const header = [catLabel, ...series.map(s => s.name)];
  let table = '| ' + header.map(escapeMdCell).join(' | ') + ' |\n';
  table += '| ' + header.map(() => '---').join(' | ') + ' |\n';
  for (let i = 0; i < maxLen; i++) {
    const catPt = withCats ? withCats.categories.find(p => p.idx === i) : null;
    const row = [catPt ? catPt.val : String(i + 1)];
    series.forEach(s => {
      const p = s.values.find(pt => pt.idx === i);
      row.push(p ? p.val : '');
    });
    table += '| ' + row.map(escapeMdCell).join(' | ') + ' |\n';
  }

  const sheetName = extractChartSheetName(series[0] && (series[0].catRef || series[0].valRef));
  return { typeLabel, title, table, sheetName };
}

async function extractChartsFromXlsx(buf, sheetNames) {
  const result = {};
  try {
    const zip = await JSZip.loadAsync(buf);
    const chartPaths = Object.keys(zip.files).filter(name => /^xl\/charts\/chart\d+\.xml$/i.test(name));

    for (const path of chartPaths) {
      try {
        const xmlText = await zip.files[path].async('text');
        const xmlDoc = new DOMParser().parseFromString(xmlText, 'application/xml');
        const info = parseChartXml(xmlDoc);
        if (!info) continue;
        const key = (info.sheetName && sheetNames.includes(info.sheetName)) ? info.sheetName : '__otros__';
        (result[key] = result[key] || []).push(info);
      } catch (e) {
        console.warn('No se pudo procesar el gráfico en ' + path, e);
      }
    }
  } catch (e) {
    console.warn('No se pudieron leer los gráficos del archivo Excel (¿es un .xls antiguo?)', e);
  }
  return result;
}

function appendChartsMarkdown(charts) {
  let md = '';
  charts.forEach(chart => {
    const titlePart = chart.title ? ` - "${chart.title}"` : '';
    md += `\n\n> 📊 Datos de la gráfica: ${chart.typeLabel}${titlePart}\n\n`;
    md += chart.table;
  });
  return md;
}

async function convertExcel(file, onProgress) {
  onProgress(5, 'Leyendo libro de Excel...');
  const buf = await file.arrayBuffer();

  let workbook;
  try {
    workbook = XLSX.read(buf, { type: 'array' });
  } catch (e) {
    throw new Error('No se pudo leer el archivo. ¿Seguro que es un Excel válido (.xlsx/.xls)?');
  }

  const isXlsx = /\.xlsx$/i.test(file.name);
  onProgress(20, 'Buscando gráficos...');
  const chartsBySheet = isXlsx ? await extractChartsFromXlsx(buf, workbook.SheetNames) : {};

  let md = '';
  const total = workbook.SheetNames.length;

  workbook.SheetNames.forEach((sheetName, idx) => {
    onProgress(20 + Math.round(((idx + 1) / total) * 70), `Procesando hoja "${sheetName}"...`);
    md += `\n\n## Hoja: ${sheetName}\n\n`;
    md += sheetToMarkdownTable(workbook.Sheets[sheetName]);
    md += appendChartsMarkdown(chartsBySheet[sheetName] || []);
  });

  if (chartsBySheet['__otros__'] && chartsBySheet['__otros__'].length) {
    md += '\n\n## Gráficas adicionales\n';
    md += appendChartsMarkdown(chartsBySheet['__otros__']);
  }

  return md.trim();
}

/* ---------------------- 5. Imágenes (OCR) ---------------------- */

function traducirEstadoTesseract(status) {
  const map = {
    'loading tesseract core': 'Cargando motor OCR',
    'initializing tesseract': 'Inicializando OCR',
    'loading language traineddata': 'Cargando datos de idioma',
    'initializing api': 'Inicializando',
    'recognizing text': 'Reconociendo texto'
  };
  return map[status] || status;
}

async function convertImage(file, onProgress) {
  onProgress(5, 'Preparando OCR (español + inglés)...');
  const { data } = await Tesseract.recognize(file, 'spa+eng', {
    logger: m => {
      if (m.status && typeof m.progress === 'number') {
        onProgress(5 + Math.round(m.progress * 90), traducirEstadoTesseract(m.status) + '...');
      }
    }
  });
  return (data && data.text ? data.text : '').trim();
}

/* ---------------------- Registro de conversores ---------------------- */

const CONVERTERS = {
  pdf: {
    icon: '📄', extensions: ['pdf'], accept: '.pdf,application/pdf',
    hint: 'Haz clic o arrastra tu PDF aquí',
    convert: convertPdf
  },
  docx: {
    icon: '📝', extensions: ['docx'], accept: '.docx',
    hint: 'Haz clic o arrastra tu documento Word (.docx) aquí',
    convert: convertDocx
  },
  pptx: {
    icon: '📊', extensions: ['pptx'], accept: '.pptx',
    hint: 'Haz clic o arrastra tu presentación PowerPoint (.pptx) aquí',
    convert: convertPptx
  },
  xlsx: {
    icon: '📈', extensions: ['xlsx', 'xls'], accept: '.xlsx,.xls',
    hint: 'Haz clic o arrastra tu libro de Excel (.xlsx/.xls) aquí',
    convert: convertExcel
  },
  image: {
    icon: '🖼️', extensions: ['jpg', 'jpeg', 'png', 'webp'], accept: '.jpg,.jpeg,.png,.webp,image/*',
    hint: 'Haz clic o arrastra tu imagen (JPG, PNG, WEBP) aquí',
    convert: convertImage
  }
};

function detectConverterId(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  for (const [id, conv] of Object.entries(CONVERTERS)) {
    if (conv.extensions.includes(ext)) return id;
  }
  return null;
}

/* ---------------------- UI ---------------------- */

const tabs = document.querySelectorAll('.tab');
const drop = document.getElementById('drop');
const dropIcon = document.getElementById('drop-icon');
const dropHint = document.getElementById('drop-hint');
const fileInput = document.getElementById('file-input');
const status = document.getElementById('status');
const progressWrap = document.getElementById('progress-wrap');
const progressBar = document.getElementById('progress-bar');
const resultActions = document.getElementById('result-actions');
const downloadBtn = document.getElementById('download-btn');
const copyBtn = document.getElementById('copy-btn');
const preview = document.getElementById('preview');

let markdownOut = '';
let fileBaseName = 'documento';
let currentTab = 'pdf';

function resetResultUI() {
  resultActions.style.display = 'none';
  preview.style.display = 'none';
  preview.value = '';
  progressWrap.style.display = 'none';
  progressBar.style.width = '0%';
  status.style.display = 'none';
  status.classList.remove('error');
  status.textContent = '';
  markdownOut = '';
}

function setActiveTab(id) {
  currentTab = id;
  tabs.forEach(btn => btn.classList.toggle('active', btn.dataset.format === id));
  const conv = CONVERTERS[id];
  dropHint.textContent = conv.hint;
  dropIcon.textContent = conv.icon;
  fileInput.accept = conv.accept;
  resetResultUI();
}

tabs.forEach(btn => btn.addEventListener('click', () => setActiveTab(btn.dataset.format)));

drop.addEventListener('click', () => fileInput.click());
drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('dragover'); });
drop.addEventListener('dragleave', () => drop.classList.remove('dragover'));
drop.addEventListener('drop', e => {
  e.preventDefault();
  drop.classList.remove('dragover');
  if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', e => {
  if (e.target.files.length) handleFile(e.target.files[0]);
});

async function handleFile(file) {
  const detectedId = detectConverterId(file.name);

  if (!detectedId) {
    resetResultUI();
    status.style.display = 'block';
    status.classList.add('error');
    status.textContent = `⚠️ No se reconoce el tipo de archivo "${file.name}". Formatos soportados: PDF, Word (.docx), PowerPoint (.pptx), Excel (.xlsx/.xls), Imágenes (JPG/PNG/WEBP).`;
    return;
  }

  setActiveTab(detectedId);
  const converter = CONVERTERS[detectedId];
  fileBaseName = file.name.replace(/\.[^/.]+$/, '');

  progressWrap.style.display = 'block';
  status.style.display = 'block';
  status.textContent = 'Preparando...';

  try {
    const body = await converter.convert(file, (pct, msg) => {
      progressBar.style.width = Math.min(100, Math.max(0, pct)) + '%';
      if (msg) status.textContent = msg;
    });

    markdownOut = '# ' + fileBaseName + '\n\n' + body;
    progressWrap.style.display = 'none';
    status.textContent = '✅ Conversión completada.';
    resultActions.style.display = 'flex';
    preview.style.display = 'block';
    preview.value = markdownOut;
  } catch (err) {
    console.error(err);
    progressWrap.style.display = 'none';
    status.classList.add('error');
    status.textContent = '⚠️ Ocurrió un error al procesar el archivo: ' + (err && err.message ? err.message : String(err));
  }
}

downloadBtn.addEventListener('click', () => {
  const blob = new Blob([markdownOut], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileBaseName + '.md';
  a.click();
  URL.revokeObjectURL(url);
});

copyBtn.addEventListener('click', async () => {
  await navigator.clipboard.writeText(markdownOut);
  copyBtn.textContent = '✓ Copiado';
  setTimeout(() => { copyBtn.textContent = '📋 Copiar texto'; }, 1500);
});
