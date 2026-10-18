/* PowerPoint (.pptx): títulos, viñetas y notas del presentador de cada diapositiva. */

export function extractSlideNumber(path) {
  const m = path.match(/(\d+)\.xml$/);
  return m ? parseInt(m[1], 10) : 0;
}

export function parseSlideShapes(slideDoc) {
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

export function parseNotesText(notesDoc) {
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

export async function convertPptx(file, onProgress) {
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
