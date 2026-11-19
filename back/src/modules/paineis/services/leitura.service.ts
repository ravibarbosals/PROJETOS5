import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { inicioDaJanela } from '@/modules/paineis/domain/janela-periodo';
import { LeituraResponseDto } from '@/modules/paineis/dto/leitura-response.dto';
import { LeiturasQueryDto } from '@/modules/paineis/dto/leituras-query.dto';
import { VariavelClimatica } from '@/modules/paineis/enums/variavel-climatica.enum';

interface LinhaLeitura {
  fonte: string;
  estacao: string;
  territorio: string;
  variavel: VariavelClimatica;
  // numeric chega do pg como string
  valor: string;
  lida_em: Date;
  fonte_atualizada_em: Date | null;
}

// Só leitura sobre o schema gold, gravado pela pipeline (PR-007, DEC-024).
@Injectable()
export class LeituraService {
  constructor(private readonly dataSource: DataSource) {}

  async listar(
    filtros: LeiturasQueryDto,
    agora = new Date(),
  ): Promise<LeituraResponseDto[]> {
    const linhas = await this.dataSource.query<LinhaLeitura[]>(
      `SELECT l.fonte, l.estacao, l.territorio, l.variavel, l.valor, l.lida_em,
              s.ultima_atualizacao AS fonte_atualizada_em
       FROM gold.leitura_climatica l
       LEFT JOIN gold.fonte_status s ON s.fonte = l.fonte
       WHERE l.lida_em > $1 AND l.lida_em <= $2
         AND ($3::text IS NULL OR l.variavel = $3)
         AND ($4::text IS NULL OR l.territorio = $4)
       ORDER BY l.lida_em, l.variavel`,
      [
        inicioDaJanela(filtros.periodo, agora),
        agora,
        filtros.variavel ?? null,
        filtros.territorio ?? null,
      ],
    );
    return linhas.map((linha) => ({ ...linha, valor: Number(linha.valor) }));
  }
}
