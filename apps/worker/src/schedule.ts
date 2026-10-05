/** America/Bahia não tem horário de verão: UTC-3 o ano todo. */
const BAHIA_UTC_OFFSET_HOURS = -3;
const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Quantos milissegundos faltam para o próximo horário diário (HH:MM, hora de Paulo Afonso). */
export function msUntilNextRun(now: Date, dailyAt: string): number {
  const match = TIME.exec(dailyAt);
  if (!match) {
    throw new Error(`Horário inválido: "${dailyAt}". Use HH:MM, por exemplo 05:00.`);
  }
  const runMinutesUtc = (Number(match[1]) - BAHIA_UTC_OFFSET_HOURS) * 60 + Number(match[2]);
  const startOfDayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  let next = startOfDayUtc + runMinutesUtc * MS_PER_MINUTE;
  while (next <= now.getTime()) next += MS_PER_DAY;
  // O coletor público roda apenas em dias úteis. Dados publicados no fim de
  // semana entram na segunda-feira seguinte, preservando o ritmo das fontes.
  while ([0, 6].includes(new Date(next).getUTCDay())) next += MS_PER_DAY;
  return next - now.getTime();
}

/**
 * Meses de despesa recoletados a cada dia: o atual e o anterior, porque a fonte
 * ainda recebe lançamentos do mês que acabou de fechar.
 */
export function expenseMonthsFor(today: string): Array<{ year: number; months: number[] }> {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));

  if (month === 1) {
    return [
      { year: year - 1, months: [12] },
      { year, months: [1] },
    ];
  }
  return [{ year, months: [month - 1, month] }];
}
