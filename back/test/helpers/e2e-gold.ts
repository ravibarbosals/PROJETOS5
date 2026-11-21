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

interface DadosAreaRisco {
  territorio: string;
  bairro: string;
  nivel: number | null;
  latitude: number;
  longitude: number;
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
  await fonte.query('DELETE FROM gold.area_risco');
  await fonte.query('DELETE FROM gold.populacao_bairro');
  await fonte.query('UPDATE gold.territorio SET limite = NULL');
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

export async function inserirAreaRisco(app: AppE2e, dados: DadosAreaRisco) {
  await app.get(DataSource).query(
    `INSERT INTO gold.area_risco
       (fonte, regional, territorio, bairro, localidade, endereco, descricao,
        nivel, latitude, longitude)
     VALUES ('recife_areas_risco', 'Sul', $1, $2, 'Localidade E2E',
             'Rua E2E, 1', 'Área de Risco E2E', $3, $4, $5)`,
    [
      dados.territorio,
      dados.bairro,
      dados.nivel,
      dados.latitude,
      dados.longitude,
    ],
  );
}

// O bairro precisa existir em gold.bairro_rpa (o schema da pipeline já traz
// os 94 do Recife)
export async function inserirPopulacao(
  app: AppE2e,
  bairro: string,
  populacao: number,
) {
  await app.get(DataSource).query(
    `INSERT INTO gold.populacao_bairro (bairro, territorio, populacao, ano, fonte)
     SELECT bairro, territorio, $2, 2022, 'ibge_populacao'
     FROM gold.bairro_rpa WHERE bairro = $1`,
    [bairro, populacao],
  );
}

export async function gravarLimite(app: AppE2e, rpa: number, limite: object) {
  await app
    .get(DataSource)
    .query('UPDATE gold.territorio SET limite = $1 WHERE rpa = $2', [
      JSON.stringify(limite),
      rpa,
    ]);
}
