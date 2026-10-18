/* Imágenes: OCR con Tesseract (español + inglés). */

export function traducirEstadoTesseract(status) {
  const map = {
    'loading tesseract core': 'Cargando motor OCR',
    'initializing tesseract': 'Inicializando OCR',
    'loading language traineddata': 'Cargando datos de idioma',
    'initializing api': 'Inicializando',
    'recognizing text': 'Reconociendo texto'
  };
  return map[status] || status;
}

export async function convertImage(file, onProgress) {
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
