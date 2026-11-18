import { DataSource } from 'typeorm';
import type { AppE2e } from './e2e-app';

// The gold belongs to the pipeline (PR-007): the app never writes there, so the
// e2e fill it straight in the database, as the pipeline would.
export async function limparGold(app: AppE2e) {
  const fonte = app.get(DataSource);
  await fonte.query('DELETE FROM gold.leitura_climatica');
  await fonte.query('DELETE FROM bronze.coleta');
}

interface DadosLeitura {
  fonte?: string;
  variavel: string;
  valor: number;
  lidaEm: Date;
}

export async function inserirLeitura(app: AppE2e, dados: DadosLeitura) {
  await app.get(DataSource).query(
    `INSERT INTO gold.leitura_climatica (fonte, estacao, territorio, variavel, valor, lida_em)
       VALUES ($1, 'recife', 'Recife', $2, $3, $4)`,
    [dados.fonte ?? 'openmeteo', dados.variavel, dados.valor, dados.lidaEm],
  );
}

// gold.fonte_status is a view over successful collections.
export async function registrarColeta(
  app: AppE2e,
  fonte: string,
  coletadoEm: Date,
) {
  await app.get(DataSource).query(
    `INSERT INTO bronze.coleta (fonte, url, status_http, payload, coletado_em)
       VALUES ($1, 'https://e2e', 200, '{}', $2)`,
    [fonte, coletadoEm],
  );
}
