import { DataSource } from 'typeorm';
import type { AppE2e } from './e2e-app';

// O gold é da pipeline (PR-007): a aplicação nunca grava lá, então os e2e
// preenchem direto no banco, como a pipeline faria.
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

// gold.fonte_status é uma view sobre as coletas bem-sucedidas.
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
