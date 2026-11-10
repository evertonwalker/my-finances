export interface Settings {
  me_name: string;
  month_budget_cents: number;
  housing_ref_pct: number;
  reserve_goal_cents: number;
}

export interface Income {
  id: number;
  description: string;
  amount_cents: number;
  start_month: string | null;
  end_month: string | null;
}

export interface Bill {
  id: number;
  name: string;
  amount_cents: number;
  scope: 'house' | 'personal';
  due_day: number;
  is_housing: boolean;
  estimated: boolean;
  featured: boolean;
  category: string | null;
  note: string | null;
  start_month: string | null;
  end_month: string | null;
}

export type ExpenseCategory = 'comida' | 'roupas' | 'eventualidades' | 'outros';

export interface MonthlyExpense {
  id: number;
  date: string;
  description: string;
  category: ExpenseCategory;
  amount_cents: number;
}

export interface Card {
  id: number;
  name: string;
  bank: string;
  color: string;
  closing_day: number;
  due_day: number;
  limit_cents: number;
}

export interface Invoice {
  id: number;
  card_id: number;
  month: string;
  amount_cents: number;
}

export interface ReserveEntry {
  id: number;
  date: string;
  description: string;
  amount_cents: number;
}

export interface PayItem {
  key: string;
  ref_type: 'bill' | 'invoice';
  ref_id: number;
  name: string;
  amount_cents: number;
  due_day: number;
  scope: 'house' | 'personal' | 'card';
  paid: boolean;
}

export interface Summary {
  month: string;
  settings: Settings;
  balance: {
    salary_cents: number;
    house_cents: number;
    personal_cents: number;
    month_cents: number;
    free_cents: number;
    pct: { house: number; personal: number; month: number; free: number };
  };
  month_expenses: {
    spent_cents: number;
    budget_cents: number;
    remaining_cents: number;
    pct_of_budget: number;
    by_category: { category: ExpenseCategory; total_cents: number; count: number }[];
    recent: MonthlyExpense[];
  };
  payables: { total_cents: number; count: number; paid_count: number; items: PayItem[] };
  housing: {
    total_cents: number;
    pct_of_salary: number;
    ref_pct: number;
    items: { id: number; name: string; category: string | null; estimated: boolean; amount_cents: number }[];
  };
  cards: (Card & { invoice: (Invoice & { paid: boolean }) | null; free_limit_cents: number })[];
  invoice_timeline: { month: string; total_cents: number }[];
  featured: { id: number; name: string; amount_cents: number; estimated: boolean; note: string | null; category: string | null; due_day: number }[];
}

export interface CashflowRow {
  month: string;
  salary_cents: number;
  house_cents: number;
  personal_cents: number;
  month_cents: number;
  free_cents: number;
  accumulated_cents: number;
}
