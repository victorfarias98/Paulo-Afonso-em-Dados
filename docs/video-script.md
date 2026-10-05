# Vídeo de apresentação: Paulo Afonso em Dados

Peça de 60 segundos em português, com versões próprias em 1080 × 1920 (vertical) e
1920 × 1080 (horizontal), a 30 fps. O vídeo apresenta o projeto em preparação para
lançamento. Não anuncia endereço nem data de publicação.

## Ideia

O dinheiro público e as decisões da cidade fazem parte da vida de quem mora aqui.
O projeto aproxima a população dessas informações, com linguagem simples, fonte
oficial e contexto. A mensagem é um convite para entender, perguntar e acompanhar.

## Roteiro

| Tempo   | Texto principal e subtítulo na tela                                                                                         | Narração da edição final                                                                               |
| ------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 0–6 s   | **Para onde vai o dinheiro da cidade?** / A informação pública também precisa chegar até você.                              | “O dinheiro público faz parte da sua vida. Mas acompanhar tudo nem sempre é fácil.”                    |
| 6–13 s  | **Paulo Afonso em Dados** / Informação pública, perto de você.                                                              | “O Paulo Afonso em Dados aproxima você das decisões da cidade.”                                        |
| 13–22 s | **Gastos. Contratos. Obras.** / Quem recebe? O que foi contratado? Como está a obra?                                        | “Veja gastos, contratos e obras. Entenda quem recebe os pagamentos e o que está sendo comprado.”       |
| 22–29 s | **Cada informação tem uma fonte.** / Confira a origem e a data da consulta.                                                 | “Confira a origem dos registros, a fonte oficial e a data da consulta.”                                |
| 29–39 s | **E os vereadores?** / Busque o nome. Veja projetos e pedidos registrados.                                                  | “Na Câmara, busque um vereador. Consulte projetos e pedidos registrados, com links para as propostas.” |
| 39–46 s | **Proposta não é obra executada.** / Quantidade não mede qualidade. Fiscalização e comissões também fazem parte do mandato. | “Proposta não significa execução. E a ausência de projetos não resume todo o trabalho de um vereador.” |
| 46–53 s | **Entenda. Pergunte. Acompanhe.** / Sua cidade também é assunto seu.                                                        | “Com informação clara, fica mais fácil entender, perguntar e acompanhar a nossa cidade.”               |
| 53–60 s | **Uma cidade mais clara para todo mundo.** / Acompanhe o projeto. Compartilhe com quem vive aqui.                           | “Acompanhe o Paulo Afonso em Dados. Compartilhe com quem vive aqui.”                                   |

A edição final inclui narração em português do Brasil com a voz sintética Francisca
(`pt-BR-FranciscaNeural`), trilha instrumental original e textos na tela. A narração
tem 111 palavras. Cada trecho começa aproximadamente 0,33 segundo após o início da cena, conforme
[os tempos do áudio](../video/public/narration-timing.json). Os títulos e subtítulos
correspondem à [definição das cenas](../video/src/story.mjs).

## Adaptação dos formatos

- **Vertical:** uma mensagem por bloco, ilustração abaixo ou acima do título; proteger
  texto essencial das áreas ocupadas pelos controles do Instagram. Evitar texto pequeno
  no rodapé. As notas de contexto devem ser parte da composição principal.
- **Horizontal:** distribuir título e ilustração em duas colunas; preservar a mesma
  ordem narrativa. A composição deve ser reorganizada, sem cortar o vídeo vertical.
- **Ambas:** azul e creme da identidade do portal, contraste alto, transições suaves,
  texto em português e música instrumental original discreta. Não simular rolagem rápida
  de uma interface que torne o conteúdo ilegível.

## Legenda sugerida para Instagram

Você sabe onde encontrar informações sobre os gastos, contratos, obras e propostas
da sua cidade?

Estamos preparando o **Paulo Afonso em Dados**: um portal independente e apartidário
para organizar dados públicos, explicar os termos e facilitar a consulta às fontes
oficiais.

Também será possível consultar projetos e pedidos registrados por vereadores.
Esses números precisam de contexto: apresentar uma proposta não significa executá-la,
e a ausência de projetos não mede todas as atividades do mandato.

Acompanhe o projeto e compartilhe com alguém de Paulo Afonso. Informação clara ajuda
a população a perguntar, acompanhar e cobrar.

#PauloAfonso #TransparênciaPública #DadosAbertos #Cidadania #Baius

## Checagem editorial antes de publicar

- Não incluir valor de gasto, quantidade de obras ou ranking sem fonte e período
  visíveis. Este roteiro prefere explicar as consultas disponíveis.
- Usar apenas filtros que existem: nome, com projetos apresentados, sem projetos
  encontrados e sem propostas encontradas. Não prometer filtro de aprovação.
- Não tratar proposta como aprovação, execução, benefício comprovado ou medida de
  qualidade do voto.
- Não atribuir ausência de registros a falta de trabalho ou inventar justificativas.
- Manter a informação de preparação para lançamento na legenda enquanto o deploy
  não for confirmado.
- Conferir legibilidade em tela de celular, ausência de cortes nos dois formatos,
  duração, trilha e último quadro antes da entrega.

## Base factual

O conteúdo corresponde ao [README](../README.md), à
[home](../apps/web/src/app/page.tsx) e à
[seção de autores legislativos](../apps/web/src/components/legislative-authors.tsx).
As propostas parlamentares vêm do SAPL da Câmara Municipal. A consulta é um retrato
datado, atualizado quando uma nova coleta é publicada; não é uma atualização em tempo real.
