import { MotivoEncerramento } from '@/modules/alertas/enums/motivo-encerramento.enum';
import { StatusAlerta } from '@/modules/alertas/enums/status-alerta.enum';
import { TipoAcaoManual } from '@/modules/alertas/enums/tipo-acao-manual.enum';

// RN-015 #8 (ck_alerta_acao_manual_motivo).
export const MOTIVO_MIN = 10;

// RN-015 #6.
export const PRORROGACAO_HORAS_MAX = 24;

const HORA_MS = 3_600_000;

export interface MudancaAlerta {
  status?: StatusAlerta;
  motivoEncerramento?: MotivoEncerramento;
  dthrEncerramento?: Date;
  prorrogadoAte?: Date;
}

const MOTIVO_POR_TIPO = {
  [TipoAcaoManual.Encerrar]: MotivoEncerramento.Manual,
  [TipoAcaoManual.Invalidar]: MotivoEncerramento.Invalidado,
} as const;

// O que cada ação manual muda no alerta (RN-015 #4 a #6). Prorrogar conta a
// partir de agora, mesmo que já houvesse prorrogação.
export function mudancaDaAcao(
  tipo: TipoAcaoManual,
  agora: Date,
  horas?: number,
): MudancaAlerta {
  if (tipo === TipoAcaoManual.Prorrogar) {
    if (horas === undefined) {
      throw new Error('Prorrogar exige o prazo em horas');
    }
    return { prorrogadoAte: new Date(agora.getTime() + horas * HORA_MS) };
  }
  return {
    status: StatusAlerta.Encerrado,
    motivoEncerramento: MOTIVO_POR_TIPO[tipo],
    dthrEncerramento: agora,
  };
}
