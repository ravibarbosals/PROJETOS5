import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { NivelAlerta } from '@/modules/alertas/enums/nivel-alerta.enum';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

// decimal(12,3) in the database (erd.md).
const LIMIAR_MAX = 999_999_999.999;

// ck_parametro_alerta_janela_horas.
export const JANELA_HORAS_MAX = 72;

export class CriarParametroAlertaDto {
  /** Variável de gold.leitura_climatica (DEC-009) */
  @Transform(trim)
  @IsString({ message: 'Variável inválida' })
  @IsNotEmpty({ message: 'Variável inválida' })
  @MaxLength(50, { message: 'Variável inválida' })
  variavel!: string;

  /** Identificador do território (granularidade: DUV-009) */
  @Transform(trim)
  @IsString({ message: 'Território inválido' })
  @IsNotEmpty({ message: 'Território inválido' })
  @MaxLength(50, { message: 'Território inválido' })
  territorio!: string;

  /** Dispara quando o valor fica maior ou igual a este (RN-012) */
  @IsNumber({ maxDecimalPlaces: 3 }, { message: 'Limiar obrigatório' })
  @Min(-LIMIAR_MAX, { message: 'Limiar fora do intervalo' })
  @Max(LIMIAR_MAX, { message: 'Limiar fora do intervalo' })
  limiar!: number;

  /** Encerra só abaixo deste valor; menor que o limiar (histerese, RN-015) */
  @IsNumber({ maxDecimalPlaces: 3 }, { message: 'Limiar de saída obrigatório' })
  @Min(-LIMIAR_MAX, { message: 'Limiar de saída fora do intervalo' })
  @Max(LIMIAR_MAX, { message: 'Limiar de saída fora do intervalo' })
  limiar_saida!: number;

  /** Horas somadas no acumulado da chuva (RN-012) */
  @IsInt({ message: 'Janela em horas inválida' })
  @Min(1, { message: 'Janela em horas inválida' })
  @Max(JANELA_HORAS_MAX, { message: 'Janela em horas inválida' })
  janela_horas!: number;

  @IsEnum(NivelAlerta, { message: 'Nível inválido' })
  nivel!: NivelAlerta;
}
