/* Excel (.xlsx, .xls): hojas como tablas Markdown y datos de los gráficos. */

export const CHART_TYPE_LABELS = {
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

export function getEls(root, localName) {
  if (!root) return [];
  return Array.from(root.getElementsByTagName('*')).filter(el => el.localName === localName);
}

export function escapeMdCell(val) {
  if (val === undefined || val === null) return '';
  return String(val).replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>').trim();
}

export function sheetToMarkdownTable(ws) {
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

export function extractChartSheetName(ref) {
  if (!ref) return null;
  const m = ref.match(/^'?([^'!]+)'?!/);
  return m ? m[1] : null;
}

export function parseChartXml(xmlDoc) {
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

export async function extractChartsFromXlsx(buf, sheetNames) {
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

export function appendChartsMarkdown(charts) {
  let md = '';
  charts.forEach(chart => {
    const titlePart = chart.title ? ` - "${chart.title}"` : '';
    md += `\n\n> 📊 Datos de la gráfica: ${chart.typeLabel}${titlePart}\n\n`;
    md += chart.table;
  });
  return md;
}

export async function convertExcel(file, onProgress) {
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
