/* Interfaz: pestañas, carga del archivo, vista previa, fragmentos y descargas. */

import { CONVERTERS, detectConverterId } from './converters/index.js';

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
const fragmentPanel = document.getElementById('fragment-panel');
const fragmentMeta = document.getElementById('fragment-meta');
const fragmentDisplay = document.getElementById('fragment-display');
const fragmentPrevBtn = document.getElementById('fragment-prev-btn');
const fragmentNextBtn = document.getElementById('fragment-next-btn');
const fragmentCopyBtn = document.getElementById('fragment-copy-btn');
const fragmentDownloadBtn = document.getElementById('fragment-download-btn');

const FRAGMENT_WORD_LIMIT = 9000;

let markdownOut = '';
let extraFiles = []; // figuras recortadas del PDF: { path, blob }
let fileBaseName = 'documento';
let currentTab = 'pdf';
let fragmentChunks = [];
let fragmentIndex = 0;

function splitMarkdownIntoFragments(text, maxWords = FRAGMENT_WORD_LIMIT) {
  const normalized = (text || '').trim();
  if (!normalized) return [''];

  const words = normalized.split(/\s+/);
  const chunks = [];
  let current = [];

  for (const word of words) {
    if (current.length >= maxWords) {
      chunks.push(current.join(' '));
      current = [];
    }
    current.push(word);
  }

  if (current.length) chunks.push(current.join(' '));
  return chunks.length ? chunks : [''];
}

function renderFragmentPanel() {
  if (!fragmentChunks.length) {
    fragmentPanel.style.display = 'none';
    return;
  }

  const total = fragmentChunks.length;
  const current = fragmentChunks[fragmentIndex] || '';
  const wordCount = current.trim() ? current.trim().split(/\s+/).length : 0;

  fragmentMeta.textContent = `Fragmento ${fragmentIndex + 1} de ${total} • ${wordCount} palabras`;
  fragmentDisplay.textContent = current;
  fragmentPrevBtn.disabled = fragmentIndex === 0;
  fragmentNextBtn.textContent = fragmentIndex === total - 1 ? 'Último fragmento' : 'Siguiente ▶';
  fragmentNextBtn.disabled = fragmentIndex === total - 1;
}

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
  extraFiles = [];
  downloadBtn.textContent = '⬇ Descargar .md';
  fragmentChunks = [];
  fragmentIndex = 0;
  fragmentPanel.style.display = 'none';
  fragmentMeta.textContent = '0 fragmentos';
  fragmentDisplay.textContent = '';
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
    status.textContent = `⚠\uFE0F No se reconoce el tipo de archivo "${file.name}". Formatos soportados: PDF, Word (.docx), PowerPoint (.pptx), Excel (.xlsx/.xls), Imágenes (JPG/PNG/WEBP).`;
    return;
  }

  setActiveTab(detectedId);
  const converter = CONVERTERS[detectedId];
  fileBaseName = file.name.replace(/\.[^/.]+$/, '');

  progressWrap.style.display = 'block';
  status.style.display = 'block';
  status.textContent = 'Preparando...';

  try {
    const result = await converter.convert(file, (pct, msg) => {
      progressBar.style.width = Math.min(100, Math.max(0, pct)) + '%';
      if (msg) status.textContent = msg;
    });
    // Los conversores devuelven el Markdown, o { markdown, files } si además extraen imágenes.
    const body = typeof result === 'string' ? result : result.markdown;
    extraFiles = (result && result.files) || [];

    markdownOut = '# ' + fileBaseName + '\n\n' + body;
    if (extraFiles.length) downloadBtn.textContent = `⬇ Descargar .zip (.md + ${extraFiles.length} figuras)`;
    fragmentChunks = splitMarkdownIntoFragments(markdownOut);
    fragmentIndex = 0;
    progressWrap.style.display = 'none';
    status.textContent = '✅ Conversión completada.';
    resultActions.style.display = 'flex';
    preview.style.display = 'block';
    preview.value = markdownOut;
    fragmentPanel.style.display = 'block';
    renderFragmentPanel();
  } catch (err) {
    console.error(err);
    progressWrap.style.display = 'none';
    status.classList.add('error');
    status.textContent = '⚠\uFE0F Ocurrió un error al procesar el archivo: ' + (err && err.message ? err.message : String(err));
  }
}

function downloadMarkdown(text, filename) {
  downloadBlob(new Blob([text], { type: 'text/markdown;charset=utf-8' }), filename);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revocar en diferido: hacerlo de inmediato cancela la descarga en algunos navegadores.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

downloadBtn.addEventListener('click', async () => {
  if (!markdownOut) return;
  if (!extraFiles.length) {
    downloadMarkdown(markdownOut, fileBaseName + '.md');
    return;
  }
  // .md + carpeta figuras/ (las rutas del Markdown son relativas a ella).
  const zip = new JSZip();
  zip.file(fileBaseName + '.md', markdownOut);
  extraFiles.forEach(f => zip.file(f.path, f.blob));
  downloadBlob(await zip.generateAsync({ type: 'blob' }), fileBaseName + '.zip');
});

fragmentDownloadBtn.addEventListener('click', () => {
  const currentFragment = fragmentChunks[fragmentIndex] || '';
  if (!currentFragment.trim()) return;
  const suffix = fragmentChunks.length > 1 ? `-parte-${fragmentIndex + 1}` : '';
  downloadMarkdown(currentFragment, fileBaseName + suffix + '.md');
});

copyBtn.addEventListener('click', async () => {
  await navigator.clipboard.writeText(markdownOut);
  copyBtn.textContent = '✓ Copiado';
  setTimeout(() => { copyBtn.textContent = '📋 Copiar texto'; }, 1500);
});

fragmentPrevBtn.addEventListener('click', () => {
  if (fragmentIndex > 0) {
    fragmentIndex -= 1;
    renderFragmentPanel();
  }
});

fragmentNextBtn.addEventListener('click', () => {
  if (fragmentIndex < fragmentChunks.length - 1) {
    fragmentIndex += 1;
    renderFragmentPanel();
  }
});

fragmentCopyBtn.addEventListener('click', async () => {
  const currentFragment = fragmentChunks[fragmentIndex] || '';
  if (!currentFragment.trim()) return;

  await navigator.clipboard.writeText(currentFragment);
  fragmentCopyBtn.textContent = '✓ Fragmento copiado';
  setTimeout(() => { fragmentCopyBtn.textContent = '📋 Copiar fragmento'; }, 1500);
});
