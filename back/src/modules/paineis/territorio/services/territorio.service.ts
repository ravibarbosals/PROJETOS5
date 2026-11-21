import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TerritorioResponseDto } from '@/modules/paineis/territorio/dto/territorio-response.dto';

// Catálogo de territórios do gold (DEC-035), gravado pela pipeline (PR-007).
@Injectable()
export class TerritorioService {
  constructor(private readonly dataSource: DataSource) {}

  // O município primeiro, depois as RPAs em ordem.
  listar(): Promise<TerritorioResponseDto[]> {
    return this.dataSource.query<TerritorioResponseDto[]>(
      'SELECT nome, tipo, pai FROM gold.territorio ORDER BY rpa NULLS FIRST, nome',
    );
  }

  async existe(nome: string): Promise<boolean> {
    const linhas = await this.dataSource.query<unknown[]>(
      'SELECT 1 FROM gold.territorio WHERE nome = $1',
      [nome],
    );
    return linhas.length > 0;
  }
}
