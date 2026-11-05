# =============================================================================
# CUIDAR+ backend — imagem Docker
#
# O banco NÃO roda aqui: é o PostgreSQL do Supabase (na nuvem).
# A configuração (DATABASE_URL, chaves) entra por variáveis de ambiente
# (docker-compose lê o backend/.env). Nenhum segredo vai para dentro da imagem.
# =============================================================================
FROM node:22-alpine

WORKDIR /app
# NODE_ENV vem do backend/.env (development ou production). Não definimos aqui
# de propósito: com NODE_ENV=production o npm pularia o tsx (devDependency).
ENV HOST=0.0.0.0 \
    PORT=3333

# Dependências primeiro (aproveita o cache do Docker).
# O tsx (executa TypeScript) está nas devDependencies, por isso instala tudo.
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi \
    && npm cache clean --force

COPY tsconfig.json ./
COPY src ./src
COPY migrations ./migrations

# Não roda como root.
RUN chown -R node:node /app
USER node

EXPOSE 3333

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/v1/health" || exit 1

# Sem --env-file: dentro do container as variáveis já vêm do Docker.
CMD ["node_modules/.bin/tsx", "src/server.ts"]
