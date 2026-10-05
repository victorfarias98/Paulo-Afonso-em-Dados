# Arquitetura — Paulo Afonso em Dados

> **Rascunho da Etapa 2**, aguardando aprovação. Baseado nos achados de [data-sources.md](./data-sources.md).
> Itens marcados **DECISÃO** dependem de confirmação.

## 1. Princípios

1. **Rastreabilidade antes de cobertura.** Nenhum número aparece sem caminho até o payload original.
2. **Dado bruto é imutável.** Normalização é reprocessável a partir de `raw_records`.
3. **Fonte oficial nunca é sobrescrita.** Correções manuais ficam em tabela própria, com justificativa.
4. **Relacionamento incompleto é estado válido**, com método e confiança registrados.
5. **Falha visível.** Mudança de layout na fonte gera erro e alerta, não dado silenciosamente errado.

## 2. Visão geral

```
 Fontes oficiais                 Worker (Node/TS)                    PostgreSQL                 Web (Next.js)
┌────────────────┐   fetch   ┌──────────────────────┐   insert   ┌──────────────┐   SELECT   ┌───────────────┐
│ SIGER (HTML/CSV)│ ───────▶ │ 1. coletor por fonte │ ─────────▶ │ raw_records  │            │ Server        │
│ PNCP (JSON)     │          │ 2. parser + schema   │            │ (append-only)│            │ Components    │
│ Município Online│          │ 3. normalizador      │ ─ upsert ▶ │ entidades    │ ─────────▶ │ /contratos    │
│ SAI (JSON)      │          │ 4. associador        │            │ entity_links │            │ /obras  …     │
└────────────────┘           │ 5. agendador         │            │ ingestion_*  │            │ /admin        │
                             └──────────────────────┘            └──────────────┘            └───────────────┘
```

- **Web** só lê entidades normalizadas; nunca chama as fontes.
- **Worker** é processo separado, com o mesmo código de banco (`packages/database`).
- Coleta e normalização são **dois passos independentes**: é possível re-normalizar sem coletar de novo.

## 3. Stack

| Camada | Escolha | Motivo |
|--------|---------|--------|
| Web | Next.js (App Router) + TypeScript strict + Tailwind | SSR/Server Components, SEO por página |
| Banco | PostgreSQL 16 | `jsonb`, índices parciais, busca textual `pt` + `pg_trgm`/`unaccent` |
| ORM | **Drizzle** | ver §3.1 |
| Coleta | **TypeScript/Node** em todas as fontes | ver §3.2 |
| Validação | Zod | um schema por payload de fonte |
| Fila/agenda | `pg-boss` (fila no próprio Postgres) | sem Redis; reexecução, retry e cron por fonte |
| Mapas | MapLibre GL + tiles OpenStreetMap | sem Google Maps |
| Gráficos | Recharts | suficiente para barras/linhas simples |
| Testes | Vitest + Playwright | normalizadores com fixtures reais gravadas |
| Infra | Docker Compose → Coolify | web, worker, postgres |

### 3.1 Drizzle em vez de Prisma

- O modelo depende de recursos de Postgres que o Drizzle expressa direto e o Prisma só via SQL cru: índices parciais (`WHERE source_missing_since IS NULL`), índices GIN em `jsonb`/`tsvector`, `ON CONFLICT … DO UPDATE` com condição por hash.
- As agregações do dashboard são SQL analítico; o query builder do Drizzle é SQL tipado, sem camada de abstração a contornar.
- Sem engine binária nem etapa de `generate`: imagem Docker menor e o mesmo pacote roda no web e no worker.
- Migrations são arquivos `.sql` versionados e revisáveis — relevante para um projeto que precisa ser auditável.
- Custo assumido: menos conveniência em relações aninhadas e ecossistema menor que o do Prisma.

### 3.2 Uma linguagem só para a coleta

