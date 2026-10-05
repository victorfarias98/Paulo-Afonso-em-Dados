# Fontes de dados — Paulo Afonso em Dados

> **Etapa 1 — Discovery.** Verificado em **2026-10-04** com requisições reais de leitura (GET/POST de consulta, sem autenticação).
> Nada neste documento foi inferido de memória: cada endpoint, campo e contagem abaixo foi observado na resposta da fonte.
> O que não foi observado está marcado como **HIPÓTESE** ou **NÃO VERIFICADO**.

## 1. Resumo

| #   | Fonte                                        | Órgão                                    | Entidades                                                                          | Formato                               | Método                                     | Situação                        |
| --- | -------------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------ | ------------------------------- |
| 1   | SIGER Web (`sigerweb.net.br/pm_pauloafonso`) | Prefeitura                               | contratos, atas, aditivos, licitações, dispensas, inexigibilidades, editais, obras | HTML + exportação CSV/XLS/XML/PDF     | scraping de listagem + detalhe; export CSV | Verificado                      |
| 2   | PNCP — API de Consulta                       | Prefeitura (CNPJ 14.217.327/0001-24)     | contratos/atas, contratações (Lei 14.133/2021)                                     | JSON, API pública documentada         | API REST                                   | Verificado                      |
| 3   | Município Online (`municipioonline.com.br`)  | Prefeitura e Câmara                      | empenhos, liquidações, pagamentos (verificados); receita, diárias                  | HTML ASP.NET WebForms                 | formulário com `__VIEWSTATE`, mês a mês    | Verificado (Prefeitura)         |
| 4   | SAI / IMAP — API `sai2.io.org.br/v3`         | Câmara (e casca do portal da Prefeitura) | contratos, licitações, despesas, sessões, atas, pautas                             | JSON, API interna **não documentada** | API REST interna                           | Verificado (Câmara)             |
| 5   | SAPL (`sapl.pauloafonso.ba.leg.br`)          | Câmara                                   | parlamentares, matérias, pautas, sessões                                           | HTML; API REST do SAPL                | API pública paginada                       | Autoria verificada (2026-10-05) |
| 6   | Diário Oficial (`diario.io.org.br/588`)      | Prefeitura/Câmara                        | publicações                                                                        | PDF (HIPÓTESE)                        | última opção                               | Fora do MVP                     |

**Achado central:** o Portal da Transparência da Prefeitura (`transparencia.pauloafonso.ba.gov.br`) é apenas uma **casca**. É uma SPA Angular do fornecedor IMAP cujo menu redireciona as seções de licitações, contratos e obras para o **SIGER Web**, e diárias/folha para outros sistemas. As chamadas `contrato/ListarContratos` e `Obras/PainelObras` da API do portal para a Prefeitura (`cod_orgao_org=140`) retornaram **lista vazia** (`[]`). Os dados reais da Prefeitura estão nas fontes 1, 2 e 3.

## 2. Mapa de domínios oficiais

| URL                                                                        | O que é                              | Tecnologia observada                        |
| -------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------- |
| `https://pauloafonso.ba.gov.br/`                                           | Site institucional da Prefeitura     | —                                           |
| `https://transparencia.pauloafonso.ba.gov.br/`                             | Portal da Transparência (casca)      | SPA Angular; API em `sai2.io.org.br/v3`     |
| `https://sigerweb.net.br/pm_pauloafonso/`                                  | SIGER — licitações, contratos, obras | PHP, Adianti Framework, atrás de Cloudflare |
| `https://www.municipioonline.com.br/ba/prefeitura/pauloafonso/cidadao/…`   | Despesa, receita, diárias            | ASP.NET WebForms                            |
| `https://folhadepagamento.kbfsistemas.com.br/pmpa/…`                       | Folha e servidores                   | fora do MVP (dados pessoais)                |
| `https://www.cmpa.ba.gov.br/`                                              | Site da Câmara                       | PHP                                         |
| `https://transparencia.cmpa.ba.gov.br/ba/camarapauloafonso/…`              | Transparência da Câmara              | mesma SPA IMAP                              |
| `https://www.municipioonline.com.br/ba/camara/pauloafonso/cidadao/despesa` | Despesa da Câmara                    | ASP.NET WebForms                            |
| `https://www.pauloafonso.ba.leg.br/`                                       | Portal legislativo (Interlegis)      | Plone                                       |
| `https://sapl.pauloafonso.ba.leg.br/`                                      | Processo legislativo                 | SAPL                                        |

