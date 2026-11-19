import { PeriodoPainel } from '@/modules/paineis/enums/periodo-painel.enum';

const HORA_MS = 60 * 60 * 1000;

const DURACAO_MS: Record<PeriodoPainel, number> = {
  [PeriodoPainel.Ultimas24Horas]: 24 * HORA_MS,
  [PeriodoPainel.Ultimos7Dias]: 7 * 24 * HORA_MS,
  [PeriodoPainel.Ultimos30Dias]: 30 * 24 * HORA_MS,
};

// Início da janela que termina agora (PR-018).
export function inicioDaJanela(periodo: PeriodoPainel, agora: Date): Date {
  return new Date(agora.getTime() - DURACAO_MS[periodo]);
}
