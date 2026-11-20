import { Alerta } from '@/modules/alertas/entities/alerta.entity';
import { MotivoEncerramento } from '@/modules/alertas/enums/motivo-encerramento.enum';
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
  /** Primeira leitura, a que disparou o alerta */
  valor_lido!: number;
  /** Maior valor do incidente no parâmetro do alerta (RN-012 #4) */
  valor_maximo!: number;
  fonte!: string;
  lida_em!: Date;
  /** Leitura mais recente que manteve o alerta (RN-012 #4) */
  ultima_leitura_em!: Date;
  disparado_em!: Date;
  /** Quando subiu para ALTO; nulo se não escalonou (RN-012 #5) */
  escalonado_em!: Date | null;
  /** Última coleta bem-sucedida da fonte (RN-007); nula se a fonte nunca foi coletada */
  fonte_atualizada_em!: Date | null;
  status!: StatusAlerta;
  /** Até quando o job não encerra o alerta sozinho (RN-015 #6) */
  prorrogado_ate!: Date | null;
  encerrado_em!: Date | null;
  /** RN-015; nulo enquanto ativo */
  motivo_encerramento!: MotivoEncerramento | null;

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
      valor_maximo: alerta.valorMaximo,
      fonte: alerta.fonte,
      lida_em: alerta.lidaEm,
      ultima_leitura_em: alerta.ultimaLeituraEm,
      disparado_em: alerta.dthrDisparo,
      escalonado_em: alerta.dthrEscalonamento,
      // RN-007 #2: nunca a hora atual quando a data da fonte é desconhecida.
      fonte_atualizada_em: fonteAtualizadaEm,
      status: alerta.status,
      prorrogado_ate: alerta.prorrogadoAte,
      encerrado_em: alerta.dthrEncerramento,
      motivo_encerramento: alerta.motivoEncerramento,
    };
  }
}
