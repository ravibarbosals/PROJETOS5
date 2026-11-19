import { CriaTabelasAlertasAcoes1792900000001 } from '@/infrastructure/database/migrations/1792900000001-CriaTabelasAlertasAcoes';
import { EvoluiAlertaParaIncidente1792900000002 } from '@/infrastructure/database/migrations/1792900000002-EvoluiAlertaParaIncidente';
import {
  columnsCreatedIn,
  loadEntityMetadata,
} from '@/infrastructure/database/testing/entity-metadata';
import { UsuarioPapel } from '@/modules/acesso/entities/usuario-papel.entity';
import { Usuario } from '@/modules/acesso/entities/usuario.entity';
import { AlertaAcaoManual } from '@/modules/alertas/entities/alerta-acao-manual.entity';
import { Alerta } from '@/modules/alertas/entities/alerta.entity';
import { ControleAvaliacaoAlerta } from '@/modules/alertas/entities/controle-avaliacao-alerta.entity';
import { ParametroAlertaHistorico } from '@/modules/alertas/entities/parametro-alerta-historico.entity';
import { ParametroAlerta } from '@/modules/alertas/entities/parametro-alerta.entity';
import { Acao } from '@/modules/rastreio-operacional/entities/acao.entity';
import type { QueryRunner } from 'typeorm';

const ENTITIES = [
  Usuario,
  UsuarioPapel,
  ParametroAlerta,
  ParametroAlertaHistorico,
  Alerta,
  AlertaAcaoManual,
  Acao,
  ControleAvaliacaoAlerta,
];

const MIGRATIONS = [
  new CriaTabelasAlertasAcoes1792900000001(),
  new EvoluiAlertaParaIncidente1792900000002(),
];

async function migrationStatements(
  direction: 'up' | 'down',
  migrations = MIGRATIONS,
): Promise<string[]> {
  const statements: string[] = [];
  const runner = {
    query: (sql: string) => {
      statements.push(sql);
      return Promise.resolve();
    },
  } as unknown as QueryRunner;
  for (const migration of migrations) await migration[direction](runner);
  return statements;
}

describe('alert and action entities (erd.md)', () => {
  const cases = [
    { entity: ParametroAlerta, table: 'parametro_alerta' },
    { entity: ParametroAlertaHistorico, table: 'parametro_alerta_historico' },
    { entity: Alerta, table: 'alerta' },
    { entity: AlertaAcaoManual, table: 'alerta_acao_manual' },
    { entity: Acao, table: 'acao' },
    { entity: ControleAvaliacaoAlerta, table: 'controle_avaliacao_alerta' },
  ];

  it.each(cases)(
    '$table lives in the app schema',
    async ({ entity, table }) => {
      const metadataOf = await loadEntityMetadata(ENTITIES);

      expect(metadataOf(entity).tablePath).toBe(`app.${table}`);
    },
  );

  it.each(cases)(
    '$table entity columns match the migration',
    async ({ entity, table }) => {
      const metadataOf = await loadEntityMetadata(ENTITIES);
      const sql = (await migrationStatements('up')).join('\n');

      const entityColumns = metadataOf(entity)
        .columns.map((column) => column.databaseName)
        .sort();

      expect(entityColumns).toEqual(columnsCreatedIn(sql, table).sort());
    },
  );

  it.each([
    { entity: ParametroAlertaHistorico, column: 'valor_anterior' },
    { entity: Alerta, column: 'dthr_encerramento' },
    { entity: Alerta, column: 'motivo_encerramento' },
    { entity: Alerta, column: 'prorrogado_ate' },
    { entity: Alerta, column: 'dthr_escalonamento' },
    { entity: AlertaAcaoManual, column: 'prorrogado_ate' },
    { entity: Acao, column: 'id_alerta' },
    { entity: ControleAvaliacaoAlerta, column: 'ultima_lida_em' },
  ])('$column is nullable', async ({ entity, column }) => {
    const metadataOf = await loadEntityMetadata(ENTITIES);

    expect(
      metadataOf(entity).findColumnWithDatabaseName(column)?.isNullable,
    ).toBe(true);
  });

  it('acao has no update timestamp (RN-004 #5, DEC-014)', async () => {
    const metadataOf = await loadEntityMetadata(ENTITIES);

    expect(
      metadataOf(Acao).findColumnWithDatabaseName('dthr_atualizacao'),
    ).toBeUndefined();
  });
});

describe('alert migrations', () => {
  it('keeps one active alert per variable and territory (RN-013)', async () => {
    const sql = (await migrationStatements('up')).join('\n');

    expect(sql).toContain(
      "CREATE UNIQUE INDEX uq_alerta_ativo_variavel_territorio ON app.alerta (variavel, territorio) WHERE status = 'ATIVO'",
    );
    expect(sql).toContain(
      'ALTER TABLE app.alerta DROP CONSTRAINT uq_alerta_parametro_leitura',
    );
  });

  it('keeps the exit threshold below the threshold (DEC-029)', async () => {
    const sql = (await migrationStatements('up')).join('\n');

    expect(sql).toContain(
      'CONSTRAINT ck_parametro_alerta_limiar_saida CHECK (limiar_saida < limiar)',
    );
  });

  it('creates the single job control row (DEC-015)', async () => {
    const statements = await migrationStatements('up', [MIGRATIONS[0]]);

    expect(statements.at(-1)).toBe(
      'INSERT INTO app.controle_avaliacao_alerta (ultima_lida_em) VALUES (NULL)',
    );
  });

  it('drops the tables in reverse dependency order', async () => {
    expect(await migrationStatements('down', [MIGRATIONS[0]])).toEqual([
      'DROP TABLE app.controle_avaliacao_alerta',
      'DROP TABLE app.acao',
      'DROP TABLE app.alerta',
      'DROP TABLE app.parametro_alerta_historico',
      'DROP TABLE app.parametro_alerta',
    ]);
  });

  it('reverts the incident columns starting with the new table', async () => {
    const statements = await migrationStatements('down', [MIGRATIONS[1]]);

    expect(statements[0]).toBe('DROP TABLE app.alerta_acao_manual');
    expect(statements.at(-1)).toBe(
      'ALTER TABLE app.parametro_alerta DROP COLUMN limiar_saida',
    );
  });
});