## 3. Fonte 1 — SIGER Web (Prefeitura)

**Órgão responsável:** Prefeitura Municipal de Paulo Afonso. **Fornecedor do sistema:** NÃO VERIFICADO (o campo `usuarioNome` no PNCP indica "SUDOESTE INFORMATICA E CONSULTORIA LTDA" como publicador — HIPÓTESE de que seja o mesmo fornecedor).

### 3.1 Como a página funciona

`index.php?class=<Classe>` devolve apenas a moldura (~7,5 KB). O conteúdo real vem de:

```
GET https://sigerweb.net.br/pm_pauloafonso/engine.php?class=<Classe>
```

com cookie de sessão `PHPSESSID_pm_pauloafonso` (emitido na primeira visita, sem login).

### 3.2 Listagens verificadas

| Classe                                   | Conteúdo         | Colunas da listagem                                                                                        | Paginação                                                     |
| ---------------------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `CadContratoListExterno`                 | Contratos e atas | Nº Contrato, Tipo, Modalidade, Licitação, Contratado, Assinatura, Vencimento, Situação, Fiscal do Contrato | `limit=20`, `offset` observado até 1320 (≥ ~1.340 registros)  |
| `CadObrasListExterno`                    | Obras            | Número, Descrição, Data Início, Valor, Status                                                              | 2 páginas; **35 obras** no CSV                                |
| `LicLicitacaoListExterno`                | Licitações       | Nº Licitação, Modalidade, Status, Publicação, Sessão, Objeto, Valor                                        | `limit=20`, `offset` observado até 200 (total NÃO VERIFICADO) |
| `LicLicitacaoListDispensaExterno`        | Dispensas        | NÃO VERIFICADO                                                                                             | —                                                             |
| `LicLicitacaoListInexigibilidadeExterno` | Inexigibilidades | NÃO VERIFICADO                                                                                             | —                                                             |
| `LicEditalListExterno`                   | Editais          | NÃO VERIFICADO                                                                                             | —                                                             |

Filtros de contratos: `con_numero`, `con_licitacao`, `con_modalidade`, `con_tipo`, `con_tipo_contrato`, `con_objeto`, `id_fornecedor`, `id_secretaria`, `con_fiscal`, períodos de assinatura/término/execução.
Filtros de licitações: `id_orgao`, `lic_numero`, `lic_modalidade_siga`, `lic_status`, `lic_objeto`, `pub_ini/fim`, `hom_ini/fim`.

### 3.3 Detalhe

```
GET engine.php?class=CadContratoFormExterno&method=onEdit&key=<id>&id=<id>
GET engine.php?class=CadObrasFormExterno&method=onEdit&key=<id>&id=<id>
GET engine.php?class=LicLicitacaoFormExternoView&method=onEdit&…   (NÃO VERIFICADO)
```

**Contrato** (abas: Dados do Contrato, Aditivos, Secretarias, Dotações): `id`, `con_numero`, `con_tipo_contrato`, `con_licitacao`, `con_processo`, `con_modalidade`, `con_aditivo`, `con_dt_ini` (assinatura), `con_dt_fim` (vencimento), `con_valor` (valor inicial), `con_objeto`, `con_status`, `con_situacao`, `con_competencia`, `con_dt_cadastro`, `con_fiscal`, `con_gestor`, `id_fornecedor`, lista de secretarias, lista de dotações (órgão / unidade / ação / elemento / fonte).

