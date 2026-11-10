import { all, getSettings, EXPENSE_CATEGORIES, type Settings } from './db.js';
import { activeIn, addMonths, bool } from './util.js';

type Income = { id: number; description: string; amount_cents: number; start_month: string | null; end_month: string | null };
type Bill = {
  id: number; name: string; amount_cents: number; scope: 'house' | 'personal'; due_day: number;
  is_housing: boolean; estimated: boolean; featured: boolean; category: string | null; note: string | null;
  start_month: string | null; end_month: string | null;
};
type Card = { id: number; name: string; bank: string; color: string; closing_day: number; due_day: number; limit_cents: number };
type Invoice = { id: number; card_id: number; month: string; amount_cents: number };
type Payment = { ref_type: 'bill' | 'invoice'; ref_id: number; month: string };
type ExpenseAgg = { month: string; category: string; total_cents: number; count: number };

async function loadAll() {
  const [settings, incomes, bills, cards, invoices, payments, expenses] = await Promise.all([
    getSettings(),
    all<Income>('SELECT * FROM incomes'),
    all<Bill>('SELECT * FROM bills ORDER BY amount_cents DESC'),
    all<Card>('SELECT * FROM cards ORDER BY id'),
    all<Invoice>('SELECT * FROM invoices'),
    all<Payment>('SELECT ref_type, ref_id, month FROM payments'),
    all<ExpenseAgg>(
      `SELECT to_char(date, 'YYYY-MM') AS month, category, SUM(amount_cents) AS total_cents, COUNT(*) AS count
       FROM monthly_expenses GROUP BY 1, 2`,
    ),
  ]);
  return { settings, incomes, bills, cards, invoices, payments, expenses };
}
type Data = Awaited<ReturnType<typeof loadAll>>;

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0);
const sum = <T>(xs: T[], f: (x: T) => number) => xs.reduce((a, x) => a + f(x), 0);

function core(month: string, d: Data) {
  const s: Settings = d.settings;
  const salary = sum(d.incomes.filter((i) => activeIn(i, month)), (i) => i.amount_cents);

  const bills = d.bills.filter((b) => activeIn(b, month));
  const houseBills = bills.filter((b) => b.scope === 'house');
  const personalBills = bills.filter((b) => b.scope === 'personal');
  const invoices = d.invoices.filter((i) => i.month === month);

  const houseTotal = sum(houseBills, (b) => b.amount_cents);
  const personalTotal = sum(personalBills, (b) => b.amount_cents) + sum(invoices, (i) => i.amount_cents);

  // Gastos mensais: usa o orçamento; se já gastou mais, usa o gasto real
  const monthExpenses = d.expenses.filter((e) => e.month === month);
  const monthSpent = sum(monthExpenses, (e) => e.total_cents);
  const monthBudget = s.month_budget_cents;
  const monthCost = Math.max(monthBudget, monthSpent);

  const free = salary - houseTotal - personalTotal - monthCost;
  return { s, salary, bills, houseBills, personalBills, invoices, houseTotal, personalTotal, monthExpenses, monthSpent, monthBudget, monthCost, free };
}

