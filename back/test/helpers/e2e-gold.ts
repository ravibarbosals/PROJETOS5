import { DataSource } from 'typeorm';
import type { AppE2e } from './e2e-app';

interface DadosLeitura {
  fonte?: string;
  /** Padrão: o ponto único do Recife, como antes das RPAs (DEC-035) */
  estacao?: string;
  territorio?: string;
  variavel: string;
  valor: number;
  lidaEm: Date;
}

interface DadosIndicador {
  bairro: string;
  indicador: string;
  periodo: string;
  valor: number;
}

// O gold é da pipeline (PR-007): a aplicação nunca grava lá, então os e2e
// preenchem direto no banco, como a pipeline faria.
export async function limparGold(app: AppE2e) {
  const fonte = app.get(DataSource);
  await fonte.query('DELETE FROM gold.leitura_climatica');
  await fonte.query('DELETE FROM gold.indicador_territorio');
  await fonte.query('DELETE FROM bronze.coleta');
}

export async function inserirLeitura(app: AppE2e, dados: DadosLeitura) {
  await app.get(DataSource).query(
    `INSERT INTO gold.leitura_climatica (fonte, estacao, territorio, variavel, valor, lida_em)
       VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      dados.fonte ?? 'openmeteo',
      dados.estacao ?? 'recife',
      dados.territorio ?? 'Recife',
      dados.variavel,
      dados.valor,
      dados.lidaEm,
    ],
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

export async function inserirIndicador(app: AppE2e, dados: DadosIndicador) {
  await app.get(DataSource).query(
    `INSERT INTO gold.indicador_territorio (fonte, territorio, bairro, indicador, periodo, valor)
       VALUES ('recife_arboviroses', 'Recife', $1, $2, $3, $4)`,
    [dados.bairro, dados.indicador, dados.periodo, dados.valor],
  );
}