**Obra** (abas: Cadastro, Endereço, Convênio, Anexos): `id`, `ob_numero`, `ob_descricao`, `ob_objeto`, `ob_dtcadastro`, `ob_dtinicio`, `ob_prazo` (prazo de conclusão em dias), `ob_und`, `ob_qtdund`, `ob_existecontrato`, **`id_contrato`**, **`id_licitacao`**, `ob_valor`, `ob_tipotc`, `ob_funcaotc`, `ob_status`; endereços (tipo, logradouro, número, complemento, **bairro**, cidade); convênios; anexos em PDF (`obra_doc/…`).

O vínculo obra → contrato → licitação **existe na origem** (`id_contrato`, `id_licitacao`), o que permite associação de confiança alta sem heurística.

### 3.4 Exportação CSV (verificada para obras)

```
GET engine.php?class=CadObrasListExterno&method=onExportCsv&static=1
  → resposta contém: __adianti_download_file('app/output/<hash>.csv', '')
GET https://sigerweb.net.br/pm_pauloafonso/app/output/<hash>.csv   → 200, arquivo
```

`download.php?file=…` retornou 0 bytes; o caminho direto funcionou. Também existem `onExportXls`, `onExportXml`, `onExportPdf` (NÃO VERIFICADOS).

Amostra real do CSV (sem linha de cabeçalho):

```
406,"CONSTRUÇÃO DE ESCOLA PADRÃO",2026-04-24,10796000,1
405,"MANUTENÇÃO DE ESGOTO",2026-07-07,1650808.06,1
```

### 3.5 Limitações

- CSV **sem cabeçalho** e com status como **código numérico** (`1`); a tabela de códigos precisa ser derivada cruzando com a listagem HTML ("Em Andamento").
- O CSV tem só as colunas da listagem. Bairro, prazo, contrato, licitação e fornecedor exigem a página de detalhe.
- Listagem e detalhe de contratos pesam **~3,2 MB por requisição** sem compressão (≈46 mil `<option>` do cadastro de fornecedores embutidos em cada página) e **~0,7 MB com gzip**. Varredura completa da listagem: 67 páginas ≈ 48 MB. Carga inicial dos 1.339 detalhes: ≈ 880 MB — por isso é feita em lotes diários limitados.
- O tamanho da página é **fixo em 20**: `limit=100` é ignorado (verificado). A ordenação `order=id&direction=desc` funciona e devolve os contratos mais recentes primeiro.
- **47 números de contrato se repetem** na listagem; a chave do registro é o id interno (`row_<id>`), não o número.
- O campo de fornecedor do detalhe embute o cadastro inteiro (46.708 opções, incluindo pessoas físicas). O coletor lê **somente a opção selecionada** e mascara CPF antes de gravar.
- Sem percentual de execução física e sem latitude/longitude na origem.
- Sem data de atualização por registro: detecção de mudança só por hash do conteúdo.
- A listagem mostra só o nome do fornecedor; o CNPJ está no detalhe.
- `robots.txt` contém apenas o preâmbulo de "content signals" do Cloudflare, sem diretivas `Allow`/`Disallow`.
- Interface interna, sem contrato de estabilidade: classes e campos podem mudar sem aviso.

## 4. Fonte 2 — PNCP

**Órgão responsável:** Ministério da Gestão e da Inovação (portal); dado publicado pelo Município.
**Documentação oficial:** `https://pncp.gov.br/api/consulta/swagger-ui/index.html` e Manual da API de Consultas em gov.br/pncp.

### 4.1 Verificado

```
GET https://pncp.gov.br/api/pncp/v1/orgaos/14217327000124
  → { "cnpj":"14217327000124", "razaoSocial":"MUNICIPIO DE PAULO AFONSO", "esferaId":"M", "poderId":"N", … }

GET https://pncp.gov.br/api/consulta/v1/contratos
      ?dataInicial=20260101&dataFinal=20260930&cnpjOrgao=14217327000124&pagina=1&tamanhoPagina=10
  → { totalRegistros: 538, totalPaginas: 54, numeroPagina: 1, paginasRestantes: 53, data: [...] }
```

