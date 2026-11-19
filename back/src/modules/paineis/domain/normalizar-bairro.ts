// O gold guarda o bairro como o SINAN: maiúsculas e sem acento (DEC-031).
// Assim "Água  Fria " encontra "AGUA FRIA". \p{M} são os acentos que o
// normalize('NFD') separa da letra.
export function normalizarBairro(bairro: string): string {
  return bairro
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}
