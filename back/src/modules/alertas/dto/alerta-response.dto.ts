import { Alerta } from '@/modules/alertas/entities/alerta.entity';
import { StatusAlerta } from '@/modules/alertas/enums/status-alerta.enum';

class ParametroResumoDto {
  id!: number;
  variavel!: string;
  limiar!: number;
}

// Formato de um alerta na API (contrato do MOD-002, DEC-011). Os campos do
// parâmetro são a cópia feita no disparo, não os valores atuais do parâmetro.
export class AlertaResponseDto {
  id!: number;
  nivel!: string;
  parametro!: ParametroResumoDto;
  territorio!: string;
  valor_lido!: number;
  fonte!: string;
  lida_em!: Date;
  disparado_em!: Date;
  /** Última coleta bem-sucedida da fonte (RN-007); nula se a fonte nunca foi coletada */
  fonte_atualizada_em!: Date | null;
  status!: StatusAlerta;

  static from(
    alerta: Alerta,
    fonteAtualizadaEm: Date | null,
  ): AlertaResponseDto {
    return {
      id: alerta.id,
      nivel: alerta.nivel,
      parametro: {
        id: alerta.idParametroAlerta,
        variavel: alerta.variavel,
        limiar: alerta.limiar,
      },
      territorio: alerta.territorio,
      valor_lido: alerta.valorLido,
      fonte: alerta.fonte,
      lida_em: alerta.lidaEm,
      disparado_em: alerta.dthrDisparo,
      // RN-007 #2: nunca a hora atual quando a data da fonte é desconhecida.
      fonte_atualizada_em: fonteAtualizadaEm,
      status: alerta.status,
    };
  }
}
