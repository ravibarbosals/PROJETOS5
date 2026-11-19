import { Transform } from 'class-transformer';
import {
  IsInt,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  MOTIVO_MIN,
  PRORROGACAO_HORAS_MAX,
} from '@/modules/alertas/domain/acao-manual';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

// RN-015 #8: usuário e horário nunca são aceitos do cliente (não existem esses
// campos).
export class MotivoAlertaDto {
  /** Por que o alerta foi encerrado, invalidado ou prorrogado */
  @Transform(trim)
  @IsString({ message: `O motivo deve ter no mínimo ${MOTIVO_MIN} caracteres` })
  @MinLength(MOTIVO_MIN, {
    message: `O motivo deve ter no mínimo ${MOTIVO_MIN} caracteres`,
  })
  @MaxLength(2000)
  motivo!: string;
}

export class ProrrogarAlertaDto extends MotivoAlertaDto {
  /** Horas a partir de agora em que o job não encerra o alerta (RN-015 #6) */
  @IsInt({ message: 'Prazo inválido' })
  @Min(1, { message: 'Prazo inválido' })
  @Max(PRORROGACAO_HORAS_MAX, { message: 'Prazo inválido' })
  horas!: number;
}
