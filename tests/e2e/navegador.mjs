// Prueba de punta a punta en un navegador real (Edge o Chrome instalados, sin ventana):
// sirve la página, sube un PDF, pulsa "Descargar" y guarda el .zip resultante.
// Uso: npm run test:navegador -- <archivo.pdf> [carpeta de salida]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const [pdfPath, outDir = path.join(root, 'tests', 'salida')] = process.argv.slice(2);
if (!pdfPath) {
  console.error('Uso: npm run test:navegador -- <archivo.pdf> [carpeta de salida]');
  process.exit(1);
}

const BROWSERS = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
];
const executablePath = BROWSERS.find(p => fs.existsSync(p));
if (!executablePath) throw new Error('No se encontró Edge ni Chrome instalados.');

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.map': 'application/json' };
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const file = path.join(root, url === '/' ? 'index.html' : url);
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(0);
const port = server.address().port;

const browser = await puppeteer.launch({ executablePath, headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`http://localhost:${port}/`, { waitUntil: 'networkidle0' });

  // Se intercepta la descarga: el enlace temporal apunta a un blob que se lee como base64.
  await page.evaluate(() => {
    window.__descarga = null;
    HTMLAnchorElement.prototype.click = function () {
      const name = this.download;
      fetch(this.href).then(r => r.blob()).then(b => new Promise(ok => {
        const fr = new FileReader();
        fr.onload = () => ok(fr.result.split(',')[1]);
        fr.readAsDataURL(b);
      })).then(data => { window.__descarga = { name, data }; });
    };
  });

  const t0 = Date.now();
  await (await page.$('#file-input')).uploadFile(path.resolve(pdfPath));
  await page.waitForFunction(() => /completada|error/i.test(document.getElementById('status').textContent), { timeout: 15 * 60 * 1000, polling: 1000 });
  const status = await page.$eval('#status', e => e.textContent);
  console.log(`${status}  (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  if (!/completada/i.test(status)) process.exitCode = 1;

  await page.click('#download-btn');
  await page.waitForFunction(() => window.__descarga, { timeout: 120000 });
  const { name, data } = await page.evaluate(() => window.__descarga);
  fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, name);
  fs.writeFileSync(out, Buffer.from(data, 'base64'));
  console.log('Guardado:', out);
  if (errors.length) { console.error('Errores en la página:', errors); process.exitCode = 1; }
} finally {
  await browser.close();
  server.close();
}