Campos observados em um contrato: `numeroControlePNCP` (ex.: `14217327000124-2-000313/2025`), `numeroControlePncpCompra`, `numeroControlePncpAta`, `anoContrato`, `sequencialContrato`, `numeroContratoEmpenho`, `processo`, `tipoContrato{id,nome}`, `categoriaProcesso{id,nome}`, `objetoContrato`, `tipoPessoa`, `niFornecedor` (CNPJ completo), `nomeRazaoSocialFornecedor`, `valorInicial`, `valorGlobal`, `valorParcela`, `valorAcumulado`, `numeroParcelas`, `dataAssinatura`, `dataVigenciaInicio`, `dataVigenciaFim`, `dataPublicacaoPncp`, `dataAtualizacao`, `dataAtualizacaoGlobal`, `numeroRetificacao`, `unidadeOrgao{codigoUnidade,nomeUnidade,codigoIbge,municipioNome}`, `orgaoEntidade{cnpj,razaoSocial}`, `identificadorCipi`, `urlCipi`, `usuarioNome`.

Código IBGE do município confirmado na resposta: **2924009**.

### 4.2 Pontos fortes

- Única fonte com **API documentada**, **CNPJ completo do fornecedor**, **identificador estável** (`numeroControlePNCP`) e **data de atualização** por registro.
- `numeroControlePncpCompra` liga contrato → contratação de origem.
- `unidadeOrgao.nomeUnidade` traz a secretaria.

### 4.3 Limitações e pendências

- Cobre apenas contratações sob a Lei 14.133/2021 e apenas o que o Município publicou.
- O Manual de Integração do PNCP v. 2.6 informa que o ambiente de produção dos serviços é
  `https://pncp.gov.br/api/pncp`, e que o portal de consultas é público. APIs de manutenção
  exigem autenticação, mas consultas públicas não exigem credenciais.
- Itens de uma contratação podem ser consultados no endpoint documentado:
  `GET /v1/orgaos/{cnpj}/compras/{ano}/{sequencial}/itens`. A chave vem do próprio controle PNCP
  da compra. Em um controle no formato `CNPJ-1-SEQUENCIAL/ANO`, o CNPJ identifica o órgão, o ano
  fica após a barra e o sequencial identifica a compra. Esse endpoint é o caminho para enriquecer licitações e contratos com itens,
  quantidades, unidade de medida, valor unitário e descrição do item.
- Uma contratação individual pode ser consultada em
  `GET /v1/orgaos/{cnpj}/compras/{ano}/{sequencial}`. O retorno documentado inclui
  `numeroControlePNCP`, `numeroCompra`, `processo`, `modalidadeNome`, `situacaoCompraNome`,
  `objetoCompra`, `valorTotalEstimado`, `valorTotalHomologado`, `dataPublicacaoPncp`,
  `dataAtualizacao`, `sequencialCompra`, `orgaoEntidade` e `unidadeOrgao`.
- Resultados de itens ficam vinculados por
  `GET /v1/orgaos/{cnpj}/compras/{ano}/{sequencial}/itens/{numeroItem}/resultados`, segundo o
  manual. Esse dado permite saber fornecedor/arrematante, quantidade homologada, valor unitário
  homologado e valor total homologado quando publicado.
- A API de consulta de contratos já verificada traz `numeroControlePncpCompra`. Esse campo deve
  ser usado como vínculo de alta confiança contrato → contratação → itens, antes de qualquer
  heurística por número de processo ou objeto.
- Semântica exata de `dataInicial`/`dataFinal` na API de consulta de contratos:
  **confirmar no Swagger da API de Consulta antes do importer incremental**.
