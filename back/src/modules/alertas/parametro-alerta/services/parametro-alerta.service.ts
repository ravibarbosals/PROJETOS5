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
import {
  aplicarCampos,
  CamposEditaveis,
  camposDe,
  diferencaParametro,
  limiaresValidos,
} from '@/modules/alertas/parametro-alerta/domain/diferenca-parametro';
import { ParametroAlertaHistorico } from '@/modules/alertas/entities/parametro-alerta-historico.entity';
import { ParametroAlerta } from '@/modules/alertas/entities/parametro-alerta.entity';
import { NivelAlerta } from '@/modules/alertas/enums/nivel-alerta.enum';
import { OperacaoHistorico } from '@/modules/alertas/enums/operacao-historico.enum';

// Nomes da API, que também são as chaves do histórico (RN-001).
export interface CriarParametroAlerta {
  variavel: string;
  territorio: string;
  limiar: number;
  limiar_saida: number;
  janela_horas: number;
  nivel: NivelAlerta;
}

function exigirLimiaresValidos(campos: CamposEditaveis | CriarParametroAlerta) {
  if (!limiaresValidos(campos)) {
    throw new BusinessRuleException(AlertasRules.LIMIAR_SAIDA_INVALIDO);
  }
}

// DEC-012.
export const PARAMETRO_ALERTA_PAGINATE_CONFIG: PaginateConfig<ParametroAlerta> =
  {
    sortableColumns: ['id', 'variavel', 'territorio', 'dthrAtualizacao'],
    defaultSortBy: [
      ['variavel', 'ASC'],
      ['territorio', 'ASC'],
    ],
    filterableColumns: {
      ativo: [FilterOperator.EQ],
      variavel: [FilterOperator.EQ],
      territorio: [FilterOperator.EQ],
    },
    defaultLimit: 20,
    maxLimit: 100,
  };

// DEC-012. Alteração mais recente primeiro.
export const HISTORICO_PAGINATE_CONFIG: PaginateConfig<ParametroAlertaHistorico> =
  {
    sortableColumns: ['id', 'dthrCriacao'],
    defaultSortBy: [['dthrCriacao', 'DESC']],
    relations: { usuario: true },
    defaultLimit: 20,
    maxLimit: 100,
  };

@Injectable()
export class ParametroAlertaService {
  constructor(
    @InjectRepository(ParametroAlerta)
    private readonly parametros: Repository<ParametroAlerta>,
    @InjectRepository(ParametroAlertaHistorico)
    private readonly historicos: Repository<ParametroAlertaHistorico>,
    private readonly dataSource: DataSource,
  ) {}

  // RN-001 #1 e #4: parâmetro e histórico na mesma transação. A variável não é
  // conferida com o gold enquanto a DEC-009 não existir.
  async criar(
    dados: CriarParametroAlerta,
    autor: Usuario,
  ): Promise<ParametroAlerta> {
    exigirLimiaresValidos(dados);
    return this.dataSource.transaction(async (manager) => {
      const parametro = await manager.save(
        manager.create(ParametroAlerta, {
          variavel: dados.variavel,
          territorio: dados.territorio,
          limiar: dados.limiar,
          limiarSaida: dados.limiar_saida,
          janelaHoras: dados.janela_horas,
          nivel: dados.nivel,
          ativo: true,
        }),
      );
      await manager.insert(ParametroAlertaHistorico, {
        idParametroAlerta: parametro.id,
        idUsuario: autor.id,
        operacao: OperacaoHistorico.Criacao,
        valorAnterior: null,
        valorNovo: { ...dados, ativo: true },
      });
      return parametro;
    });
  }

  // RN-001 #2 a #4. A linha fica travada enquanto o valor anterior é lido, para
  // duas edições simultâneas registrarem cada uma o que de fato substituíram.
  alterar(
    id: number,
    dados: Partial<CamposEditaveis>,
    autor: Usuario,
  ): Promise<ParametroAlerta> {
    return this.dataSource.transaction(async (manager) => {
      const parametro = await manager.findOne(ParametroAlerta, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!parametro) throw new NotFoundException('Parâmetro não encontrado');

      const atual = camposDe(parametro);
      const diferenca = diferencaParametro(atual, dados);
      if (!diferenca) return parametro;
      // Conferido nos valores já mesclados: mudar só um limiar pode quebrar o
      // par.
      exigirLimiaresValidos({ ...atual, ...diferenca.novo });

      aplicarCampos(parametro, diferenca.novo);
      const salvo = await manager.save(parametro);
      await manager.insert(ParametroAlertaHistorico, {
        idParametroAlerta: id,
        idUsuario: autor.id,
        operacao: diferenca.operacao,
        valorAnterior: diferenca.anterior,
        valorNovo: diferenca.novo,
      });
      return salvo;
    });
  }

  listar(query: PaginateQuery): Promise<Paginated<ParametroAlerta>> {
    return paginate(query, this.parametros, PARAMETRO_ALERTA_PAGINATE_CONFIG);
  }

  async historico(
    id: number,
    query: PaginateQuery,
  ): Promise<Paginated<ParametroAlertaHistorico>> {
    if (!(await this.parametros.exists({ where: { id } }))) {
      throw new NotFoundException('Parâmetro não encontrado');
    }
    return paginate(query, this.historicos, {
      ...HISTORICO_PAGINATE_CONFIG,
      where: { idParametroAlerta: id },
    });
  }
}
