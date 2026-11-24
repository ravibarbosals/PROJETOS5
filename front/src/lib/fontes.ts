// Nome da fonte para quem lê (REQ-019): o Open-Meteo é modelo, não estação;
// o Cemaden são pluviômetros (DEC-045).
const NOMES: Record<string, string> = {
  openmeteo: 'Open-Meteo (modelo meteorológico)',
  cemaden: 'Cemaden (pluviômetros)',
}

// Exigência de uso da plataforma do Cemaden (DEC-036): citar a fonte sempre
// que o dado aparece.
export const ATRIBUICAO_CEMADEN = 'DADOS DA REDE OBSERVACIONAL DO CEMADEN/MCTIC'

export function nomeDaFonte(fonte: string): string {
  return NOMES[fonte] ?? fonte
}

export function exigeAtribuicaoCemaden(fontes: readonly string[]): boolean {
  return fontes.includes('cemaden')
}
