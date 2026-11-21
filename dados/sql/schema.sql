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

-- Territórios (DEC-035): o Recife e as 6 RPAs, com o nome que aparece nas
-- telas e grava na coluna territorio das outras tabelas. Fonte: "Limites por
-- RPA - 2023", dados abertos da Prefeitura do Recife.
CREATE TABLE IF NOT EXISTS gold.territorio (
  nome  text     PRIMARY KEY,
  tipo  text     NOT NULL CHECK (tipo IN ('MUNICIPIO', 'RPA')),
  pai   text     REFERENCES gold.territorio (nome),
  rpa   smallint UNIQUE CHECK (rpa BETWEEN 1 AND 6),
  CONSTRAINT territorio_hierarquia_ck CHECK (
    (tipo = 'MUNICIPIO' AND pai IS NULL AND rpa IS NULL) OR
    (tipo = 'RPA' AND pai IS NOT NULL AND rpa IS NOT NULL)
  )
);
INSERT INTO gold.territorio (nome, tipo, pai, rpa) VALUES
  ('Recife', 'MUNICIPIO', NULL, NULL),
  ('RPA 1 - Centro', 'RPA', 'Recife', 1),
  ('RPA 2 - Norte', 'RPA', 'Recife', 2),
  ('RPA 3 - Noroeste', 'RPA', 'Recife', 3),
  ('RPA 4 - Oeste', 'RPA', 'Recife', 4),
  ('RPA 5 - Sudoeste', 'RPA', 'Recife', 5),
  ('RPA 6 - Sul', 'RPA', 'Recife', 6)
ON CONFLICT (nome) DO NOTHING;

-- Bairro -> RPA (DEC-035), com o nome normalizado como o coletor de
-- arboviroses grava (maiúsculas, sem acento). Fonte: "Bairros e RPAs do
-- Recife", dados abertos da Prefeitura do Recife (94 bairros).
CREATE TABLE IF NOT EXISTS gold.bairro_rpa (
  bairro     text PRIMARY KEY,
  territorio text NOT NULL REFERENCES gold.territorio (nome)
);
INSERT INTO gold.bairro_rpa (bairro, territorio) VALUES
  ('AFLITOS', 'RPA 3 - Noroeste'),
  ('AFOGADOS', 'RPA 5 - Sudoeste'),
  ('AGUA FRIA', 'RPA 2 - Norte'),
  ('ALTO DO MANDU', 'RPA 3 - Noroeste'),
  ('ALTO JOSE BONIFACIO', 'RPA 3 - Noroeste'),
  ('ALTO JOSE DO PINHO', 'RPA 3 - Noroeste'),
  ('ALTO SANTA TEREZINHA', 'RPA 2 - Norte'),
  ('APIPUCOS', 'RPA 3 - Noroeste'),
  ('AREIAS', 'RPA 5 - Sudoeste'),
  ('ARRUDA', 'RPA 2 - Norte'),
  ('BARRO', 'RPA 5 - Sudoeste'),
  ('BEBERIBE', 'RPA 2 - Norte'),
  ('BOA VIAGEM', 'RPA 6 - Sul'),
  ('BOA VISTA', 'RPA 1 - Centro'),
  ('BOMBA DO HEMETERIO', 'RPA 2 - Norte'),
  ('BONGI', 'RPA 5 - Sudoeste'),
  ('BRASILIA TEIMOSA', 'RPA 6 - Sul'),
  ('BREJO DA GUABIRABA', 'RPA 3 - Noroeste'),
  ('BREJO DE BEBERIBE', 'RPA 3 - Noroeste'),
  ('CABANGA', 'RPA 1 - Centro'),
  ('CACOTE', 'RPA 5 - Sudoeste'),
  ('CAJUEIRO', 'RPA 2 - Norte'),
  ('CAMPINA DO BARRETO', 'RPA 2 - Norte'),
  ('CAMPO GRANDE', 'RPA 2 - Norte'),
  ('CASA AMARELA', 'RPA 3 - Noroeste'),
  ('CASA FORTE', 'RPA 3 - Noroeste'),
  ('CAXANGA', 'RPA 4 - Oeste'),
  ('CIDADE UNIVERSITARIA', 'RPA 4 - Oeste'),
  ('COELHOS', 'RPA 1 - Centro'),
  ('COHAB', 'RPA 6 - Sul'),
  ('COQUEIRAL', 'RPA 5 - Sudoeste'),
  ('CORDEIRO', 'RPA 4 - Oeste'),
  ('CORREGO DO JENIPAPO', 'RPA 3 - Noroeste'),
  ('CURADO', 'RPA 5 - Sudoeste'),
  ('DERBY', 'RPA 3 - Noroeste'),
  ('DOIS IRMAOS', 'RPA 3 - Noroeste'),
  ('DOIS UNIDOS', 'RPA 2 - Norte'),
  ('ENCRUZILHADA', 'RPA 2 - Norte'),
  ('ENGENHO DO MEIO', 'RPA 4 - Oeste'),
  ('ESPINHEIRO', 'RPA 3 - Noroeste'),
  ('ESTANCIA', 'RPA 5 - Sudoeste'),
  ('FUNDAO', 'RPA 2 - Norte'),
  ('GRACAS', 'RPA 3 - Noroeste'),
  ('GUABIRABA', 'RPA 3 - Noroeste'),
  ('HIPODROMO', 'RPA 2 - Norte'),
  ('IBURA', 'RPA 6 - Sul'),
  ('ILHA DO LEITE', 'RPA 1 - Centro'),
  ('ILHA DO RETIRO', 'RPA 4 - Oeste'),
  ('ILHA JOANA BEZERRA', 'RPA 1 - Centro'),
  ('IMBIRIBEIRA', 'RPA 6 - Sul'),
  ('IPSEP', 'RPA 6 - Sul'),
  ('IPUTINGA', 'RPA 4 - Oeste'),
  ('JAQUEIRA', 'RPA 3 - Noroeste'),
  ('JARDIM SAO PAULO', 'RPA 5 - Sudoeste'),
  ('JIQUIA', 'RPA 5 - Sudoeste'),
  ('JORDAO', 'RPA 6 - Sul'),
  ('LINHA DO TIRO', 'RPA 2 - Norte'),
  ('MACAXEIRA', 'RPA 3 - Noroeste'),
  ('MADALENA', 'RPA 4 - Oeste'),
  ('MANGABEIRA', 'RPA 3 - Noroeste'),
  ('MANGUEIRA', 'RPA 5 - Sudoeste'),
  ('MONTEIRO', 'RPA 3 - Noroeste'),
  ('MORRO DA CONCEICAO', 'RPA 3 - Noroeste'),
  ('MUSTARDINHA', 'RPA 5 - Sudoeste'),
  ('NOVA DESCOBERTA', 'RPA 3 - Noroeste'),
  ('PAISSANDU', 'RPA 1 - Centro'),
  ('PARNAMIRIM', 'RPA 3 - Noroeste'),
  ('PASSARINHO', 'RPA 3 - Noroeste'),
  ('PAU FERRO', 'RPA 3 - Noroeste'),
  ('PEIXINHOS', 'RPA 2 - Norte'),
  ('PINA', 'RPA 6 - Sul'),
  ('POCO', 'RPA 3 - Noroeste'),
  ('PONTO DE PARADA', 'RPA 2 - Norte'),
  ('PORTO DA MADEIRA', 'RPA 2 - Norte'),
  ('PRADO', 'RPA 4 - Oeste'),
  ('RECIFE', 'RPA 1 - Centro'),
  ('ROSARINHO', 'RPA 2 - Norte'),
  ('SAN MARTIN', 'RPA 5 - Sudoeste'),
  ('SANCHO', 'RPA 5 - Sudoeste'),
  ('SANTANA', 'RPA 3 - Noroeste'),
  ('SANTO AMARO', 'RPA 1 - Centro'),
  ('SANTO ANTONIO', 'RPA 1 - Centro'),
  ('SAO JOSE', 'RPA 1 - Centro'),
  ('SITIO DOS PINTOS', 'RPA 3 - Noroeste'),
  ('SOLEDADE', 'RPA 1 - Centro'),
  ('TAMARINEIRA', 'RPA 3 - Noroeste'),
  ('TEJIPIO', 'RPA 5 - Sudoeste'),
  ('TORRE', 'RPA 4 - Oeste'),
  ('TORREAO', 'RPA 2 - Norte'),
  ('TORROES', 'RPA 4 - Oeste'),
  ('TOTO', 'RPA 5 - Sudoeste'),
  ('VARZEA', 'RPA 4 - Oeste'),
  ('VASCO DA GAMA', 'RPA 3 - Noroeste'),
  ('ZUMBI', 'RPA 4 - Oeste')
