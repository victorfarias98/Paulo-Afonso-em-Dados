# Coleta de dados

A coleta roda no `apps/worker`. Cada fonte tem um cliente em `packages/data-sources` (só busca e
interpreta) e um importador no worker (grava). As regras de cada fonte estão em
[data-sources.md](data-sources.md).

## Fluxo de uma coleta

```
listagem da fonte
   ↓ um registro por vez, com intervalo entre requisições
registro bruto (raw_records)      ← payload original + hash SHA-256 + URL
   ↓ normalizador (função pura)
entidade normalizada + record_provenance (com as transformações)
   ↓
registros ausentes da listagem → source_missing_since
   ↓
vínculos entre entidades (entity_links)
   ↓
ingestion_runs: contagens, situação, erros
```

O fluxo comum está em `apps/worker/src/pipeline/run-import.ts`. As despesas têm um fluxo próprio
(por mês) em `municipio-online/import-expenses.ts`.

## Comportamento perante a fonte

- Identifica-se pelo `COLLECTOR_USER_AGENT`, com e-mail de contato.
- Uma requisição por vez, com intervalo mínimo de `COLLECTOR_MIN_INTERVAL_MS` (padrão 2,5 s).
- Só lê páginas públicas, as mesmas que qualquer cidadão abre no navegador.
- O detalhe de contrato do SIGER pesa cerca de 0,7 MB (às vezes 3 MB); por isso os contratos são
  conferidos em lotes diários, e não todos de uma vez.

## Regras de integridade

| Situação | O que acontece |
|----------|----------------|
| Conteúdo igual ao da última coleta | Nenhuma versão nova; só `last_seen_at` avança |
| Conteúdo mudou | Nova linha em `raw_records`; a entidade é atualizada |
| Registro não pôde ser interpretado | O bruto fica como `failed`, com o erro; a coleta segue e termina como `partial` |
| Registro sumiu de uma varredura completa | `source_missing_since` recebe a data; nada é apagado |
| Varredura trouxe menos de 50% da anterior | Situação `suspect`; **ninguém** é marcado como ausente |
| Varredura parcial (`--max-pages`) | Não marca ausentes |
| Mês de despesa voltou vazio | Não marca ausentes |
| Mesmo identificador duas vezes na mesma coleta | Erro; nada é sobrescrito |

Registros fora da listagem mas citados por outro registro (os termos aditivos e contratos que as
obras citam) são buscados pelo id a cada coleta de contratos e nunca são marcados como ausentes
por faltarem na listagem.

## Agenda

`pnpm worker agendar` fica em execução e, todo dia no horário de `WORKER_DAILY_AT` (hora de Paulo
Afonso), roda nesta ordem: obras, licitações, contratos da Prefeitura (listagem completa e 80
detalhes: primeiro os nunca importados, depois os conferidos há mais tempo), contratos e
licitações da Câmara, e empenhos, liquidações e pagamentos do mês atual e do anterior, primeiro
da Prefeitura e depois da Câmara. A falha de uma coleta não impede
as seguintes.

Entre uma coleta diária e outra, o worker consulta a cada minuto a fila `collection_requests`,
onde o admin registra pedidos de coleta, e executa um pedido por vez. Um pedido que estava em
execução quando o worker foi reiniciado é encerrado como falha.

## Comandos

```bash
pnpm worker siger:works
pnpm worker siger:bids
pnpm worker siger:contracts --max-details=80     # --max-pages=N limita a listagem
pnpm worker camara:contratos
pnpm worker camara:licitacoes
pnpm worker despesas --fase=pagamentos --ano=2026 --months=1-9   # empenhos | liquidacoes
pnpm worker camara:despesas --fase=pagamentos --ano=2026 --months=1-9
pnpm worker despesas:reprocessar   # refaz a normalização a partir dos brutos, sem tocar a fonte
pnpm worker coletar:tudo           # o mesmo que a coleta diária, uma vez
pnpm worker agendar
```

## Como saber que algo quebrou

- Página pública **Fontes**: última coleta e situação de cada conjunto de dados.
- **Admin**: alerta quando a última coleta de um conjunto não terminou bem ou quando ele está há
  mais de 36 horas sem coleta concluída; lista dos registros que falharam, com o erro.
- Ainda **não há** aviso ativo (e-mail ou similar): é preciso abrir o admin.

## Acrescentar uma fonte

1. Verifique a fonte e registre o que foi visto em `data-sources.md`. Não presuma campos.
2. Guarde uma resposta real como fixture e escreva o parser em `packages/data-sources`, com teste.
3. Cadastre a fonte e seus conjuntos em `packages/database/src/sources-registry.ts`.
4. Escreva o normalizador (função pura, devolvendo as transformações) e o importador, com teste de
   integração.
5. Antes de escolher o identificador externo, confira na fonte que ele é único.
