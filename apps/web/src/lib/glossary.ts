/**
 * Palavras do serviço público explicadas como se explica a um vizinho. O portal
 * usa a palavra simples na tela e mantém o termo oficial aqui, para quem for
 * conferir na fonte.
 */
export interface Term {
  /** Como o portal chama. */
  plain: string;
  /** Como aparece nos documentos oficiais. */
  official: string;
  explanation: string;
  example?: string;
}

export const GLOSSARY = {
  empenho: {
    plain: "Dinheiro reservado",
    official: "Empenho",
    explanation:
      "Antes de gastar, a Prefeitura separa o dinheiro para aquela despesa. É uma promessa de pagamento: o dinheiro ainda não saiu da conta.",
    example: "É como separar o dinheiro do aluguel assim que o salário cai.",
  },
  liquidacao: {
    plain: "Entrega conferida",
    official: "Liquidação",
    explanation:
      "Um servidor confere que o serviço foi feito ou que o produto chegou, e a Prefeitura reconhece que deve aquele valor.",
    example: "É como conferir a compra antes de pagar o entregador.",
  },
  pagamento: {
    plain: "Pago",
    official: "Pagamento",
    explanation: "O dinheiro saiu de fato da conta pública e foi para quem tinha a receber.",
  },
  licitacao: {
    plain: "Licitação",
    official: "Licitação",
    explanation:
      "É a disputa que o poder público abre para escolher de quem vai comprar ou quem vai fazer um serviço. As empresas apresentam propostas e vale a regra publicada no edital.",
  },
  pregao: {
    plain: "Pregão",
    official: "Pregão eletrônico ou presencial",
    explanation:
      "Tipo de licitação em que as empresas dão lances, como num leilão ao contrário: ganha quem oferece o menor preço.",
  },
  dispensa: {
    plain: "Compra sem disputa",
    official: "Dispensa de licitação",
    explanation:
      "Compra feita sem abrir disputa, nos casos em que a lei permite, como valores baixos ou emergências.",
  },
  inexigibilidade: {
    plain: "Contratação sem concorrente",
    official: "Inexigibilidade",
    explanation:
      "Contratação sem disputa porque só existe um fornecedor possível, como um artista específico ou um serviço exclusivo.",
  },
  contrato: {
    plain: "Contrato",
    official: "Contrato administrativo",
    explanation:
      "O acordo assinado entre o poder público e uma empresa ou pessoa: diz o que será entregue, por quanto e até quando.",
  },
  ata: {
    plain: "Lista de preços combinados",
    official: "Ata de registro de preços",
    explanation:
      "A empresa se compromete a vender por um preço fixo durante um período. A Prefeitura compra aos poucos, se e quando precisar; o valor total é um teto, não um gasto certo.",
  },
  aditivo: {
    plain: "Alteração de contrato",
    official: "Termo aditivo",
    explanation:
      "Documento que muda um contrato já assinado: pode esticar o prazo, aumentar ou diminuir o valor.",
  },
  vigencia: {
    plain: "Em vigor",
    official: "Vigência",
    explanation: "O período em que o contrato vale. Depois da data final, ele está encerrado.",
  },
  credor: {
    plain: "Quem recebeu",
    official: "Credor",
    explanation: "A empresa, pessoa ou folha de pagamento para quem o dinheiro foi destinado.",
  },
  folha: {
    plain: "Salários dos servidores",
    official: "Folha de pagamento",
    explanation:
      "A Prefeitura registra os salários de cada secretaria como um único recebedor chamado “Folha de pagamento”. Por isso ela aparece entre os maiores valores.",
  },
  orgao: {
    plain: "Secretaria ou órgão",
    official: "Órgão / unidade gestora",
    explanation: "A parte da Prefeitura ou da Câmara responsável por aquele gasto.",
  },
  elemento: {
    plain: "Tipo de gasto",
    official: "Elemento de despesa",
    explanation:
      "A classificação oficial do gasto: salários, material de consumo, obras, serviços de terceiros e assim por diante.",
  },
  homologado: {
    plain: "Valor final aprovado",
    official: "Valor homologado",
    explanation: "O valor com que a licitação terminou, depois de conferida e aprovada.",
  },
  prazoOriginal: {
    plain: "Prazo inicial",
    official: "Prazo de execução",
    explanation:
      "A data em que a obra deveria terminar pelo combinado no começo. Prazos podem ser esticados por uma alteração de contrato, e a fonte não avisa quando isso acontece.",
  },
} satisfies Record<string, Term>;

export type TermKey = keyof typeof GLOSSARY;
