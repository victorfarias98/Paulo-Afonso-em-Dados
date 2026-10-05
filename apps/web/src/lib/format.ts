const TIME_ZONE = "America/Bahia";
const CNPJ = /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/;

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dateTime = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TIME_ZONE,
  dateStyle: "short",
  timeStyle: "short",
});

/** Valor decimal do banco ("454404.56") como moeda. Ausente não vira zero. */
export function formatMoney(value: string | null): string {
  return value === null ? "Não informado" : currency.format(Number(value));
}

/** Data ISO do banco ("2026-07-15") como dd/mm/aaaa, sem passar por fuso horário. */
export function formatDate(value: string | null): string {
  if (value === null) return "Não informada";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

/** Momento de uma coleta, no horário de Paulo Afonso. */
export function formatDateTime(value: Date): string {
  return dateTime.format(value);
}

export function formatDocument(type: string, number: string | null): string | null {
  if (!number) return null;
  if (type === "cnpj") return `CNPJ ${number.replace(CNPJ, "$1.$2.$3/$4-$5")}`;
  if (type === "cpf") return `CPF ${number}`;
  return number;
}

const MILLION = 1_000_000;
const BILLION = 1_000_000_000;

/**
 * Valor grande dito como se fala: "R$ 421,2 milhões". Abaixo de um milhão,
 * mostra o valor inteiro em reais, sem centavos.
 */
export function formatMoneySpoken(value: string | number): string {
  const amount = Number(value);
  const short = (divided: number): string =>
    divided.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  if (amount >= BILLION) {
    const billions = amount / BILLION;
    return `R$ ${short(billions)} ${billions < 2 ? "bilhão" : "bilhões"}`;
  }
  if (amount >= MILLION) {
    const millions = amount / MILLION;
    return `R$ ${short(millions)} ${millions < 2 ? "milhão" : "milhões"}`;
  }
  return `R$ ${Math.round(amount).toLocaleString("pt-BR")}`;
}
