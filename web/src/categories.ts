import type { ExpenseCategory } from './types';

/** Categorias dos "Gastos mensais" (gastos variáveis na rua). */
export const EXPENSE_CATEGORIES: { id: ExpenseCategory; label: string; emoji: string; color: string }[] = [
  { id: 'comida', label: 'Comida', emoji: '🍔', color: 'var(--amber)' },
  { id: 'roupas', label: 'Roupas', emoji: '👕', color: 'var(--primary)' },
  { id: 'eventualidades', label: 'Eventualidades', emoji: '⚡', color: 'var(--pink)' },
  { id: 'outros', label: 'Outros', emoji: '🧾', color: 'var(--muted)' },
];

export const categoryInfo = (id: string) => EXPENSE_CATEGORIES.find((c) => c.id === id) ?? EXPENSE_CATEGORIES[3];
