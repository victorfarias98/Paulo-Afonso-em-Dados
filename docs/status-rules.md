# Regras de situação

As situações exibidas no portal são calculadas por regras fixas, a partir do que a fonte
oficial publica. Nenhuma depende de avaliação humana. O texto original da fonte fica guardado
em `source_status` e aparece na página de cada registro.

A data de referência ("hoje") é a data em Paulo Afonso (fuso `America/Bahia`) no momento da
coleta. A situação é recalculada a cada coleta.

## Contratos

Implementação: `packages/domain/src/contract-status.ts`. Regras, na ordem:

| # | Condição | Situação |
|---|----------|----------|
| 1 | A fonte informa "CANCELADO" | Cancelado |
| 2 | Não há data final de vigência | Informação insuficiente |
| 3 | Data final de vigência anterior a hoje | Vigência encerrada |
| 4 | Caso contrário (inclui o último dia) | Vigente |

- A vigência é decidida pela **data**, não pelo rótulo da fonte ("NORMAL", "VENCIDO"), porque
  o rótulo pode estar desatualizado.
- **Limitação:** a data final é a do contrato original. Aditivos de prazo ainda não são
  importados; um contrato prorrogado pode aparecer como "Vigência encerrada".

## Obras

Implementação: `packages/domain/src/work-status.ts`. Regras, na ordem:

| # | Condição | Situação |
|---|----------|----------|
| 1 | A fonte não informa situação, ou informa uma desconhecida | Informação insuficiente |
| 2 | A fonte informa "Concluída", "Recbto Provisório" ou "Recbto Definitivo" | Concluída |
| 3 | Há prazo original e ele é anterior a hoje | Prazo original vencido |
| 4 | Caso contrário | A situação informada pela fonte |

Situações informadas pela fonte (SIGER) e como aparecem:

| Código | Texto na fonte | No portal |
|--------|----------------|-----------|
| 1 | Em andamento | Em andamento |
| 2 | Não Iniciada | Não iniciada |
| 3 | Paralisada | Paralisada |
| 4 | Em Fiscalização | Em fiscalização |
| 5 | Concluída | Concluída |
| 6 | Recbto Provisório | Concluída |
| 7 | Recbto Definitivo | Concluída |

### Prazo original

A fonte não publica a data de término. Ela é calculada:

```
prazo original = data de início + prazo de conclusão em dias
```

O campo `is_expected_end_date_derived` marca que a data foi calculada, e a página da obra
diz isso ao leitor.

### "Prazo original vencido" não é "obra atrasada"

A regra 3 compara hoje com o prazo **original**. A fonte não informa prorrogações junto da
obra, então uma obra com aditivo de prazo regular cai nessa situação. Na primeira coleta
(2026-10-04), 23 das 35 obras estavam assim, várias com termos aditivos anexados.

Por isso:

- o nome da situação é "Prazo original vencido", nunca "atrasada";
- a página da obra explica o cálculo e, havendo termos aditivos anexados, avisa que eles
  podem ter prorrogado o prazo;
- a listagem de obras traz o mesmo aviso no topo.

A regra só poderá virar "prazo vencido" de fato quando os aditivos de prazo forem importados
e considerados no cálculo.

### Situações previstas e ainda não usadas

"Planejada", "licitada", "contratada", "suspensa" e "cancelada" não existem na fonte atual
de obras. Serão acrescentadas se uma fonte passar a informá-las; não são inferidas.
