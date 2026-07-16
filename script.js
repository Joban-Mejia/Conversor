pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

const drop = document.getElementById('drop');
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
  if (file.type !== 'application/pdf') {
    status.style.display = 'block';
    status.textContent = 'Ese archivo no es un PDF.';
    return;
  }
  fileBaseName = file.name.replace(/\.pdf$/i, '');
  resultActions.style.display = 'none';
  preview.style.display = 'none';
  progressWrap.style.display = 'block';
  status.style.display = 'block';
  status.textContent = 'Cargando PDF...';

  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const total = pdf.numPages;
  let md = '';

  for (let i = 1; i <= total; i++) {
    status.textContent = 'Extrayendo página ' + i + ' de ' + total + '...';
    progressBar.style.width = Math.round((i / total) * 100) + '%';

    const page = await pdf.getPage(i);
    const content = await page.getTextContent();

    let lastY = null;
    let lineText = '';
    let pageLines = [];
    for (const item of content.items) {
      if (lastY !== null && Math.abs(item.transform[5] - lastY) > 2) {
        pageLines.push(lineText);
        lineText = '';
      }
      lineText += item.str + ' ';
      lastY = item.transform[5];
    }
    if (lineText.trim()) pageLines.push(lineText);

    md += '\n\n## Página ' + i + '\n\n' + pageLines.join('\n').trim();
  }

  markdownOut = '# ' + fileBaseName + '\n' + md;
  status.textContent = 'Listo: ' + total + ' páginas extraídas.';
  progressWrap.style.display = 'none';
  resultActions.style.display = 'flex';
  preview.style.display = 'block';
  preview.value = markdownOut;
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