- CNPJ da Câmara Municipal no PNCP: NÃO VERIFICADO.
- Limites de requisição: NÃO VERIFICADO.
- Numeração entre PNCP (`processo: "ATA-0053/2025"`) e SIGER (`ATA-0119/2026`) parece seguir o mesmo padrão — **HIPÓTESE** a validar para o cruzamento entre fontes.

## 5. Fonte 3 — Município Online (despesas)

```
https://www.municipioonline.com.br/ba/prefeitura/pauloafonso/cidadao/despesa   → 200
https://www.municipioonline.com.br/ba/camara/pauloafonso/cidadao/despesa       → 200
```

**Verificado em 2026-10-05 para a Prefeitura** (empenhos, liquidações e pagamentos de jan–set/2026).

### 5.1 Como a página funciona

Formulário ASP.NET WebForms, sem API. Uma consulta é um `POST` na própria página com:

- todos os campos ocultos da resposta anterior (`__VIEWSTATE`, `__EVENTVALIDATION`, …);
- `ctl00$body$hfAno<Aba>` e `ctl00$body$hfMes<Aba>` (mês com dois dígitos);
- `ctl00$body$btnFiltrar<Aba>S=Button`.

`<Aba>` é `Empenhos`, `Liquidacoes` ou `Pagamentos`. A resposta traz a tabela `#dataTables-<Aba>`
com todas as linhas do mês (até ~5 MB sem compressão). Os botões "Exportar JSON/XML" da página
**não são endpoints**: exportam, no navegador, a tabela já carregada.

### 5.2 Colunas

Comuns: `Órgão`, `Unidade`, `Data`, `Elemento`, `CPF/CNPJ Credor`, `Credor`, `CNPJ` (da unidade
gestora), `DsEmpenho`, `NmBaseLegal`, `Licitacao/Dispensa/Inexigibilidade`, `Chave`,
`Modalidade`, `Histórico`.

| Aba         | Colunas próprias                                                                          |
| ----------- | ----------------------------------------------------------------------------------------- |
| Empenhos    | `Empenho`, `Empenhado`, `Anulado`, `Reforçado`, `SqEmpenho`                               |
| Liquidações | `Empenho`, `Liq`, `Dotação`, `Documento`, `Liquidado`, `Retido`, `Anulação`, `Liquidacao` |
| Pagamentos  | `Empenho`, `Processo`, `Pago`, `Retido`, `Anulação`, `Nota de Pagamento`                  |

Volume em 2026 (jan–set): 4.757 empenhos, 12.624 liquidações, 12.289 pagamentos.

### 5.3 Armadilhas confirmadas

- **`Chave` não é única.** O número se repete entre unidades gestoras (Prefeitura, Fundo de
  Saúde, Fundo de Educação, …). Em um único mês pode não haver repetição — setembro/2026 não
  tinha —, o que engana. O identificador único é **`CNPJ` da unidade gestora + `Chave`**
  (conferido nos três conjuntos, nove meses, 29.670 linhas).
- **Empenhado não é só a coluna `Empenhado`.** O empenho líquido é
  `Empenhado + Reforçado − Anulado`. Só a coluna inicial dá R$ 225,9 mi em jan–set/2026, menos
  que o pago; o líquido dá R$ 485,8 mi, coerente com liquidado (R$ 441,4 mi) e pago (R$ 421,2 mi).
- **CPF de pessoa física já vem mascarado pela fonte** (`222.***.***-15`); CNPJ vem completo.
- "FOLHA DE PAGAMENTO - …" aparece como credor único de cada órgão, com o CNPJ do próprio órgão.
- `Licitacao/Dispensa/Inexigibilidade` repete o ano no fim (`CR0012/2026/2026`).

### 5.4 Pendências

- Qual coluna liga pagamento e liquidação ao empenho: **NÃO VERIFICADO** (a coluna `Empenho`
  dessas abas traz números curtos que não batem com `Empenho` nem `SqEmpenho` da aba de empenhos).
- Despesa da Câmara: mesma estrutura de página (HIPÓTESE), não coletada.
- `robots.txt` responde 404.

