import { z } from 'zod';

export const monthRe = /^\d{4}-(0[1-9]|1[0-2])$/;
export const Month = z.string().regex(monthRe, 'Use o formato AAAA-MM');
export const OptMonth = Month.nullish().transform((v) => v ?? null);
export const Cents = z.number().int();
export const Day = z.number().int().min(1).max(31);

export function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function addMonths(month: string, n: number) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Item recorrente está ativo no mês se start <= mês <= end (ambos opcionais). */
export function activeIn(item: { start_month?: unknown; end_month?: unknown }, month: string) {
  const s = item.start_month as string | null | undefined;
  const e = item.end_month as string | null | undefined;
  return (!s || s <= month) && (!e || e >= month);
}

export const bool = (v: unknown) => v === 1 || v === true || v === '1';
