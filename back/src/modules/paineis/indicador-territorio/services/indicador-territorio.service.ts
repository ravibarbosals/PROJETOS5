import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { IndicadorResponseDto } from '@/modules/paineis/indicador-territorio/dto/indicador-response.dto';
import { IndicadoresQueryDto } from '@/modules/paineis/indicador-territorio/dto/indicadores-query.dto';

// Só leitura sobre o schema gold, gravado pela pipeline (PR-007, DEC-031).
@Injectable()
export class IndicadorTerritorioService {
  constructor(private readonly dataSource: DataSource) {}

  async listar(filtros: IndicadoresQueryDto): Promise<IndicadorResponseDto[]> {
    const ano = filtros.ano ?? (await this.ultimoAno(filtros));
    if (ano === null) return [];

    return this.dataSource.query<IndicadorResponseDto[]>(
      `SELECT i.territorio, i.bairro, i.indicador, i.periodo, i.valor, i.fonte,
              s.ultima_atualizacao AS fonte_atualizada_em
       FROM gold.indicador_territorio i
       LEFT JOIN gold.fonte_status s ON s.fonte = i.fonte
       WHERE i.periodo LIKE $1
         AND ($2::text IS NULL OR i.indicador = $2)
         AND ($3::text IS NULL OR i.bairro = $3)
       ORDER BY i.periodo, i.indicador, i.bairro`,
      [`${ano}-SE%`, filtros.indicador ?? null, filtros.bairro ?? null],
    );
  }

  // O portal publica com atraso (DEC-031): sem ano, vale o último que existe
  private async ultimoAno(
    filtros: IndicadoresQueryDto,
  ): Promise<number | null> {
    const [{ ano }] = await this.dataSource.query<{ ano: number | null }[]>(
      `SELECT max(left(periodo, 4))::int AS ano
       FROM gold.indicador_territorio
       WHERE ($1::text IS NULL OR indicador = $1)`,
      [filtros.indicador ?? null],
    );
    return ano;
  }
}
