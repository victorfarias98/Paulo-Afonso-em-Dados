# Metodologia

Este documento explica, para qualquer pessoa, de onde vêm os dados do Paulo Afonso em Dados,
como são coletados, o que fazemos com eles e quais são os limites do que mostramos.

O portal é independente e apartidário. Não é um canal oficial da Prefeitura nem da Câmara.
Ele reproduz dados que esses órgãos já publicam e indica a fonte de cada um. **Havendo
diferença entre o portal e a fonte oficial, vale a fonte.**

## De onde vêm os dados

| Assunto | Fonte oficial | Como lemos |
|---------|---------------|------------|
| Contratos, licitações e obras da Prefeitura | SIGER Web, sistema para o qual o Portal da Transparência da Prefeitura encaminha | Páginas públicas de listagem e de detalhe |
| Empenhos, liquidações e pagamentos da Prefeitura | Município Online, onde a Prefeitura publica a execução do orçamento | Formulário público de consulta, mês a mês |
| Contratos e licitações da Câmara Municipal | Portal da Transparência da Câmara | A mesma consulta que o portal da Câmara faz ao carregar cada lista |
| Empenhos, liquidações e pagamentos da Câmara | Município Online, na página da Câmara | Formulário público de consulta, mês a mês |

A situação de cada fonte, com a data da última consulta e eventuais falhas, está na página
**Fontes** do portal. A descrição técnica de cada fonte está em
[data-sources.md](./data-sources.md).

Nenhuma dessas fontes oferece uma interface oficial para programas (API documentada). Lemos
as mesmas páginas que qualquer visitante vê, sem login.

## Como coletamos

- Um programa consulta as fontes em horário de pouco movimento, uma página por vez, com
  intervalo entre as consultas, e se identifica com o nome do projeto e um e-mail de contato.
- De cada registro guardamos uma **cópia exatamente como foi publicado**, com o endereço da
  página, a data e a hora da coleta e uma impressão digital do conteúdo.
- Se a fonte altera um registro, guardamos a nova versão **sem apagar a anterior**.
- Se um registro deixa de aparecer na fonte, ele **não é apagado**: passa a ser marcado como
  ausente desde aquela data.
- Se a fonte muda de formato e não conseguimos interpretar um registro, ele não é publicado
  pela metade: fica marcado como falho e aparece na contagem de erros da página Fontes.

## Com que frequência

O programa de coleta roda uma vez por dia quando o portal está publicado. Parte dos dados
ainda está incompleta:

- os contratos estão sendo importados em lotes; nem todos os contratos publicados já aparecem;
- as despesas cobrem os meses indicados na página Gastos, não necessariamente o ano inteiro.

Por isso os totais do portal podem ser **menores** que os da fonte. Cada página informa
quando o dado foi conferido pela última vez.

## O que alteramos

Guardamos o original e, para exibir, fazemos apenas conversões de formato, todas registradas:

- valores em reais ("454.404,56") viram números;
- datas ("15/07/2026") são padronizadas;
- nome e documento do fornecedor, que algumas fontes publicam juntos, são separados.

Na página de cada contrato, obra ou licitação, a seção "De onde vem este dado" mostra o que
foi convertido e o link para a página oficial.

## O que calculamos

Algumas informações não vêm prontas da fonte. São calculadas por regras fixas, iguais para
todos os registros, descritas em [status-rules.md](./status-rules.md):

- **Situação do contrato** (vigente, vigência encerrada, cancelado): pela data final de
  vigência publicada.
- **Prazo original da obra**: data de início mais o número de dias de prazo. A fonte não
  publica a data de término.
- **"Prazo original vencido"**: o prazo original já passou e a fonte ainda não informa a
  obra como concluída. **Isso não significa que a obra esteja atrasada ou irregular**: o
  cálculo não considera prorrogações, que a fonte não informa junto da obra.

A situação das licitações não é calculada: mostramos o texto da fonte.

## Como relacionamos os dados

Ligamos obra, contrato, licitação e pagamento apenas quando há base objetiva, e dizemos qual:

