import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  FilterOperator,
  paginate,
  Paginated,
  PaginateConfig,
  PaginateQuery,
} from 'nestjs-paginate';
import { DataSource, Repository } from 'typeorm';
import { BusinessRuleException } from '@/core/exceptions/business-rule.exception';
import { Usuario } from '@/modules/acesso/entities/usuario.entity';
import { AlertasRules } from '@/modules/alertas/alertas.business-rules';
import { mudancaDaAcao } from '@/modules/alertas/alerta/domain/acao-manual';
import { AlertaAcaoManual } from '@/modules/alertas/entities/alerta-acao-manual.entity';
import { Alerta } from '@/modules/alertas/entities/alerta.entity';
import { StatusAlerta } from '@/modules/alertas/enums/status-alerta.enum';
import { TipoAcaoManual } from '@/modules/alertas/enums/tipo-acao-manual.enum';
import { TRAVA_ALERTAS } from '@/modules/alertas/avaliacao/services/avaliacao-alertas.service';

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

export interface AcaoManual {
  tipo: TipoAcaoManual;
  motivo: string;
  horas?: number;
}

@Injectable()
export class AlertaService {
  constructor(
    @InjectRepository(Alerta) private readonly alertas: Repository<Alerta>,
    private readonly dataSource: DataSource,
  ) {}

  listar(query: PaginateQuery): Promise<Paginated<Alerta>> {
    return paginate(query, this.alertas, ALERTA_PAGINATE_CONFIG);
  }

  // RN-015 #4 a #9. A mudança no alerta e o registro da ação vão juntos. A trava
  // espera o job terminar: assim ele não encerra um alerta que acabou de ser
  // prorrogado, nem troca o motivo de um alerta que acabou de ser encerrado.
  async agir(id: number, acao: AcaoManual, usuario: Usuario): Promise<Alerta> {
    return this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        TRAVA_ALERTAS,
      ]);
      const alerta = await manager.findOneBy(Alerta, { id });
      if (!alerta) throw new NotFoundException('Alerta não encontrado');
      if (alerta.status !== StatusAlerta.Ativo) {
        throw new BusinessRuleException(AlertasRules.ALERTA_NAO_ATIVO);
      }

      const agora = new Date();
      const mudanca = mudancaDaAcao(acao.tipo, agora, acao.horas);
      await manager.update(Alerta, id, { ...mudanca, dthrAtualizacao: agora });
      await manager.insert(AlertaAcaoManual, {
        idAlerta: id,
        idUsuario: usuario.id,
        tipo: acao.tipo,
        motivo: acao.motivo,
        prorrogadoAte: mudanca.prorrogadoAte ?? null,
      });
      return manager.findOneByOrFail(Alerta, { id });
    });
  }
}
