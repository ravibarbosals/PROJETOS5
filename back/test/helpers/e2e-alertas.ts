import { DataSource } from 'typeorm';
import { Alerta } from '@/modules/alertas/entities/alerta.entity';
import { ParametroAlerta } from '@/modules/alertas/entities/parametro-alerta.entity';
import { MotivoEncerramento } from '@/modules/alertas/enums/motivo-encerramento.enum';
import { NivelAlerta } from '@/modules/alertas/enums/nivel-alerta.enum';
import { StatusAlerta } from '@/modules/alertas/enums/status-alerta.enum';
import type { AppE2e } from './e2e-app';

interface DadosAlerta {
  disparadoEm: Date;
  territorio?: string;
  /** Padrão: chuva_1h; outra variável permite 2 alertas ativos no território */
  variavel?: string;
  nivel?: NivelAlerta;
  status?: StatusAlerta;
  motivoEncerramento?: MotivoEncerramento;
}

let sequencia = 0;

// Os alertas vêm do job (TASK-035), então os e2e inserem direto no banco, cada
// um com parâmetro e território próprios (RN-013: um alerta ativo por variável
// e território).
export async function criarAlerta(
  app: AppE2e,
  dados: DadosAlerta,
): Promise<Alerta> {
  const fonte = app.get(DataSource);
  const territorio = dados.territorio ?? `E2E-${++sequencia}`;
  const nivel = dados.nivel ?? NivelAlerta.Alto;
  const parametro = await fonte.getRepository(ParametroAlerta).save({
    variavel: dados.variavel ?? 'chuva_1h',
    territorio,
    limiar: 50,
    limiarSaida: 20,
    janelaHoras: 1,
    nivel,
  });
  const lidaEm = new Date(dados.disparadoEm.getTime() - 5 * 60_000);
  return fonte.getRepository(Alerta).save({
    idParametroAlerta: parametro.id,
    variavel: parametro.variavel,
    territorio,
    limiar: parametro.limiar,
    nivel,
    fonte: 'APAC',
    estacao: 'E2E',
    valorLido: 62.5,
    valorMaximo: 62.5,
    lidaEm,
    ultimaLeituraEm: lidaEm,
    status: dados.status ?? StatusAlerta.Ativo,
    motivoEncerramento: dados.motivoEncerramento ?? null,
    dthrDisparo: dados.disparadoEm,
  });
}

interface DadosAcao {
  descricao: string;
  idUsuario: number;
  idAlerta?: number;
  registradaEm: Date;
}

// A API sempre carimba a hora do servidor (RN-004); uma hora fixa só é possível
// direto no banco.
export async function registrarAcaoEm(app: AppE2e, dados: DadosAcao) {
  await app
    .get(DataSource)
    .query(
      'INSERT INTO app.acao (descricao, id_alerta, id_usuario, dthr_criacao) VALUES ($1, $2, $3, $4)',
      [
        dados.descricao,
        dados.idAlerta ?? null,
        dados.idUsuario,
        dados.registradaEm,
      ],
    );
}
