import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  FilterOperator,
  paginate,
  Paginated,
  PaginateConfig,
  PaginateQuery,
} from 'nestjs-paginate';
import { Repository } from 'typeorm';
import { Alerta } from '@/modules/alertas/entities/alerta.entity';

// DEC-012. Ativos e histórico numa lista só (filtro por status), por nível
// (PR-009). O nível não entra na ordenação: como texto, ALTO viria antes de
// MODERADO (DEC-029).
export const ALERTA_PAGINATE_CONFIG: PaginateConfig<Alerta> = {
  sortableColumns: ['id', 'dthrDisparo', 'lidaEm'],
  defaultSortBy: [['dthrDisparo', 'DESC']],
  filterableColumns: {
    status: [FilterOperator.EQ],
    nivel: [FilterOperator.EQ, FilterOperator.IN],
    territorio: [FilterOperator.EQ, FilterOperator.IN],
    dthrDisparo: [FilterOperator.GTE, FilterOperator.LTE, FilterOperator.BTW],
  },
  defaultLimit: 20,
  maxLimit: 100,
};

@Injectable()
export class AlertaService {
  constructor(
    @InjectRepository(Alerta) private readonly alertas: Repository<Alerta>,
  ) {}

  listar(query: PaginateQuery): Promise<Paginated<Alerta>> {
    return paginate(query, this.alertas, ALERTA_PAGINATE_CONFIG);
  }
}
