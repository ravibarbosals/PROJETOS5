# O Vigia: API

API da Sala de Situação do Vigidesastres (Secretaria de Saúde do Recife). NestJS 11 + TypeORM, com PostgreSQL (local no Docker ou no Neon).

O app grava os próprios dados no schema `app`. Os dados climáticos chegam no schema `gold`, preenchido pela pipeline em `../dados`. A API não escreve nesse schema.

## Requisitos

- **Node 22** (`.nvmrc`). Com Node 20, a conexão com o banco falha com `Promise.withResolvers is not a function`. Use `nvm use` nesta pasta.
- **Docker com Compose**, para o PostgreSQL local.

## Rodar

Todos os comandos rodam nesta pasta (`back`).

```bash
docker compose up -d --wait
```

Não precisa de `.env`: o compose tem padrões locais para tudo. As imagens vêm do Docker Hub (`ravialmeida10/vigia-db`, `vigia-api`, `vigia-dados` e `vigia-front`); com `--build`, são construídas a partir deste código. O comando sobe o sistema inteiro, em ordem:

| Serviço | Imagem | O que faz |
|---|---|---|
| `db` | `vigia-db` (`../dados/sql/Dockerfile`) | PostgreSQL 17 que cria os schemas `app`, `bronze` e `gold` na primeira subida |
| `db-init` | `vigia-db` | Roda o mesmo `schema.sql` a cada subida, para um volume antigo receber as tabelas novas (idempotente; roda e termina) |
| `migrate` | `vigia-api` | Aplica as migrations pendentes e cria o primeiro administrador (roda e termina; se já existe um, nada muda) |
| `api` | `vigia-api` | API em http://localhost:3000 (`/health` mostra o banco) |
| `dados` | `vigia-dados` | Agendador da pipeline (DEC-026): coleta e trata ao subir e a cada `INTERVALO_MINUTOS` (padrão 60). A chuva medida do Cemaden só é coletada com `CEMADEN_EMAIL` e `CEMADEN_SENHA` no `../dados/.env` (DEC-045). Logs: `docker compose logs -f dados` |
| `front` | `vigia-front` | Interface em **http://localhost:8080**. O nginx repassa `/api` para a API |
| `mailpit` | `axllent/mailpit` (pública) | Caixa de entrada local em **http://localhost:8025**: recebe os e-mails de alerta (DEC-037) sem mandar nada para fora |

Entre no front com **admin@exemplo.gov.br** e a senha **vigia-admin**. `db`, `api`, `dados`, `front` e `mailpit` voltam sozinhos se o Docker reiniciar (`restart: unless-stopped`).

Os padrões servem só para rodar localmente. Para trocar qualquer um (senhas, `JWT_SECRET`, `ADMIN_*`, portas), crie um `.env` a partir do `.env.example`; o compose lê o `.env` desta pasta e o que estiver nele vence o padrão. Portas: `POSTGRES_PORT` (banco, 5432), `PORT` (API, 3000), `FRONT_PORT` (front, 8080) e `MAILPIT_PORT` (Mailpit, 8025).

### E-mail dos alertas

Cada alerta disparado ou escalonado vai por e-mail para todos os usuários ativos, um e-mail por pessoa (PR-027, PR-029, DEC-037). No compose, a API manda tudo para o Mailpit. Para usar um SMTP de verdade, preencha `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` e `SMTP_FROM` no `.env`. Fora do compose, sem `SMTP_HOST`, nenhum e-mail é enviado e a API só registra o aviso no log.

Para parar: `docker compose down`. Os dados ficam no volume `pg-data` e voltam no próximo `up`; só `docker compose down -v` apaga o banco.

### Publicar as imagens

Com `docker login` feito na conta `ravialmeida10`:

```bash
docker compose build
docker compose push db migrate dados front
```

O `migrate` e a `api` usam a mesma imagem, e o `db-init` usa a do `db`; por isso o push só cita um serviço de cada imagem.

### Dados de demonstração

Para apresentar o sistema, `npm run seed:demo` cria 4 usuários (`tecnico`, `gestor`, `gestao` e `comunicacao`, todos `@demo.vigia.local`, com a senha `DEMO_SENHA` do `.env`; no compose, padrão `vigia-demo`), parâmetros de chuva e calor e um mês de alertas encerrados com ações. Os valores são ilustrativos e as datas, relativas a hoje. Só roda no Postgres local, nunca no Neon, e só num banco sem parâmetros. Rodar de novo não duplica nada.

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

Dados inválidos respondem 422, com `message: "Dados inválidos"` e o detalhe por campo em `errors`.