As quatro fontes do MVP são JSON, HTML renderizado no servidor e CSV. Nenhuma exige browser headless nem extração de PDF. TypeScript com `fetch` + `cheerio` + `csv-parse` cobre tudo e compartilha tipos e schemas com o resto do monorepo. Python só entra se uma fonte futura exigir extração de PDF (Diário Oficial).

### 3.3 Banco: Supabase ou Postgres próprio — **DECISÃO**

O projeto usa apenas Postgres padrão. Recomendação: **Postgres em contêiner no Coolify** (mesmo ambiente do app, sem dependência externa, backup controlado). Supabase hospedado continua possível trocando só a `DATABASE_URL`; nenhuma funcionalidade específica dele (Auth, Realtime, RLS no cliente) é usada.

## 4. Estrutura do repositório

```
paulo-afonso-em-dados/
├── apps/
│   ├── web/                 # Next.js: portal público + /admin
│   └── worker/              # agendador e execução dos importers
├── packages/
│   ├── database/            # schema Drizzle, migrations SQL, queries
│   ├── data-sources/        # um diretório por fonte: client, parser, schema, fixtures
│   │   ├── siger/
│   │   ├── pncp/
│   │   ├── municipio-online/
│   │   └── sai/
│   ├── domain/              # normalizadores, regras de status, associação (puro, sem I/O)
│   └── shared/              # formatação (moeda, CNPJ, datas), tipos comuns
├── docker/
├── docs/
├── scripts/
├── docker-compose.yml
└── README.md
```

Mudanças em relação à sugestão inicial:

- **`packages/domain` adicionado.** Regras de status e normalização ficam puras e testáveis, separadas de quem busca dados.
- **`packages/ui` adiado.** Com um único app consumidor, componentes ficam em `apps/web/components` até existir um segundo.

## 5. Modelo de dados — revisão da proposta

### 5.1 O que muda e por quê

| # | Mudança | Motivo (achado do discovery) |
|---|---------|------------------------------|
| 1 | `raw_records` vira **versionado e append-only**: nova linha a cada mudança de `payload_hash`; `first_seen_at`, `last_seen_at`, `source_url`, `fetch_method` | fontes municipais não têm data de atualização; o histórico de versões é o registro de que algo mudou |
| 2 | Nova tabela **`record_provenance`** (entidade ↔ raw_record, N:N) em vez de um único `source_id` por linha | o mesmo contrato existe no SIGER e no PNCP |
| 3 | Nova tabela **`entity_links`** com `method`, `confidence`, `evidence` | relações obra↔contrato↔licitação↔empenho têm origens e certezas diferentes |
| 4 | `expenses` dividida em **`commitments`**, **`liquidations`**, **`payments`** | a fonte publica as três fases como listagens separadas |
| 5 | `contracts.kind` (contrato, ata de registro de preços, termo de colaboração…) | o SIGER mistura "CONTRATO" e "ATA" na mesma lista |
| 6 | `source_status` (texto da fonte) separado de `status` (derivado por regra) em obras, contratos e licitações | "Vencido"/"Em Andamento" vêm da fonte; "prazo vencido" é regra nossa |
| 7 | `agencies` ganha `parent_id`, `branch` e tabela **`agency_aliases`** | nome da secretaria difere entre SIGER, PNCP e despesas |
| 8 | `suppliers` ganha `document_masked`, `name_normalized`; CPF nunca armazenado completo | a Câmara publica documento mascarado; LGPD |
| 9 | `public_works`: `deadline_days`, `expected_end_date_derived`; endereços em **`public_work_addresses`**; coordenadas em **`geocodings`** com origem | a fonte tem prazo em dias, vários endereços e nenhuma coordenada |
| 10 | Novas **`documents`**, **`manual_overrides`**, **`source_datasets`** | anexos PDF; correções auditáveis; agenda e estado por fonte+entidade |
| 11 | `source_missing_since` em todas as entidades normalizadas | requisito de integridade |
| 12 | Valores em `numeric(16,2)`; datas como `date`; `timestamptz` para eventos | evitar erro de ponto flutuante e fuso |

