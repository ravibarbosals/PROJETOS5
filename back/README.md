# O Vigia: API

API da Sala de Situação do Vigidesastres (Secretaria de Saúde do Recife). NestJS 11 + TypeORM, com PostgreSQL (local no Docker ou no Neon).

O app grava os próprios dados no schema `app`. Os dados climáticos chegam no schema `gold`, preenchido pela pipeline em `../dados`. A API não escreve nesse schema.

## Requisitos

- **Node 22** (`.nvmrc`). Com Node 20, a conexão com o banco falha com `Promise.withResolvers is not a function`. Use `nvm use` nesta pasta.
- **Docker com Compose**, para o PostgreSQL local.

## Rodar

Todos os comandos rodam nesta pasta (`back`).

```bash
cp .env.example .env    # preencha senhas, JWT_SECRET e ADMIN_* (instruções no próprio arquivo)
docker compose up -d --build --wait
```

Esse comando sobe o sistema inteiro, em ordem:

| Serviço | O que faz |
|---|---|
| `db` | PostgreSQL 17 |
| `db-init` | Cria os schemas `app`, `bronze` e `gold` com o `../dados/sql/schema.sql` (idempotente; roda e termina) |
| `migrate` | Aplica as migrations pendentes e cria o primeiro administrador com os dados `ADMIN_*` (roda uma vez e termina) |
| `api` | API em http://localhost:3000 (`/health` mostra o banco) |
| `dados` | Agendador da pipeline (DEC-026): coleta e trata ao subir e a cada `INTERVALO_MINUTOS` (padrão 60). Logs: `docker compose logs -f dados` |
| `front` | Interface em **http://localhost:8080**. O nginx repassa `/api` para a API |

Entre no front com o `ADMIN_EMAIL` e a `ADMIN_SENHA` do `.env`. O seed é idempotente: se já existe um administrador, nada é criado nem alterado. Para outra porta, use `PORT` (API) ou `FRONT_PORT` (front) no `.env`.

Para parar: `docker compose down`. Os dados ficam no volume `pg-data`; `docker compose down -v` apaga tudo.

### Dados de demonstração

Para apresentar o sistema, `npm run seed:demo` cria 4 usuários (`tecnico`, `gestor`, `gestao` e `comunicacao`, todos `@demo.vigia.local`, com a senha `DEMO_SENHA` do `.env`), parâmetros de chuva e calor e um mês de alertas encerrados com ações. Os valores são ilustrativos e as datas, relativas a hoje. Só roda no Postgres local, nunca no Neon, e só num banco sem parâmetros. Rodar de novo não duplica nada.

No dia da apresentação, `npm run seed:demo -- --ativo` acrescenta um alerta de chuva ATIVO, prorrogado por 8 horas. Depois disso o job de alertas o encerra sozinho.

Com o sistema no compose, rode pelo container da API, que já aponta para o banco do compose:

```bash
docker compose exec api node dist/infrastructure/database/seed-demo.cli.js --ativo
```

`docker compose down -v` apaga o volume do banco e, com ele, os usuários de demonstração; depois de subir de novo, rode o seed outra vez.

### Desenvolvimento

Para rodar a API fora do Docker, com recarga automática, deixe só o banco no compose:

```bash
npm ci
docker compose up -d --wait db db-init
npm run migration:run
npm run seed:admin
npm run start:dev
```

A documentação da API (Swagger) fica em http://localhost:3000/docs. Ela só existe fora de `NODE_ENV=production`, então não aparece no container.

## Testes

| Comando | O que roda |
|---|---|
| `npm run verificar` | Prettier, ESLint, TypeScript e os testes unitários (`src/**/*.spec.ts`). Não precisa de banco |
| `npm run test:e2e` | Testes e2e (`test/*.e2e-spec.ts`) com o app inteiro contra o PostgreSQL do compose |

Os e2e usam um banco próprio, `<nome do banco da DATABASE_URL>_e2e`, no mesmo servidor. Nunca rode os e2e com a `DATABASE_URL` do Neon. Os dados de desenvolvimento não são tocados. Na primeira execução, o setup cria o banco e o schema e aplica as migrations. Cada teste começa com as tabelas vazias. Antes de rodar, o banco precisa estar de pé (`docker compose up -d --wait db db-init`).

## Migrations

```bash
npm run migration:run       # aplica as pendentes
npm run migration:revert    # desfaz a última
npm run migration:show      # lista o estado
npm run migration:create -- src/infrastructure/database/migrations/NomeDaMigration
```

O TypeORM nunca sincroniza o schema sozinho (`synchronize: false`). Toda mudança de tabela passa por uma migration.

### No Neon

O schema `app` já existe (criado junto com `bronze` e `gold`). Para aplicar as migrations e criar o administrador, aponte a `DATABASE_URL` para o Neon usando o host **sem** `-pooler` e rode `npm run migration:run` e `npm run seed:admin`.

## Estrutura

```
src/
  core/              configuração (env validada), filtro de erros, pipe de validação
  infrastructure/    banco (TypeORM, migrations, seed) e geração de PDF
  modules/
    acesso/          login (JWT), usuários e papéis, registro de acesso
    alertas/         parâmetros de alerta, histórico de alterações e alertas
    rastreio-operacional/  ações, linha do tempo e tempo de acionamento
    boletins/        pré-visualização em HTML e PDF do boletim
    health/          GET /health
test/                e2e e seus helpers
```

## Formato de erro

Todo erro responde em JSON:

```json
{ "status_code": 409, "error": "Conflict", "message": "Já existe um usuário com este e-mail",
  "business_rule_code": "EMAIL_JA_CADASTRADO", "timestamp": "...", "path": "/usuarios" }
```