ON CONFLICT (bairro) DO NOTHING;

-- Mapa da EST-01 (DEC-038, TASK-071) -------------------------------------

-- Limite de cada RPA em GeoJSON (MultiPolygon, longitude/latitude), gravado
-- pela pipeline a partir de "Limites por RPA - 2023"; nulo no Recife.
ALTER TABLE gold.territorio ADD COLUMN IF NOT EXISTS limite jsonb;

-- Pontos de área de risco da Defesa Civil (dados abertos da Prefeitura; hoje
-- só a Regional Sul). nivel nulo: ponto de lona, deslizamento, não informado.
CREATE TABLE IF NOT EXISTS gold.area_risco (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  fonte         text         NOT NULL,
  regional      text         NOT NULL,
  territorio    text         NOT NULL,
  bairro        text         NOT NULL,
  localidade    text         NOT NULL,
  endereco      text         NOT NULL,
  descricao     text         NOT NULL,
  nivel         smallint     CHECK (nivel BETWEEN 1 AND 4),
  latitude      numeric(9,6) NOT NULL,
  longitude     numeric(9,6) NOT NULL,
  atualizado_em timestamptz  NOT NULL DEFAULT now()
);

-- População residente por bairro, Censo 2022 do IBGE (PR-030).
CREATE TABLE IF NOT EXISTS gold.populacao_bairro (
  bairro        text        PRIMARY KEY REFERENCES gold.bairro_rpa (bairro),
  territorio    text        NOT NULL REFERENCES gold.territorio (nome),
  populacao     integer     NOT NULL CHECK (populacao >= 0),
  ano           smallint    NOT NULL,
  fonte         text        NOT NULL,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
