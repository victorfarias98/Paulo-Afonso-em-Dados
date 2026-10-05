# Analytics do portal

O portal usa o projeto central do PostHog da Baius. Todos os eventos recebem `site=paulo_afonso_em_dados` e `site_domain` com o domínio real da página. No domínio previsto `pauloafonsoemdados.baiustecnologia.com.br`, isso separa o portal dos demais sites mesmo reutilizando o token público.

## Configuração no Coolify

Configure **somente no runtime da aplicação web**, sem build args:

| Variável                | Valor                                                                                  |
| ----------------------- | -------------------------------------------------------------------------------------- |
| `POSTHOG_PROJECT_TOKEN` | Token público de ingestão do projeto Baius; não usar chave pessoal ou de administração |
| `POSTHOG_HOST`          | `https://us.i.posthog.com`, ou origem HTTPS válida do seu PostHog                      |
| `POSTHOG_ENABLED`       | `true` em produção; `false` desliga toda a instrumentação                              |

O token fica vazio nos exemplos versionados. Não configure analytics no worker. Desenvolvimento fica desligado por padrão; use `POSTHOG_ENABLED=true` explicitamente para testar com projeto separado. Sem token, configuração inválida, Do Not Track ou bloqueio do SDK, a navegação e as buscas continuam funcionando. O layout envia a configuração pública no runtime; não precisa reconstruir a imagem para trocar o token, apenas reiniciar a aplicação.

Nesta preparação, o token público foi confirmado nos scripts do site Baius e o host dos EUA na integração existente. O arquivo local ignorado `.env.posthog.production` contém apenas as três variáveis acima, preenchidas para copiar ao recurso web do Coolify. O `.env` de desenvolvimento permanece com `POSTHOG_ENABLED=false`. A conexão do Coolify configurada no Claude foi consultada, mas a API retornou `401`: nenhuma variável de produção foi lida ou alterada pelo Coolify.

A CSP permite apenas a origem configurada em `connect-src`. O SDK é empacotado com o portal: não há liberação de scripts, workers ou curingas externos para PostHog.

## Eventos e perguntas

| Evento                             | O que ajuda a entender                                               |
| ---------------------------------- | -------------------------------------------------------------------- |
| `$pageview`                        | Páginas consultadas, dispositivo, navegador e origem do acesso       |
| `portal_search_submitted`          | Termos pesquisados e páginas onde a busca começa                     |
| `portal_search_results_viewed`     | Quantidade de resultados e categorias, incluindo buscas sem resposta |
| `portal_filter_applied`            | Filtros usados nas consultas públicas                                |
| `portal_record_opened`             | Abertura de obras, contratos, licitações e fornecedores              |
| `portal_source_opened`             | Consulta às fontes oficiais, identificadas pelo host                 |
| `portal_home_section_viewed`       | Seções da home efetivamente vistas                                   |
| `portal_legislative_search`        | Busca na seção de autores legislativos                               |
| `portal_legislative_filter`        | Uso dos filtros de autoria e escopo legislativo                      |
| `portal_legislative_member_opened` | Abertura do contexto de um parlamentar                               |
| `portal_explanation_opened`        | Consulta às explicações de indicadores                               |
| `portal_pagination_used`           | Navegação para outras páginas de resultados                          |

Use sempre o filtro `site = paulo_afonso_em_dados` nos insights. Para conferir o deploy específico, acrescente `site_domain = pauloafonsoemdados.baiustecnologia.com.br`.

Sugestão de dashboard no PostHog:

1. **Uso diário:** `$pageview`, pessoas únicas por dia, breakdown `$device_type`; outro cartão por `$referring_domain`. A contagem representa identificadores anônimos por aba, não pessoas reconhecidas entre visitas.
2. **Conteúdo procurado:** `portal_search_submitted`, total de eventos por `search_term`; excluir termos nulos e vazios. Comparar períodos semanais.
3. **Buscas sem resposta:** `portal_search_results_viewed` com `results_count = 0`, breakdown `search_term` e `section`. Esse indicador mostra lacunas da consulta; não prova que o dado inexiste na fonte oficial.
4. **Filtros mais usados:** `portal_filter_applied`, breakdown `section` e `filter_names`; para autoria, `portal_legislative_filter` por `legislative_scope` e `filters`.
5. **Interesse na home:** `portal_home_section_viewed` por `section`, comparar com `$pageview` da home. A sequência de cartões ajuda a ajustar a ordem do conteúdo.
6. **Conferência das informações:** `portal_source_opened` por `source_host`; comparar com abertura de registros e explicações.
7. **Jornada de consulta:** funil `$pageview` → `portal_search_submitted` → `portal_record_opened`, com janela curta. Nem todo acesso precisa passar pela busca; manter insights por evento também.

Nenhum dashboard foi criado externamente. A configuração local permite enviar eventos ao projeto já existente quando as variáveis estiverem definidas; criar os insights acima no painel é uma etapa operacional separada.

## Privacidade e limites

A captura é explícita, sem autocapture, gravação de sessões, surveys, feature flags ou perfis de pessoas. A persistência usa `sessionStorage`, sem cookies ou identidade persistente entre visitas. Não há `identify`, coleta de idade, voto ou conclusão sobre preferência política. A opção Do Not Track é respeitada. IP para analytics e enriquecimento GeoIP ficam desabilitados.

URLs capturadas removem query strings; detalhes usam caminhos normalizados com `:id`. Referências externas preservam apenas a origem. Admin e endpoints de API não são monitorados. Buscas são normalizadas e limitadas a 100 caracteres: e-mails, URLs e sequências com pelo menos sete dígitos são substituídos por `search_term=null`, preservando indicador de redação e tamanho. Essa regra é uma mitigação, não um detector perfeito de dados pessoais em texto livre; termos podem conter nomes. Não use esses eventos para identificar indivíduos.

Estatísticas descrevem **uso do portal**, não perfil demográfico da população nem avaliação do voto. A identidade por aba limita retenção e visitantes recorrentes; bloqueadores também reduzem a cobertura. Revisar esses limites ao interpretar números ou planejar outra política de coleta.

## Validação

Em 05/10/2026: 295 testes passaram, incluindo integração em Postgres temporário; lint, typecheck e imagem `production` aprovados. O smoke de navegador com o SDK real verificou pageview único, filtro e abertura de autores, fontes oficiais, resultados vazios, redação de e-mail, paginação sem evento extra de filtro, explicações, token de ingestão, isolamento por site, remoção de query strings e Do Not Track. Nenhum evento de teste foi enviado ao projeto central.

O teste reutilizável é `scripts/analytics-smoke.mjs`. Execute contra um container **local e isolado**, com schema migrado, sem registros de consultas e analytics habilitado, na porta `33105`. Inicie um Chrome separado com `--headless --no-sandbox --remote-debugging-port=9237 --user-data-dir=/tmp/pad-analytics-chrome` e rode `node scripts/analytics-smoke.mjs`. O script intercepta os envios ao PostHog cloud e simula um user agent normal, pois o SDK ignora navegadores identificados como automação. `ANALYTICS_SMOKE_ORIGIN` e `ANALYTICS_CHROME_URL` permitem alterar as portas; ambos exigem host local. Encerre os recursos temporários ao terminar.
