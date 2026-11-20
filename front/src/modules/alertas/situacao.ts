import type { Alerta, MotivoEncerramento } from '@/modules/alertas/types'

// RN-015: como cada alerta terminou.
export const ROTULO_MOTIVO: Record<MotivoEncerramento, string> = {
  NORMALIZADO: 'Normalizado',
  EXPIRADO: 'Expirado (sem leitura)',
  MANUAL: 'Encerrado manualmente',
  INVALIDADO: 'Invalidado',
}

// Prorrogação ainda valendo no instante `agora` (RN-015 #6).
export function prorrogado(alerta: Alerta, agora: number): boolean {
  return (
    alerta.status === 'ATIVO' &&
    alerta.prorrogado_ate !== null &&
    new Date(alerta.prorrogado_ate).getTime() > agora
  )
}

// Texto curto da situação, para caber numa linha da lista.
export function rotuloSituacao(alerta: Alerta, agora: number): string {
  if (alerta.status === 'ATIVO') return prorrogado(alerta, agora) ? 'Ativo · prorrogado' : 'Ativo'
  return alerta.motivo_encerramento ? ROTULO_MOTIVO[alerta.motivo_encerramento] : 'Encerrado'
}
