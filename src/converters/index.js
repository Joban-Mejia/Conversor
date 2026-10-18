/* Registro de conversores. Para agregar un formato:
     1. Escribe una función async convertX(file, onProgress) que devuelva el cuerpo en Markdown
        (sin el título H1), o { markdown, files } si además extrae archivos (p. ej. figuras).
     2. Regístrala aquí con sus extensiones y accept. */

import { convertDocx } from './docx.js';
import { convertImage } from './image.js';
import { convertPdf } from './pdf/index.js';
import { convertPptx } from './pptx.js';
import { convertExcel } from './xlsx.js';

export const CONVERTERS = {
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
    icon: '🖼\uFE0F', extensions: ['jpg', 'jpeg', 'png', 'webp'], accept: '.jpg,.jpeg,.png,.webp,image/*',
    hint: 'Haz clic o arrastra tu imagen (JPG, PNG, WEBP) aquí',
    convert: convertImage
  }
};

export function detectConverterId(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  for (const [id, conv] of Object.entries(CONVERTERS)) {
    if (conv.extensions.includes(ext)) return id;
  }
  return null;
}
