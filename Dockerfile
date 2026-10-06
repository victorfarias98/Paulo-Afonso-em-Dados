# Padrão Baius: development local; production (8080) para o Coolify.
# production-worker é um recurso separado, sem domínio.
FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
RUN npm install --global pnpm@10.34.6
WORKDIR /app

FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
COPY packages/database/package.json packages/database/
COPY packages/data-sources/package.json packages/data-sources/
COPY packages/domain/package.json packages/domain/
RUN pnpm install --frozen-lockfile

FROM dependencies AS source
COPY . .

FROM source AS development
ENV NODE_ENV=development
EXPOSE 3104
CMD ["pnpm", "--filter", "@pad/web", "exec", "next", "dev", "--hostname", "0.0.0.0", "--port", "3104"]

FROM source AS builder
# Nenhuma credencial de banco é necessária no build.
RUN pnpm --filter @pad/web build

FROM source AS production-worker
ENV NODE_ENV=production TZ=America/Bahia
# A imagem Node já inclui um usuário sem privilégios. Evitar chown recursivo aqui
# reduz vários minutos de I/O sobre todo o monorepo e node_modules no Coolify.
RUN chmod +x /app/docker/worker-entrypoint.sh
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD kill -0 1 || exit 1
ENTRYPOINT ["/app/docker/worker-entrypoint.sh"]
CMD ["pnpm", "worker", "agendar"]

# Compatibilidade com os alvos usados antes da padronização.
FROM production-worker AS worker

FROM node:22-alpine AS web
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=8080 HOSTNAME=0.0.0.0 TZ=America/Bahia
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY --from=builder --chown=app:app /app/apps/web/.next/standalone ./
COPY --from=builder --chown=app:app /app/apps/web/.next/static ./apps/web/.next/static
# public não é copiado automaticamente pelo servidor standalone.
COPY --from=builder --chown=app:app /app/apps/web/public ./apps/web/public
USER app
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=6 \
  CMD wget -q -O /dev/null "http://127.0.0.1:${PORT}/api/health" || exit 1
CMD ["node", "apps/web/server.js"]

# Sem --target, o Docker/Coolify constrói o portal, nunca o coletor.
FROM web AS production
