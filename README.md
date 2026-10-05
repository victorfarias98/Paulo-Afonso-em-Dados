# Paulo Afonso em Dados

Portal cívico, independente e apartidário que organiza dados públicos do município de
Paulo Afonso-BA — contratos, licitações, obras e despesas — com a fonte oficial de cada
informação.

> **Estado atual:** contratos da Prefeitura funcionando de ponta a ponta — coleta, banco e
> páginas do portal. Veja [o que já existe](#o-que-já-existe).

## Como rodar

Requisitos: Docker com Compose e GNU Make. O ambiente segue o padrão Baius:

```bash
make init                # cria .env sem sobrescrever, sobe Postgres + web, aplica migrations e seed
make logs
```

O portal abre em **http://localhost:3104**. Veja todos os comandos com `make help`.
`make down` para os serviços e mantém os volumes. Para rodar Next no host, use Node 22+ e pnpm 10+ com `make db-up`, `pnpm install`, migrations e `pnpm dev` (porta 3000).

Coletar contratos reais do SIGER (Prefeitura), em lote pequeno:

```bash
pnpm worker siger:contracts --max-pages=1 --max-details=5
pnpm worker siger:works        # as 35 obras; é pequeno, pode rodar inteiro
pnpm worker siger:bids         # 631 licitações; cerca de 30 minutos
pnpm worker despesas --fase=pagamentos --ano=2026 --months=1-9   # ou empenhos, liquidacoes
pnpm worker despesas:reprocessar   # refaz a normalização a partir dos registros brutos
pnpm worker camara:contratos       # contratos da Câmara Municipal
pnpm worker coletar:tudo           # todas as coletas, uma vez
```

Comandos de coleta dentro do container: `make worker CMD="siger:works"`.
Os exemplos `pnpm worker` acima também funcionam no host com `DATABASE_URL` local configurada.

- `--max-pages` limita as páginas da listagem (20 contratos por página, mais recentes primeiro).
- `--max-details` limita quantos contratos têm o detalhe buscado nesta execução.
- Sem os limites, a listagem inteira é varrida e todos os detalhes são buscados. São ~1.340
  contratos de ~0,7 MB cada: prefira lotes, para não sobrecarregar a fonte.

## Testes

```bash
make test                 # unitários + integração em pad_test, separado do banco local
make typecheck
make lint
make production-build
make worker-build
```

Os testes de integração usam `pad_test`, criado por `make test-db`; é esvaziado a cada teste. Não aponte `TEST_DATABASE_URL` para o banco do portal.

## Coolify

Crie PostgreSQL 16 e duas aplicações Dockerfile: portal com alvo `production`, porta **8080**, e coletor com alvo `production-worker`, sem domínio. Configure variáveis de runtime conforme [.env.production.example](.env.production.example). Suba o worker primeiro para aplicar migrations; o portal só fica saudável quando `/api/health` responde 200.

Veja a configuração completa e a primeira carga em [docs/deployment.md](docs/deployment.md). `compose.yaml` é exclusivamente para desenvolvimento; não selecione esse arquivo no Coolify.

## Estrutura

```
apps/web               portal público (Next.js)
apps/worker            coleta, normalização e gravação
packages/database      schema Drizzle, migrations SQL, cadastro das fontes
packages/data-sources  cliente HTTP e parsers de cada fonte oficial
packages/domain        regras puras: conversões, fornecedor, situação do contrato
docs/                  fontes de dados, arquitetura, regras de situação e metodologia
```

## O que já existe

| Etapa                                       | Situação                                                                                                                                       |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Levantamento das fontes                  | Feito — [docs/data-sources.md](docs/data-sources.md)                                                                                           |
| 2. Arquitetura                              | Feito — [docs/architecture.md](docs/architecture.md)                                                                                           |
| 3. Banco de dados                           | Feito — 24 tabelas, migration versionada                                                                                                       |
| 4. Primeiro importador (contratos do SIGER) | Feito — da fonte até o portal                                                                                                                  |
| 5. Páginas de contratos                     | Feito — `/contratos` e `/contratos/[id]`; faltam aditivos e revisão visual                                                                     |
| 6. Obras                                    | Feito — `/obras` e `/obras/[id]`, ligadas ao contrato quando a fonte indica                                                                    |
| 7. Licitações                               | Feito — `/licitacoes` e `/licitacoes/[id]`, ligadas a contratos e obras                                                                        |
| 8. Despesas                                 | Feito — `/gastos` e `/gastos/registros` (empenhado, liquidado, pago)                                                                           |
| 9. Painel e portal                          | Feito — página inicial, `/fornecedores`, `/fontes`, `/busca`                                                                                   |
| Câmara Municipal                            | Feito — 176 contratos, na mesma lista de contratos                                                                                             |
| Agendamento e imagens Docker                | Feito — `pnpm worker agendar`; ver [docs/deployment.md](docs/deployment.md)                                                                    |
| Admin                                       | Feito — `/admin`, com senha (`ADMIN_USER` e `ADMIN_PASSWORD`): alertas, pedido de coleta, vínculo manual obra ↔ contrato e correções auditadas |
| Modelo de dados e coleta                    | [docs/data-model.md](docs/data-model.md), [docs/ingestion.md](docs/ingestion.md)                                                               |
| Câmara                                      | Feito — contratos, licitações e despesas, separados da Prefeitura em todas as somas                                                            |
| Pendente                                    | Importador do PNCP, deploy em servidor, alerta por e-mail, limite de requisições, revisão de segurança independente                            |

## Princípios da coleta

- O dado original de cada registro é guardado sem alteração, com URL, data e hash.
- Mudança na fonte gera nova versão do registro bruto; nada é sobrescrito.
- Registro que some da fonte é marcado (`source_missing_since`), nunca apagado.
- CPF nunca é armazenado completo.
- O coletor se identifica (`PauloAfonsoEmDados/0.1 (+contato@baiustecnologia.com.br)`),
  faz uma requisição por vez e espera entre elas.

## Vídeo de apresentação

Peça de 60 segundos com narração em português, trilha original e composições vertical e horizontal. Os arquivos, as instruções de render e as licenças dos assets ficam em [video/README.md](video/README.md); o roteiro e a legenda para Instagram estão em [docs/video-script.md](docs/video-script.md). O pacote de vídeo é separado das dependências e do Docker do portal.

Contato: contato@baiustecnologia.com.br
