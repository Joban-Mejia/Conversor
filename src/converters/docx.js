/* Word (.docx): mammoth extrae HTML semántico y turndown lo pasa a Markdown. */

export async function convertDocx(file, onProgress) {
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
