import { IndicadorEpidemiologico } from '@/modules/paineis/enums/indicador-epidemiologico.enum';

// Contrato do MOD-005 (DEC-011, DEC-031).
export class IndicadorResponseDto {
  territorio!: string;
  bairro!: string;
  indicador!: IndicadorEpidemiologico;
  /** Semana epidemiológica: 2025-SE01 */
  periodo!: string;
  /** Casos prováveis (DEC-031) */
  valor!: number;
  fonte!: string;
  /** Última atualização da fonte (RN-007); nula se a fonte não tem registro */
  fonte_atualizada_em!: Date | null;
}
