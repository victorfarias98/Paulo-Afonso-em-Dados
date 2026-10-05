# Deploy no Coolify

Preparação no padrão dos frontends Baius, conferido em `baius-template-nextjs` e `landing-page`: `Makefile`, `compose.yaml` para desenvolvimento, Docker multi-stage, alvo `production`, porta interna `8080`, usuário sem privilégios e healthcheck. Este portal acrescenta Postgres e um worker de coleta.

A configuração está preparada localmente. Nenhum recurso foi criado ou publicado no Coolify por esta preparação.

Validação em 05/10/2026: imagens `production` e `production-worker` construídas; lint e typecheck aprovados; 266 testes passaram, incluindo integração em Postgres temporário. O worker aplicou migrations/seed como usuário sem privilégios e entrou no agendamento. O portal retornou 503 antes das migrations e 200 depois, com home e ilustração disponíveis e container `healthy`. As credenciais e o banco local existentes foram preservados.

## Recursos no Coolify

Use três recursos, no mesmo ambiente e com conexão pela rede interna:

| Recurso | Tipo                                | Build target            | Porta        | Domínio                   |
| ------- | ----------------------------------- | ----------------------- | ------------ | ------------------------- |
| Banco   | PostgreSQL 16                       | gerenciado pelo Coolify | 5432 interna | nenhum                    |
| Coletor | aplicação Dockerfile do repositório | `production-worker`     | nenhuma      | nenhum                    |
| Portal  | aplicação Dockerfile do repositório | `production`            | `8080`       | domínio público com HTTPS |

Nas duas aplicações: Base Directory `/`, Dockerfile Location `/Dockerfile`, branch do projeto. Deixe comandos de build/start/install vazios: o Dockerfile define tudo. O build sem alvo também termina em `production`. Os antigos alvos `web` e `worker` permanecem como aliases; o portal passou a ouvir `8080`.

Não selecione `compose.yaml` no Coolify: ele é o ambiente de desenvolvimento, com bind mounts e hot reload. `docker-compose.yml` permanece apenas para compatibilidade e testes locais das imagens.

