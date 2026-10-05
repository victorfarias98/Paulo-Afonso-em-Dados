# Modelo de dados

O esquema fica em `packages/database/src/schema` (Drizzle) e as migrations versionadas em
`packages/database/migrations`. São três grupos de tabelas: **ingestão** (o que veio da fonte),
**domínio** (o dado normalizado que o portal exibe) e **auditoria** (o que pessoas fizeram no
admin).

## Princípios

- **O dado original nunca é alterado nem apagado.** Cada registro coletado fica em `raw_records`,
  uma linha por versão de conteúdo.
- **Todo registro normalizado aponta para a sua origem** por `record_provenance`, que também
  guarda as transformações aplicadas (por exemplo, `"454.404,56"` → `454404.56`).
- **Registro que some da fonte não é apagado:** recebe `source_missing_since` e sai das somas.
- **Vínculos entre entidades são explícitos** em `entity_links`, com método e nível de confiança.
- **Correção humana não substitui o dado oficial:** fica em `manual_overrides`, ao lado dele.

## Ingestão

| Tabela | Para quê |
|--------|----------|
| `sources` | Fontes oficiais (SIGER, Município Online, API da Câmara, PNCP), com URL e órgão |
| `source_datasets` | Um conjunto de dados por fonte e tipo de entidade; guarda `last_success_at` |
| `ingestion_runs` | Cada execução de coleta: início, fim, contagens, situação, erros e log |
| `raw_records` | Registro bruto versionado: `payload` (JSON), `payload_hash` (SHA-256), URL, método de obtenção, primeira e última vez em que foi visto, situação da importação |
| `record_provenance` | Liga a entidade normalizada ao registro bruto e lista as transformações |

`raw_records` é somente-inserção: a chave única é fonte + tipo + id externo + hash. Se o conteúdo
não mudou, só `last_seen_at` é atualizado; se mudou, entra uma linha nova.

## Domínio

| Tabela | Conteúdo | Observações |
|--------|----------|-------------|
| `agencies`, `agency_aliases` | Órgãos e o nome de cada um em cada fonte | `branch`: executivo ou legislativo |
| `suppliers` | Fornecedores e credores | CNPJ completo; CPF **sempre mascarado** (ver abaixo) |
| `bids` | Licitações | |
| `contracts` | Contratos, atas e termos aditivos | `kind`: `contrato`, `ata_registro_precos`, `termo_aditivo`, `outro` |
| `contract_agencies`, `contract_budget_lines` | Secretarias e dotações do contrato | |
| `contract_amendments` | Reservada | Vazia: ver "Aditivos" abaixo |
| `public_works`, `public_work_addresses` | Obras e seus endereços | Guarda também o id e o número do contrato e da licitação como a fonte publica |
| `geocodings` | Coordenadas derivadas | Vazia: a fonte não publica coordenadas |
| `commitments`, `liquidations`, `payments` | Empenhos, liquidações e pagamentos | Valores de anulação, reforço e retenção em colunas próprias |
| `documents` | Anexos publicados pela fonte | Só o endereço; o arquivo não é copiado |

Colunas comuns a toda entidade vinda de fonte oficial: `source_id`, `external_id`, `source_url`,
`source_status` (situação como a fonte informa), `source_missing_since`, `last_seen_at`.

### Identificadores externos

| Entidade | `external_id` |
|----------|---------------|
| Contrato, obra e licitação do SIGER | id interno do SIGER |
| Contrato da Câmara | `Origem:Código:Número` (o código sozinho se repete) |
| Licitação da Câmara | `Tabela:Detalhes` (o número da licitação se repete entre modalidades) |
| Empenho, liquidação, pagamento | `CNPJ da unidade gestora:Chave` (a chave sozinha se repete entre unidades) |

### Prefeitura e Câmara

As despesas das duas vêm da mesma plataforma, por endereços diferentes, e ficam nas mesmas tabelas
sob **fontes distintas** (`municipio-online-pmpa` e `municipio-online-cmpa`). Toda soma do portal
é feita por fonte: os valores da Prefeitura e da Câmara nunca são somados entre si, exceto na
página de um fornecedor, que mostra tudo o que ele recebeu e diz isso. Licitações e contratos são
separados pelo órgão (`agencies.branch`).

