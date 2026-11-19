import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { normalizarBairro } from '@/modules/paineis/domain/normalizar-bairro';
import { IndicadorEpidemiologico } from '@/modules/paineis/enums/indicador-epidemiologico.enum';

// MOD-005: filtros do GET /indicadores.
export class IndicadoresQueryDto {
  /** Ano da semana epidemiológica; padrão: o último ano com dado */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Ano inválido' })
  @Min(2000, { message: 'Ano inválido' })
  @Max(2100, { message: 'Ano inválido' })
  ano?: number;

  @IsOptional()
  @IsEnum(IndicadorEpidemiologico, { message: 'Indicador inválido' })
  indicador?: IndicadorEpidemiologico;

  /** Bairro; ignora maiúsculas, acentos e espaços nas pontas */
  @IsOptional()
  @IsString({ message: 'Bairro inválido' })
  @MaxLength(80, { message: 'Bairro inválido' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizarBairro(value) : value,
  )
  @IsNotEmpty({ message: 'Bairro inválido' })
  bairro?: string;
}