### 5.2 Tabelas

**Infraestrutura de ingestão**

- `sources` — id, slug, name, agency_name, source_type (`api` \| `html` \| `csv` \| `xml`), base_url, official, documented, notes.
- `source_datasets` — id, source_id, entity_type, schedule_cron, enabled, last_success_at, last_run_id.
- `ingestion_runs` — id, source_dataset_id, trigger (`schedule` \| `manual`), started_at, finished_at, status, records_found/created/updated/unchanged/failed/missing, error_summary, log.
- `raw_records` — id, source_id, entity_type, external_id, source_url, fetch_method, payload (`jsonb`), payload_hash, first_seen_at, last_seen_at, first_run_id, source_updated_at, import_status, import_error. Único: (source_id, entity_type, external_id, payload_hash).
- `record_provenance` — entity_type, entity_id, raw_record_id, is_primary, transformations (`jsonb`: lista do que o normalizador alterou).

**Domínio**

- `agencies`, `agency_aliases`
- `suppliers`
- `bids`
- `contracts`, `contract_amendments`, `contract_agencies`, `contract_budget_lines`
- `public_works`, `public_work_addresses`, `geocodings`
- `commitments`, `liquidations`, `payments`
- `documents` — entity_type, entity_id, title, source_url, content_hash.

**Relações e auditoria**

- `entity_links` — from_type, from_id, to_type, to_id, relation, method, confidence, evidence (`jsonb`), created_by, created_at, revoked_at.
- `manual_overrides` — entity_type, entity_id, field, original_value, corrected_value, justification, user_id, created_at.
- `admin_users`, `admin_audit_log`.

O detalhamento coluna a coluna vai em `docs/data-model.md` na Etapa 3, junto com as migrations.

## 6. Ingestão

1. **Coletar** — o client da fonte busca a página/arquivo e produz itens `{ externalId, sourceUrl, payload }`.
2. **Gravar bruto** — calcula SHA-256 do payload canonicalizado. Hash igual: só atualiza `last_seen_at`. Hash novo: insere nova versão.
3. **Validar** — schema Zod da fonte. Falha → `import_status = failed` com a mensagem; a entidade normalizada anterior permanece.
4. **Normalizar** — função pura `raw → entidade`, registrando cada transformação (ex.: `"R$ 150.000,00" → 150000.00`).
5. **Upsert** — por chave natural da fonte; grava `record_provenance`.
6. **Ausentes** — registros da fonte não vistos numa varredura **completa e bem-sucedida** recebem `source_missing_since`. Varredura parcial ou com erro nunca marca ausência.
7. **Associar** — gera/atualiza `entity_links`.
8. **Fechar a execução** — contadores e status em `ingestion_runs`.

**Disjuntor:** se uma execução encontrar menos de 50% dos registros da anterior, ela é marcada como `suspect`, não aplica `source_missing_since` e gera alerta no admin.

**Frequência:** cron por `source_datasets`, padrão 1×/dia por entidade, configurável.

## 7. Deduplicação

- **Dentro da fonte:** (source_id, entity_type, external_id).
- **Entre fontes:** entidades **não são fundidas automaticamente**. Cada fonte gera sua visão; a entidade canônica é escolhida por prioridade de fonte por campo, e as demais ficam ligadas via `record_provenance`. Divergências de valor entre fontes são exibidas, não escondidas.
- **Fornecedores:** chave = CNPJ completo quando existe. Sem documento (ou mascarado), fica como fornecedor separado com candidato a fusão para revisão no admin — nunca fusão automática só por nome.

## 8. Relacionamentos e confiança

