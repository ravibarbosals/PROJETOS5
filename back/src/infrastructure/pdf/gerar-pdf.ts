import pdfmake from 'pdfmake';
import type { TDocumentDefinitions } from 'pdfmake/interfaces';

// DEC-019. Fontes padrão do PDF (nenhum arquivo de fonte para distribuir). Elas
// cobrem os acentos do português (codificação WinAnsi).
const FONTE_PADRAO = {
  normal: 'Helvetica',
  bold: 'Helvetica-Bold',
  italics: 'Helvetica-Oblique',
  bolditalics: 'Helvetica-BoldOblique',
};
const FONTES_PERMITIDAS = new Set(Object.values(FONTE_PADRAO));

export const FONTE = 'Helvetica';

pdfmake.setFonts({ [FONTE]: FONTE_PADRAO });
// Nada num documento pode ler arquivo local nem URL (imagens, fontes): só os
// nomes de fonte padrão acima passam pela política local.
pdfmake.setLocalAccessPolicy((caminho) => FONTES_PERMITIDAS.has(caminho));
pdfmake.setUrlAccessPolicy(() => false);

export function gerarPdf(definicao: TDocumentDefinitions): Promise<Buffer> {
  return pdfmake.createPdf(definicao).getBuffer();
}