export async function buildSummary(month: string) {
  const d = await loadAll();
  const c = core(month, d);
  const isPaid = (ref_type: 'bill' | 'invoice', ref_id: number) =>
    d.payments.some((p) => p.ref_type === ref_type && p.ref_id === ref_id && p.month === month);

  // ----- Contas a pagar (contas fixas + faturas do mês) -----
  const payItems = [
    ...c.bills.map((b) => ({
      key: `bill-${b.id}`, ref_type: 'bill' as const, ref_id: b.id, name: b.name,
      amount_cents: b.amount_cents, due_day: b.due_day, scope: b.scope, paid: isPaid('bill', b.id),
    })),
    ...c.invoices.map((i) => {
      const card = d.cards.find((cd) => cd.id === i.card_id);
      return {
        key: `invoice-${i.id}`, ref_type: 'invoice' as const, ref_id: i.id, name: `Fatura ${card?.name ?? 'cartão'}`,
        amount_cents: i.amount_cents, due_day: card?.due_day ?? 1, scope: 'card' as const, paid: isPaid('invoice', i.id),
      };
    }),
  ].sort((a, b) => a.due_day - b.due_day || b.amount_cents - a.amount_cents);

  // ----- Moradia -----
  const housingItems = c.houseBills
    .filter((b) => bool(b.is_housing))
    .map((b) => ({ id: b.id, name: b.name, category: b.category, estimated: bool(b.estimated), amount_cents: b.amount_cents }));
  const housingTotal = sum(housingItems, (i) => i.amount_cents);

  // ----- Cartões -----
  const cards = d.cards.map((card) => {
    const inv = c.invoices.find((i) => i.card_id === card.id) ?? null;
    const future = sum(d.invoices.filter((i) => i.card_id === card.id && i.month > month), (i) => i.amount_cents);
    const openNow = inv && !isPaid('invoice', inv.id) ? inv.amount_cents : 0;
    return {
      ...card,
      invoice: inv ? { ...inv, paid: isPaid('invoice', inv.id) } : null,
      free_limit_cents: Math.max(card.limit_cents - openNow - future, 0),
    };
  });
  const invoiceTimeline = [0, 1, 2].map((n) => {
    const m = addMonths(month, n);
    return { month: m, total_cents: sum(d.invoices.filter((i) => i.month === m), (i) => i.amount_cents) };
  });

  // ----- Gastos mensais por categoria -----
  const byCategory = EXPENSE_CATEGORIES.map((cat) => {
    const e = c.monthExpenses.find((x) => x.category === cat);
    return { category: cat, total_cents: e?.total_cents ?? 0, count: e?.count ?? 0 };
  });
  const recent = await all<{ id: number; date: string; description: string; category: string; amount_cents: number }>(
    `SELECT * FROM monthly_expenses WHERE to_char(date, 'YYYY-MM') = ? ORDER BY date DESC, id DESC LIMIT 5`,
    [month],
  );

  // ----- Destaques -----
  const featured = c.bills
    .filter((b) => bool(b.featured))
    .map((b) => ({ id: b.id, name: b.name, amount_cents: b.amount_cents, estimated: bool(b.estimated), note: b.note, category: b.category, due_day: b.due_day }));

  return {
    month,
    settings: c.s,
    balance: {
      salary_cents: c.salary,
      house_cents: c.houseTotal,
      personal_cents: c.personalTotal,
      month_cents: c.monthCost,
      free_cents: c.free,
      pct: {
        house: pct(c.houseTotal, c.salary),
        personal: pct(c.personalTotal, c.salary),
        month: pct(c.monthCost, c.salary),
        free: pct(c.free, c.salary),
      },
    },
    month_expenses: {
      spent_cents: c.monthSpent,
      budget_cents: c.monthBudget,
      remaining_cents: c.monthBudget - c.monthSpent,
      pct_of_budget: pct(c.monthSpent, c.monthBudget),
      by_category: byCategory,
      recent,
    },
    payables: {
      total_cents: sum(payItems, (i) => i.amount_cents),
      count: payItems.length,
      paid_count: payItems.filter((i) => i.paid).length,
      items: payItems,
    },
    housing: {
      total_cents: housingTotal,
      pct_of_salary: pct(housingTotal, c.salary),
      ref_pct: c.s.housing_ref_pct,
      items: housingItems,
    },
    cards,
    invoice_timeline: invoiceTimeline,
    featured,
  };
}

export async function buildCashflow(from: string, months: number) {
  const d = await loadAll();
  const rows = [];
  let accumulated = 0;
  for (let n = 0; n < months; n++) {
    const m = addMonths(from, n);
    const c = core(m, d);
    accumulated += c.free;
    rows.push({
      month: m,
      salary_cents: c.salary,
      house_cents: c.houseTotal,
      personal_cents: c.personalTotal,
      month_cents: c.monthCost,
      free_cents: c.free,
      accumulated_cents: accumulated,
    });
  }
  return rows;
}
