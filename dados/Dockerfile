# Agendador da pipeline (DEC-026): coleta e trata ao subir e de hora em hora.
# Roda o TypeScript com o tsx, como no desenvolvimento; por isso instala tudo.
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
USER node
CMD ["node", "--import", "tsx", "src/agendar.ts"]