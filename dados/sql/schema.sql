-- Schemas e tabelas do gold da pipeline de dados (DEC-024, docs: guia-dados
-- etapa 2). Idempotente: pode rodar de novo num banco que já existe.

CREATE SCHEMA IF NOT EXISTS bronze;
CREATE SCHEMA IF NOT EXISTS gold;
CREATE SCHEMA IF NOT EXISTS app;

CREATE TABLE IF NOT EXISTS bronze.coleta (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  fonte         text        NOT NULL,
  url           text        NOT NULL,
  status_http   integer     NOT NULL,
  payload       jsonb,
  coletado_em   timestamptz NOT NULL DEFAULT now(),
  processado_em timestamptz
);
CREATE INDEX IF NOT EXISTS coleta_pendente_idx ON bronze.coleta (fonte, coletado_em)
  WHERE processado_em IS NULL;

CREATE TABLE IF NOT EXISTS gold.leitura_climatica (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  fonte         text        NOT NULL,
  estacao       text        NOT NULL,
  territorio    text        NOT NULL,
  variavel      text        NOT NULL CHECK (variavel IN ('precipitacao_mm', 'temperatura_c', 'umidade_pct', 'pressao_hpa')),
  valor         numeric(8,2) NOT NULL,
  lida_em       timestamptz NOT NULL,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT leitura_climatica_uk UNIQUE (fonte, estacao, variavel, lida_em)
);

CREATE OR REPLACE VIEW gold.fonte_status AS
SELECT fonte, max(coletado_em) AS ultima_atualizacao
FROM bronze.coleta
WHERE status_http = 200
GROUP BY fonte;

-- Casos prováveis de arbovirose por bairro e semana epidemiológica (DEC-031).
-- Só contagens: o coletor agrega antes de gravar (REQ-014).
CREATE TABLE IF NOT EXISTS gold.indicador_territorio (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  fonte         text        NOT NULL,
  territorio    text        NOT NULL,
  bairro        text        NOT NULL,
  indicador     text        NOT NULL CHECK (indicador IN ('dengue', 'chikungunya', 'zika')),
  periodo       text        NOT NULL CHECK (periodo ~ '^[0-9]{4}-SE[0-9]{2}$'),
  valor         integer     NOT NULL CHECK (valor >= 0),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT indicador_territorio_uk UNIQUE (fonte, indicador, bairro, periodo)
);