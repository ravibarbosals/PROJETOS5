import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Alerta } from '@/modules/alertas/entities/alerta.entity';
import { StatusAlerta } from '@/modules/alertas/enums/status-alerta.enum';
import type { DecisoesPendentesResponseDto } from '@/modules/rastreio-operacional/decisoes-pendentes/dto/decisoes-pendentes-response.dto';
import { Acao } from '@/modules/rastreio-operacional/entities/acao.entity';

// PR-033: decisão pendente é o alerta ativo sem nenhuma ação ligada (REQ-006).
// Quem espera há mais tempo vem primeiro. Sem paginação: há no máximo um
// alerta ativo por variável e território (RN-013).
@Injectable()
export class DecisoesPendentesService {
  constructor(
    @InjectRepository(Alerta) private readonly alertas: Repository<Alerta>,
  ) {}

  async listar(): Promise<DecisoesPendentesResponseDto> {
    const alertas = await this.alertas
      .createQueryBuilder('alerta')
      .select([
        'alerta.id',
        'alerta.variavel',
        'alerta.territorio',
        'alerta.nivel',
        'alerta.dthrDisparo',
      ])
      .where('alerta.status = :status', { status: StatusAlerta.Ativo })
      .andWhere((qb) => {
        const comAcao = qb
          .subQuery()
          .select('1')
          .from(Acao, 'acao')
          .where('acao.id_alerta = alerta.id')
          .getQuery();
        return `NOT EXISTS ${comAcao}`;
      })
      .orderBy('alerta.dthrDisparo', 'ASC')
      .addOrderBy('alerta.id', 'ASC')
      .getMany();

    return {
      total: alertas.length,
      alertas: alertas.map((a) => ({
        id: a.id,
        variavel: a.variavel,
        territorio: a.territorio,
        nivel: a.nivel,
        disparado_em: a.dthrDisparo,
      })),
    };
  }
}
