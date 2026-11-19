// RN-009 #1. A ordem de declaração é a ordem das seções no boletim.
export enum SecaoBoletim {
  Cabecalho = 'cabecalho',
  Meteorologia = 'meteorologia',
  Rios = 'rios',
  RiscosSaude = 'riscos_saude',
  AcoesAbrigos = 'acoes_abrigos',
  Contatos = 'contatos',
}

export const ORDEM_SECOES: readonly SecaoBoletim[] =
  Object.values(SecaoBoletim);