## 6. Fonte 4 — API SAI/IMAP (`sai2.io.org.br/v3`)

API interna do portal, **sem documentação pública** (Swagger não exposto). O órgão é identificado pelo header `gov-path`:

| Órgão      | `gov-path`                            | `cod_orgao_org` | `cod_site_sit` |
| ---------- | ------------------------------------- | --------------- | -------------- |
| Prefeitura | `transparencia.pauloafonso.ba.gov.br` | 140             | 58             |
| Câmara     | `ba/camarapauloafonso`                | 2370            | 1161           |

```
GET  /v3/orgao/info                (header gov-path)  → dados do órgão + menus_personalizados
POST /v3/contrato/ListarContratos  { cod_orgao_org, exercicio, palavra_chave, … }
```

**Câmara:** `ListarContratos` retornou **176 contratos**. Campos: `CodigoContrato`, `NumeroContrato`, `Objeto`, `NumeroProcessoLicitatorio`, `DataInicioVigencia`, `DataFimVigencia`, `DataAssinatura`, `Modalidade`, `Contratado`, `CNPJ_CPF`, `Valor` (texto: `"R$ 150.000,00"`), `Bit_aditivo`, `TipoContrato`, `OrigemRegistro`, `Arquivo` (PDF via `Handler.ashx?f=f&query=<arquivo>`).

**Prefeitura:** `ListarContratos` e `Obras/PainelObras` → `[]`.

Outros endpoints presentes no código do portal (NÃO VERIFICADOS): `contrato/Contrato`, `contrato/Aditivos`, `FiscalContrato/Listar`, `Licitacao/Filtro`, `Licitacao/LicitacaoDetalhes`, `ContratacaoDireta/DispensaEInexigibilidade`, `Obras/ObraDetalhe`, `DespesasSai/Listar|Totais|Credor`, `PagamentosSai/Listar`, `despesa/empenho|liquidacao|pagamento`, `sessoesPlenarias/*`, `ataSessao/*`.

**Limitações:** o documento vem **mascarado** (`"51..***.***-**"`), o que impede deduplicar fornecedor por CNPJ nesta fonte; valores monetários vêm como texto formatado; sem data de atualização por registro.

## 7. Fontes a investigar (ainda não consultadas)

Nenhum endpoint abaixo foi testado; servem como lista de trabalho.

- **TCM-BA** (Tribunal de Contas dos Municípios da Bahia) — prestações de contas e obras declaradas ao tribunal (os campos `ob_tipotc`/`ob_funcaotc` do SIGER indicam envio ao TC).
- **Transferegov / Portal da Transparência federal** — convênios federais com o Município (apareceu na busca o convênio 754455).
- **Obrasgov.br / CIPI** — o PNCP traz `identificadorCipi`/`urlCipi` (nulos na amostra).
- **SICONFI (Tesouro Nacional)** — execução orçamentária agregada, útil para conferência de totais.
- **Receita Federal (CNPJ aberto)** — razão social e situação cadastral de fornecedores.
- **SAPL**: autoria de matérias na home, por snapshot de coleta completa. Votações e justificativas individuais ainda fora do escopo. **Diário Oficial**: fora do MVP.

## 8. Matriz entidade × fonte (MVP)

| Entidade               | Fonte primária                | Fonte de conferência    | Observação                               |
| ---------------------- | ----------------------------- | ----------------------- | ---------------------------------------- |
| Contratos (Prefeitura) | SIGER                         | PNCP                    | PNCP traz CNPJ completo e ID estável     |
| Aditivos               | SIGER (aba Aditivos)          | PNCP (termos)           | ambos a detalhar                         |
| Licitações             | SIGER                         | PNCP (contratações)     |                                          |
| Obras                  | SIGER                         | —                       | vínculo com contrato/licitação na origem |
| Fornecedores           | PNCP (`niFornecedor`)         | SIGER (`id_fornecedor`) | derivado dos contratos                   |
| Órgãos/secretarias     | SIGER (secretarias, dotações) | PNCP (`unidadeOrgao`)   | nomes divergem entre fontes              |
| Despesas/pagamentos    | Município Online              | —                       | campos a verificar                       |
| Contratos (Câmara)     | SAI                           | —                       | CNPJ mascarado                           |