| Ligação | Base | Confiança |
|---------|------|-----------|
| Obra → contrato | A própria fonte indica o contrato na ficha da obra | Alta |
| Obra → licitação | A própria fonte indica a licitação na ficha da obra | Alta |
| Contrato → licitação | Mesmo número de licitação, quando só existe uma licitação com aquele número | Média |
| Pagamento ou empenho → contrato | Mesma licitação de origem e mesmo credor, quando só existe um contrato assim | Média |

Quando há mais de uma possibilidade, **não ligamos**. Por isso um contrato pode aparecer sem
pagamentos ligados mesmo tendo sido pago. Ainda não ligamos pagamentos aos seus empenhos: não
conseguimos confirmar qual campo da fonte faz essa relação.

## Limitações conhecidas

- **Aditivos** de contratos (prorrogações e mudanças de valor) ainda não são importados. O
  valor mostrado é o inicial e a vigência é a original.
- **Percentual de execução e localização no mapa** das obras não são publicados pela fonte.
- **Participantes e propostas** das licitações ainda não são exibidos.
- Prefeitura e Câmara têm orçamentos separados. O portal mostra os gastos de cada uma em páginas
  próprias e **nunca soma as duas**; só a página de um fornecedor reúne o que ele recebeu de ambas.
- As licitações da **Câmara** vêm sem valor estimado (a fonte informa zero) e sem data de
  publicação; mostramos a data da licitação e, quando existe, o valor homologado. Dispensas e
  inexigibilidades publicadas em consulta separada da Câmara ainda não foram importadas.
- Os nomes de órgãos são os que cada fonte usa; unimos dois nomes apenas quando são idênticos.
- Entre os credores aparece "Folha de pagamento": é como a Prefeitura registra os salários
  dos servidores de cada órgão, como um credor único.

## Dados pessoais

Trabalhamos com dados que já são públicos, e ainda assim com cuidado:

- **CPF nunca é guardado nem exibido completo.** Onde a fonte publica um CPF, guardamos só
  uma forma mascarada.
- Pessoas físicas aparecem apenas no registro do pagamento ou do contrato em que são parte,
  com o nome que a fonte publica. **Não há página de pessoa física, nem lista de quanto cada
  pessoa recebeu.**
- Listas de "quem mais recebeu" incluem apenas credores com CNPJ.
- Não coletamos folha de pagamento individual nem dados de servidores.
- Ao ler a ficha de um contrato, a fonte envia junto o cadastro inteiro de fornecedores;
  lemos somente o fornecedor daquele contrato e descartamos o restante.

## O que o portal não faz

- Não emite opinião sobre gestões, partidos ou agentes públicos.
- Não classifica fornecedores como suspeitos nem cria índices de risco. Receber mais dinheiro
  público não indica irregularidade.
- Não corrige dados oficiais em silêncio. Se um dia houver correção manual, ela será
  registrada com o valor original, o valor corrigido, o motivo, o autor e a data.

## Como avisar de um erro

Escreva para **contato@baiustecnologia.com.br** com o endereço da página do portal e, se
possível, o da página oficial onde o dado aparece diferente. Erros de interpretação nossos
são corrigidos e a correção vale para todos os registros do mesmo tipo.

## Linguagem do portal

O portal troca as palavras técnicas por palavras do dia a dia e explica cada uma em
[Entenda](/entenda). Por exemplo: "dinheiro reservado" é o que os documentos chamam de empenho;
"entrega conferida" é a liquidação; "lista de preços" é a ata de registro de preços; "alteração de
contrato" é o termo aditivo. O termo oficial sempre aparece na explicação, para quem for conferir
na fonte.

As fontes publicam nomes de secretarias, empresas, obras e bairros em letras maiúsculas. O portal
mostra esses nomes em caixa normal, só para facilitar a leitura: nenhuma letra ou acento é
acrescentado, e o registro original continua guardado como foi publicado. As descrições longas
(o "para quê" de contratos e pagamentos) aparecem exatamente como a fonte escreveu.

O valor "por morador" divide o total pelos 112.870 moradores de Paulo Afonso no Censo 2022 do
IBGE. É uma conta para dar noção de tamanho, não um valor que cada pessoa recebeu ou pagou.
