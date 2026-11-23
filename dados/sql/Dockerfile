# Banco do Vigia: PostgreSQL 17 com os schemas app, bronze e gold.
# O entrypoint do postgres roda o schema.sql só quando o volume está vazio; o
# serviço db-init do compose roda o mesmo arquivo a cada subida, para aplicar o
# que mudou depois (o SQL é idempotente).
FROM postgres:17-alpine
COPY schema.sql /docker-entrypoint-initdb.d/10-schema.sql