Referências oficiais: [Dockerfile no Coolify](https://coolify.io/docs/applications/builds/dockerfile) e [healthchecks](https://coolify.io/docs/applications/configuration/health-checks).

## Variáveis

Use `.env.production.example` como referência para preencher a tela Environment Variables do Coolify. Não envie o `.env` local ao servidor. Marque estas variáveis como runtime; não precisam estar disponíveis no build e não devem virar build args.

| Variável                    | Portal      | Worker      | Valor                                                    |
| --------------------------- | ----------- | ----------- | -------------------------------------------------------- |
| `DATABASE_URL`              | obrigatória | obrigatória | URL **interna** do recurso Postgres, com o banco correto |
| `PORT`                      | `8080`      | não usar    | padrão da imagem                                         |
| `HOSTNAME`                  | `0.0.0.0`   | não usar    | padrão da imagem                                         |
| `ADMIN_USER`                | opcional    | não usar    | vazio desliga `/admin`                                   |
| `ADMIN_PASSWORD`            | opcional    | não usar    | mínimo 12 caracteres para habilitar admin                |
| `COLLECTOR_USER_AGENT`      | não usar    | obrigatória | identificação com contato real da Baius                  |
| `COLLECTOR_MIN_INTERVAL_MS` | não usar    | `2500`      | intervalo entre consultas à mesma fonte                  |
| `WORKER_DAILY_AT`           | não usar    | `05:00`     | hora local de Paulo Afonso                               |

`NODE_ENV=production`, `NEXT_TELEMETRY_DISABLED=1` (portal) e `TZ=America/Bahia` já estão nas imagens. Não configure `TEST_DATABASE_URL`, `BAIUS_PAD_PORT`, `POSTGRES_PORT` ou senhas de desenvolvimento nas aplicações de produção.

Copie a URL interna que o Coolify fornece. Usuário/senha com caracteres especiais precisam estar percent-encoded na URL; não monte a conexão concatenando a senha sem escape. O Postgres não precisa de porta pública. Configure backup agendado do banco no próprio recurso.

## Primeira subida

1. Crie o banco e configure as credenciais no Coolify. Confirme que as duas aplicações alcançam sua rede interna.
2. Suba o **worker primeiro**. O entrypoint exige `DATABASE_URL`, aplica migrations pendentes e cadastra as fontes oficiais. Os logs devem mostrar `Migrations aplicadas` e `fontes registradas`, depois o horário da próxima coleta. Não há dados fictícios no seed.
3. Suba o **portal** com alvo `production`, porta `8080` e domínio HTTPS. O healthcheck da imagem consulta `/api/health` e exige conexão ao banco e existência das tabelas principais. Banco vazio sem migrations retorna HTTP 503, não um falso sucesso.
4. Verifique `/api/health` (200), `/`, `/fontes` e uma ilustração em `/illustrations/civic-city.webp`. Confirme as fontes e a data da última coleta antes de divulgar o portal.

O Dockerfile já traz `HEALTHCHECK`, que o Coolify usa para a aplicação Dockerfile. Não adicione um segundo teste que confira apenas a home. O worker não serve HTTP; não configure domínio ou healthcheck HTTP nele. Deixe uma única réplica do worker e evite atualização com sobreposição de instâncias: pare o coletor antigo antes de iniciar o novo. Duas instâncias podem executar as mesmas coletas ou interferir nos pedidos do admin.

Para verificar no Terminal do portal:

```sh
wget -q -O - http://127.0.0.1:8080/api/health
```

Resposta esperada: `{"status":"ok"}`. Falhas retornam 503 com `{"status":"unavailable"}`, sem expor credenciais ou erros do banco. O worker encerra se migrations/seed falharem, em vez de continuar contra um schema incompleto.

## Primeira carga de dados

O worker agenda coleta diária e atende pedidos do admin; **não inicia automaticamente uma carga histórica completa** na primeira subida. Para uma carga controlada, execute no Terminal do worker (os comandos abaixo não são comandos de build):

```sh
pnpm worker siger:works
pnpm worker siger:bids
pnpm worker camara:contratos
pnpm worker camara:licitacoes
pnpm worker siger:contracts --max-details=200
pnpm worker despesas --fase=pagamentos --ano=2026 --months=1-9
pnpm worker camara:despesas --fase=pagamentos --ano=2026 --months=1-9
```

Repita lotes de contratos e ajuste ano/meses à data da publicação. Empenhos e liquidações usam os comandos de despesas com suas fases correspondentes. Evite coletas manuais concorrentes com a diária ou com pedidos do admin. Cada detalhe de contrato pesa cerca de 0,7 MB; não remova `--max-details` sem avaliar o volume de consulta.

A diária coleta obras, licitações, contratos (80 detalhes por dia), dados da Câmara e despesas do mês atual e anterior. Resultados e falhas aparecem em `/fontes` e `/admin`. Ainda não há alerta externo automático quando uma coleta falha.

## Autoria legislativa

A home inclui `apps/web/src/data/legislative-snapshot.json`, uma coleta completa e datada de matérias do SAPL. Essa seção **não é atualizada pelo worker diário**. Antes de publicar nova coleta:

```sh
make legislative YEAR=2026
```

Revise o snapshot e rode um novo build/deploy do portal. O comando preserva a versão anterior se houver erro ou coleta incompleta. Zero propostas só é afirmado com cobertura completa e vínculo de autoria conhecido. Projetos, requerimentos e total são separados; contagem não mede qualidade nem execução.

## Desenvolvimento e validação local

```sh
make init              # cria .env se faltar, sobe serviços, aplica migrations e seed
make logs
make lint
make typecheck
make test              # cria pad_test isolado e executa unitários + integração
make production-build  # imagem standalone do portal
make worker-build      # imagem de coleta
```

Portal local: `http://localhost:3104` (`BAIUS_PAD_PORT` pode trocar a porta no host). `make down` preserva os volumes. O volume Postgres `pad_pgdata` mantém o nome anterior; não use `down -v` para preparar um deploy. `.env` existente não é sobrescrito.

Também é possível desenvolver com Node 22 e pnpm no host usando `make db-up`, migrations e `pnpm dev` (porta 3000). No container, a conexão usa o host `postgres`; no host, use a URL local com `localhost` e `POSTGRES_PORT`.

## Operação

- Admin só é habilitado com ambas as credenciais válidas. Use HTTPS e limite tentativas no proxy.
- Banco e backups são persistentes; portal e worker não precisam de volume de dados de aplicação.
- A imagem do portal inclui servidor standalone, recursos estáticos e `public`; o build não lê o banco nem copia `.env`, `.aws`, `.codex` ou `.agents`.
- O worker mantém dependências e TypeScript para executar coletas e migrations; sua imagem é maior que a do portal.
- Reinício/redeploy do worker reaplica migrations pendentes e seed idempotente. Mudanças de schema precisam ser compatíveis com a versão do portal ainda em execução. Faça backup antes de alterações estruturais.
- O `.env` local usa senha de desenvolvimento apenas para Postgres local. Produção usa credenciais próprias do recurso Coolify.
- CSP e demais cabeçalhos estão ativos. Limite de requisições no proxy, revisão independente de segurança e teste de restauração de backup continuam necessários na operação de produção.

## PostHog no runtime

O portal pode reutilizar o projeto central da Baius no domínio `pauloafonsoemdados.baiustecnologia.com.br`. Configure no recurso **web**, como variáveis de runtime, `POSTHOG_PROJECT_TOKEN` (token público do projeto), `POSTHOG_HOST=https://us.i.posthog.com` e `POSTHOG_ENABLED=true`. Não use chave pessoal ou administrativa, não configure essas variáveis no worker e não adicione build args. Os exemplos versionados deixam o token vazio; o Compose de desenvolvimento mantém a captura desligada.

Reinicie o portal depois de alterar as variáveis. A configuração sai do layout no runtime e a CSP permite somente conexões à origem HTTPS validada. Sem configuração válida, o portal funciona com analytics desligado. Verifique eventos no PostHog com `site=paulo_afonso_em_dados` e o domínio esperado. O mapa de eventos, receitas de dashboard e limites de privacidade estão em [analytics.md](analytics.md). Nenhum dashboard ou recurso remoto foi criado por esta implementação.
