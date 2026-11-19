import { Type } from 'class-transformer';
import { IsDate } from 'class-validator';
import { UnprocessableEntityException } from '@nestjs/common';

// Filtro de período comum às consultas do MOD-003 e do MOD-005 (PR-018). ISO
// 8601, UTC.
export class PeriodoQueryDto {
  /** Início do período (ISO 8601) */
  @Type(() => Date)
  @IsDate({ message: 'Informe o início do período (data ISO 8601)' })
  inicio!: Date;

  /** Fim do período (ISO 8601) */
  @Type(() => Date)
  @IsDate({ message: 'Informe o fim do período (data ISO 8601)' })
  fim!: Date;
}

export const PERIODO_INVERTIDO_MESSAGE =
  'O início do período precisa ser anterior ao fim';

// Validação entre campos fora do DTO, para toda mensagem continuar sendo 422
// (DEC-010).
export function validarPeriodo({ inicio, fim }: PeriodoQueryDto) {
  if (inicio.getTime() > fim.getTime()) {
    throw new UnprocessableEntityException(PERIODO_INVERTIDO_MESSAGE);
  }
}