Licitações da Câmara: a API manda `0` quando o valor não foi informado; `0` vira "não informado".
O valor estimado veio zerado em todos os registros conferidos; o valor homologado, quando existe,
fica em `bids.homologated_value`. A data usada é a da licitação, porque a de publicação não vem.

### Valores de despesa

O portal sempre soma o valor **líquido**:

- empenhado = empenhado + reforçado − anulado;
- liquidado = liquidado − anulado;
- pago = pago − anulado.

### Aditivos

No SIGER, um termo aditivo é um registro de contrato próprio (número como
`1 ADT-277/2024/2025`), que não aparece na listagem pública de contratos, mas tem página de
detalhe. Por isso ele é guardado em `contracts` com `kind = 'termo_aditivo'`, e não em
`contract_amendments`.

Limites conhecidos:

- só são importados os termos aditivos que alguma obra cita, porque é a única forma verificada de
  descobrir o id deles;
- a fonte não indica, na página do termo, qual é o contrato original; esse vínculo não existe no
  portal;
- não se sabe se o valor do termo é o acréscimo ou o novo total, então termos aditivos **ficam
  fora das somas** de valor contratado;
- o campo de ordem do aditivo vem como "1º" mesmo em registros numerados "4 ADT" e "6 ADT"; ele é
  usado apenas para reconhecer que o registro é um aditivo, e não é exibido;
- a aba "Aditivos" da página do contrato (`VwAditivosListExterno`) respondeu vazia nos quatro
  contratos testados em 2026-10-05; não foi encontrada forma de listar os aditivos de um contrato.

Obras também citam contratos comuns que estão fora da listagem pública (5 casos). Eles são
importados do mesmo jeito e ficam com `kind = 'outro'`, porque o tipo só é publicado na listagem.

## Vínculos (`entity_links`)

| De → para | Método | Confiança | Regra |
|-----------|--------|-----------|-------|
| obra → contrato | `source_fk` | alta | A obra publica o id interno do contrato |
| obra → licitação | `source_fk` | alta | A obra publica o id interno da licitação |
| contrato → licitação | `number_match` | média | Número da licitação no contrato, só se houver uma única licitação com esse número |
| despesa → contrato | `number_match` | média | Licitação de origem + credor apontam para exatamente um contrato |
| liquidação/pagamento → empenho | `number_match` | média | Número do empenho (coluna `Empenho`) + ano + unidade gestora, único na fonte; exige ainda descrição do empenho e credor iguais |
| obra → contrato | `manual` | manual | Feito no admin, com autor e justificativa |

O vínculo resolvido também fica na coluna da entidade (`contract_id`, `bid_id`,
`commitment_id`) para as consultas. Um vínculo manual revogado mantém a linha, com `revoked_at`.

A liquidação e o pagamento citam o **número** do empenho, não o sequencial (`SqEmpenho`). Em
2026-10-05, por esse número, os 13.338 pagamentos coletados (Prefeitura e Câmara) bateram com um
único empenho, com descrição, elemento, unidade e credor iguais; 13.335 ficaram ligados. Uma
primeira versão desta regra usava o sequencial e ligava parte dos registros ao empenho errado;
foi corrigida no mesmo dia e os vínculos foram refeitos.

## Auditoria

| Tabela | Conteúdo |
|--------|----------|
| `admin_users` | Quem agiu no admin. Hoje `login` é o `ADMIN_USER` do ambiente |
| `manual_overrides` | Correção manual: tipo e id do registro, campo, valor original, valor corrigido, justificativa, autor, data e revogação |
| `admin_audit_log` | Toda ação do admin, com detalhes |
| `collection_requests` | Fila de pedidos de coleta feitos no admin e o resultado de cada um |

## Dados pessoais (LGPD)

- **CPF nunca é armazenado completo**, nem no registro bruto: é mascarado na leitura da fonte.
- A página de contrato do SIGER embute a lista inteira de fornecedores do município (mais de 46
  mil nomes, com pessoas físicas). O coletor lê **apenas a opção selecionada** e descarta o resto.
- Pessoas físicas não entram na lista de fornecedores nem nas listas de maiores recebedores.
- A API da Câmara já entrega o documento mascarado; ele é guardado como veio.
- Fiscal e gestor de contrato ficam só no registro bruto e não são exibidos.
- Não há perfil, pontuação ou classificação de pessoas ou empresas.