| Método | Confiança | Exemplo |
|--------|-----------|---------|
| `source_fk` | alta | obra do SIGER com `id_contrato` preenchido |
| `official_id` | alta | contrato PNCP → compra via `numeroControlePncpCompra` |
| `number_match` | média | mesmo número/ano de contrato entre SIGER e PNCP + mesmo fornecedor |
| `heuristic` | baixa | fornecedor + valor + período compatíveis |
| `manual` | manual | associação feita no admin, com justificativa |

O portal exibe o método de cada vínculo. Vínculos `heuristic` não entram em totais do dashboard.

## 9. Segurança e LGPD

- Portal público sem login; `/admin` com autenticação por sessão, cookies `HttpOnly`, rate limit no login.
- Todo acesso ao banco via query parametrizada (Drizzle); entrada validada com Zod.
- Segredos apenas em variáveis de ambiente do servidor; nada `NEXT_PUBLIC_` sensível.
- CSP, HSTS e demais headers configurados no Next.js.
- CPF: nunca exibido nem armazenado completo; pessoa física aparece com nome e documento mascarado, apenas no contexto do contrato/pagamento.
- Folha de pagamento e servidores ficam fora do escopo.
- Decisões envolvendo dados pessoais são registradas em `docs/methodology.md`.

## 10. Riscos

| Risco | Severidade | Mitigação |
|-------|------------|-----------|
| Fontes municipais sem API documentada; layout muda sem aviso | Alta | schemas estritos, fixtures gravadas, disjuntor, alerta no admin |
| Listagem de contratos do SIGER com ~3,2 MB por página | Média | CSV para detectar mudança; detalhe só do que mudou |
| Bloqueio por Cloudflare/WAF | Média | baixa frequência, User-Agent identificado, contato prévio com o órgão |
| CNPJ mascarado na Câmara e possivelmente ausente no SIGER | Alta | PNCP como fonte do documento; sem fusão automática por nome |
| Elo contrato → empenho → pagamento pode não existir na fonte | Alta | verificar antes da Etapa 8; relação fica "informação insuficiente" |
| Divergência de valores entre SIGER e PNCP | Média | mostrar ambas as fontes; nunca escolher em silêncio |
| Obras sem coordenadas | Baixa | geocodificação por bairro, marcada como aproximada |
| Interpretação política de um dado errado | Alta | metodologia pública, link para a fonte em cada página, canal de correção |

## 11. Decisões

Confirmadas em 2026-10-04:

1. Repositório próprio.
2. PostgreSQL em contêiner (sem Supabase).
3. Primeiro importer: contratos do SIGER; PNCP entra em seguida como conferência.
4. Câmara Municipal faz parte do MVP.
5. Contato público do projeto: `contato@baiustecnologia.com.br` (usado no User-Agent do coletor).
6. Pedido via e-SIC sobre API oficial: adiado.

Em aberto: licença do código e dos dados derivados; nome e domínio definitivos.

## Interface

A identidade visual é a da Baius Tecnologia, a mesma da landing page: fundo creme, tinta
azul-marinho e um único destaque azul, com a fonte Geist. Os tokens ficam em
`apps/web/src/app/globals.css` (claro e escuro, pelo tema do sistema).

- **Celular primeiro.** A faixa de seções rola de lado e acompanha a rolagem; alvos de toque têm
  ao menos 44 px; campos usam fonte de 16 px para o iOS não dar zoom.
- **Filtros** (`components/filter-bar.tsx`): um componente só para todas as listas. A busca fica
  sempre visível; os demais filtros ficam num painel recolhido no celular e aberto em telas
  largas; escolher uma opção já aplica o filtro; cada filtro ativo vira uma etiqueta removível.
  Sem JavaScript o formulário continua funcionando.
- **Insights da página inicial** (`lib/insights.ts`): todos são somas e contagens sobre os
  registros importados, cada um com link para a lista que o compõe. Nenhum é estimativa nem
  avaliação.
- **Movimento:** só as barras dos gráficos crescem ao entrar na tela (GSAP, em
  `components/reveal.tsx`), e nada se move com "reduzir movimento" ligado.
