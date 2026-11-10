const brl = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const money = (cents: number) => `R$ ${brl.format(cents / 100)}`;

/** Divide em partes para o estilo "R$ 5.304,28" com centavos menores. */
export function moneyParts(cents: number) {
  const neg = cents < 0;
  const [int, dec] = brl.format(Math.abs(cents) / 100).split(',');
  return { neg, int, dec };
}

export const pct = (n: number) => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export const monthName = (m: string) => MONTHS[Number(m.slice(5, 7)) - 1];
export const monthYear = (m: string) => m.slice(0, 4);
export const monthShort = (m: string) => `${SHORT[Number(m.slice(5, 7)) - 1]} ${m.slice(2, 4)}`;
export const monthLong = (m: string) => `${monthName(m)} ${monthYear(m)}`;

export function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function addMonths(month: string, n: number) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Data de vencimento real (ajusta dia 31 em meses curtos). */
export function dueDate(month: string, day: number) {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return new Date(y, m - 1, Math.min(day, last));
}

export function daysUntil(date: Date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((date.getTime() - today.getTime()) / 86400000);
}

export const dd = (n: number) => String(n).padStart(2, '0');

/** "1.234,56" | "1234.56" | "1234" -> centavos */
export function parseMoney(input: string): number {
  const clean = input.replace(/[^\d,.-]/g, '');
  if (!clean) return 0;
  const normalized = clean.includes(',') ? clean.replace(/\./g, '').replace(',', '.') : clean;
  const n = Number(normalized);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export const centsToInput = (cents: number) => brl.format(cents / 100);