## 9. Regras de coleta adotadas

1. `User-Agent` identificando o projeto e um e-mail de contato.
2. No máximo 1 requisição simultânea por host, com intervalo entre chamadas; coleta diária em horário de baixo uso.
3. Somente consultas de leitura que o próprio portal faz para qualquer visitante; nenhuma área autenticada.
4. Todo payload bruto é guardado com URL, método, data da coleta e hash SHA-256.
5. Mudança de estrutura na fonte interrompe a importação com erro visível — nunca importa dado parcialmente interpretado.
6. Folha de pagamento e dados de servidores não são coletados.

## 10. Pendências antes do primeiro importer

- [x] Detalhe do contrato no SIGER expõe o CNPJ: a opção selecionada de `id_fornecedor` vem como `"10.780.363/0001-40 - RAZÃO SOCIAL"`.
- [x] CSV de contratos: 1.339 linhas, 9 colunas, sem cabeçalho e **sem o id interno** — `número, tipo (C/A), modalidade, licitação, contratado, assinatura, vencimento, vencimento (repetido), fiscal`. Serve para conferência, não como chave.
- [x] Status do contrato no SIGER (`con_status`): `N` NORMAL, `C` CANCELADO, `V` VENCIDO (há uma quarta opção não identificada).
- [x] Licitações: 631 registros; detalhe em `LicLicitacaoFormExternoView` (37 KB) com número, processo, valor, datas, modalidade, órgão, situação e objeto. Aba de participantes vazia na amostra.
- [x] Situação das obras: 1 Em andamento, 2 Não Iniciada, 3 Paralisada, 4 Em Fiscalização, 5 Concluída, 6 Recbto Provisório, 7 Recbto Definitivo.
- [x] Obras referenciam contratos por id interno; 11 das 32 referências apontam para registros fora da listagem pública de contratos (em geral aditivos, ex.: "6 ADT - 234/2023/2025").
- [x] Aditivos (verificado em 2026-10-05): cada termo aditivo é um registro de contrato próprio (`CadContratoFormExterno`, número como `1 ADT-277/2024/2025`), fora da listagem pública mas com página de detalhe acessível pelo id que as obras citam. A aba `VwAditivosListExterno&idcont=<id>` respondeu **vazia** para os ids 3753, 1339, 1000 e 500; não há forma verificada de listar os aditivos de um contrato nem de saber o contrato original de um aditivo. Detalhes em [data-model.md](data-model.md#aditivos).
- [x] Pagamento/liquidação → empenho (verificado em 2026-10-05): o campo `Empenho` da liquidação e do pagamento corresponde ao campo `Empenho` (número) do empenho, **não** ao `SqEmpenho`. `CNPJ + Empenho + ano` é único entre os 5.080 empenhos coletados, e por ele 13.338 de 13.338 pagamentos batem com um empenho de mesma descrição, elemento, unidade e credor. (A hipótese inicial, `SqEmpenho`, batia em só 73% e foi descartada.)
- [x] Despesas da Câmara (verificado em 2026-10-05): `…/ba/camara/pauloafonso/cidadao/despesa` tem a mesma estrutura da página da Prefeitura (mesmas abas, mesmos campos, `CNPJ` da unidade gestora `14385561000160`). Coletados jan–set/2026: 323 empenhos, 953 liquidações, 1.049 pagamentos, sem chave repetida.
- [x] Licitações da Câmara (verificado em 2026-10-05): `POST /v3/Licitacao/Filtro` com o corpo do formulário do portal (`Ano`, `cod_orgao_org: 2370`, demais campos vazios) e cabeçalho `gov-path`; anos disponíveis em `GET /v3/Licitacao/DropDownAnosLicitacao?cod_orgao_org=2370` (2015 a 2026). Campos: `NumeroLicitacao`, `NumeroProcesso`, `Objeto`, `Tabela`, `Detalhes`, `Modalidade`, `Status`, `DataLicitacao` (ausente em parte dos registros antigos), `ValorEstimado` (sempre 0 nos anos conferidos), `ValorHomologado`. Total coletado: 142. Sem `Ano`, a API devolve só o ano corrente. Detalhe (`Licitacao/LicitacaoDetalhes`), participantes e dispensas (`ContratacaoDireta/DispensaEInexigibilidade`): NÃO VERIFICADOS, não importados.
- [ ] Confirmar no manual do PNCP a semântica dos filtros de data e os limites de uso.
- [x] Município Online: "Exportar JSON" é só exportação no navegador; os dados vêm do formulário (seção 5).
- [ ] Confirmar no browser para onde o portal da Prefeitura envia a seção "Receitas e Despesas".
- [ ] Registrar pedido via e-SIC perguntando se existe base de dados abertos ou API oficial (LAI, art. 8º, §3º).

## Autoria legislativa na home (2026-10-05)

Foram verificadas as APIs públicas SAPL `parlamentares/parlamentar/`, `base/autor/`, `materia/tipomaterialegislativa/` e `materia/materialegislativa/?ano=2026`, com `page_size=100` e paginação completa. A coleta de 2026-10-05 trouxe 1.294 matérias e 17 parlamentares marcados como ativos. Isso descreve o cadastro da fonte, não uma verificação independente de exercício de mandato.

O snapshot versionado em `apps/web/src/data/legislative-snapshot.json` armazena dados públicos mínimos, ano e data da coleta. `pnpm collect:legislative 2026` atualiza o arquivo local; requer conexão à fonte. A versão anterior é preservada se a coleta falhar. Há intervalo de 2,5 segundos entre consultas, limite de páginas, timeout, verificação de contagem e de IDs duplicados e validação Zod antes da substituição atômica. **A atualização exige novo build/publicação do web. O worker diário ainda não atualiza essa seção.**

Autoria exige vínculo `autor.content_type = 1` e `autor.object_id = parlamentar.id`. IDs de autores não são comparados diretamente aos IDs parlamentares. A coautoria conta uma vez por matéria e por parlamentar. A soma das contagens de parlamentares pode duplicar matérias conjuntas. Propostas do Executivo, comissões e coletivos não são atribuídas a um vereador sem autoria individual registrada.

Projetos incluem PLO, PLC, PDL, PR/PRE, PELO e SUBPL. Requerimentos (REQ) aparecem como pedidos; emendas, moções e demais tipos entram apenas no total de propostas. Não há classificação local de aprovação, execução, presença ou produtividade. Ausência só é afirmada se o snapshot for completo e houver vínculo de autoria conhecido. Sem cobertura ou vínculo, o resultado é “não verificado”, nunca zero.

Os filtros da home permitem nome, com projetos, sem projetos e sem qualquer proposta. Todos os 17 parlamentares possuem alguma matéria nesta coleta; cinco não possuem projetos nos tipos contados. A fonte consultada não oferece justificativa individual para a ausência. A [consulta oficial](https://sapl.pauloafonso.ba.leg.br/materia/pesquisar-materia) e os perfis estão ligados diretamente na seção. Integrar votação nominal, afastamentos e justificativas exige validar as entidades correspondentes antes de publicar explicações individuais.

Ilustração da home: `apps/web/public/illustrations/civic-city.webp`, gerada com a ferramenta integrada de imagem e otimizada em WebP. Prompt: ilustração editorial de Paulo Afonso inspirada no cânion do São Francisco, infraestrutura hidrelétrica, casas, praça pública e moradores consultando um documento; formas de papel recortado, azul-marinho e azul suave, fundo claro, sem texto, números, políticos ou gráficos fictícios. É uma ilustração conceitual, não um registro de obra.
