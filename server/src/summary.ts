import { all, getSettings, type Settings } from './db.js';
import { activeIn, addMonths, bool } from './util.js';

type Income = { id: number; owner: 'me' | 'partner'; description: string; amount_cents: number; start_month: string | null; end_month: string | null };
type Bill = {
  id: number; name: string; amount_cents: number; scope: 'house' | 'personal'; payer: 'me' | 'partner'; due_day: number;
  is_housing: boolean; estimated: boolean; featured: boolean; category: string | null; note: string | null;
  start_month: string | null; end_month: string | null;
};
type Card = { id: number; name: string; bank: string; color: string; closing_day: number; due_day: number; limit_cents: number };
type Invoice = { id: number; card_id: number; month: string; amount_cents: number };
type Payment = { ref_type: 'bill' | 'invoice'; ref_id: number; month: string };

async function loadAll() {
  const [settings, incomes, bills, cards, invoices, payments, settlements] = await Promise.all([
    getSettings(),
    all<Income>('SELECT * FROM incomes'),
    all<Bill>('SELECT * FROM bills ORDER BY amount_cents DESC'),
    all<Card>('SELECT * FROM cards ORDER BY id'),
    all<Invoice>('SELECT * FROM invoices'),
    all<Payment>('SELECT ref_type, ref_id, month FROM payments'),
    all<{ month: string }>('SELECT month FROM settlements'),
  ]);
  return { settings, incomes, bills, cards, invoices, payments, settlements };
}
type Data = Awaited<ReturnType<typeof loadAll>>;

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0);

function core(month: string, d: Data) {
  const s: Settings = d.settings;
  const share = s.my_share_pct / 100;

  const incomes = d.incomes.filter((i) => activeIn(i, month));
  const mySalary = incomes.filter((i) => i.owner === 'me').reduce((a, i) => a + i.amount_cents, 0);
  const partnerSalary = incomes.filter((i) => i.owner === 'partner').reduce((a, i) => a + i.amount_cents, 0);

  const bills = d.bills.filter((b) => activeIn(b, month));
  const houseBills = bills.filter((b) => b.scope === 'house');
  const personalBills = bills.filter((b) => b.scope === 'personal');
  const invoices = d.invoices.filter((i) => i.month === month);

  const houseTotal = houseBills.reduce((a, b) => a + b.amount_cents, 0);
  const myHouseShare = Math.round(houseTotal * share);
  const personalTotal =
    personalBills.reduce((a, b) => a + b.amount_cents, 0) + invoices.reduce((a, i) => a + i.amount_cents, 0);
  const daily = s.daily_budget_cents;
  const free = mySalary - myHouseShare - personalTotal - daily;

  return { s, share, incomes, mySalary, partnerSalary, bills, houseBills, personalBills, invoices, houseTotal, myHouseShare, personalTotal, daily, free };
}

export async function buildSummary(month: string) {
  const d = await loadAll();
  const c = core(month, d);
  const isPaid = (ref_type: 'bill' | 'invoice', ref_id: number) =>
    d.payments.some((p) => p.ref_type === ref_type && p.ref_id === ref_id && p.month === month);

  // ----- Divisão da casa -----
  const paidByMe = c.houseBills.filter((b) => b.payer === 'me').reduce((a, b) => a + b.amount_cents, 0);
  const paidByPartner = c.houseTotal - paidByMe;
  const settlement = paidByMe - c.myHouseShare; // > 0: parceiro(a) me devolve; < 0: eu devolvo

  // ----- Contas a pagar (o que sai da minha conta no mês) -----
  const payItems = [
    ...c.bills
      .filter((b) => b.scope === 'personal' || b.payer === 'me')
      .map((b) => ({
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
    .map((b) => ({
      id: b.id, name: b.name, category: b.category, estimated: bool(b.estimated),
      amount_cents: b.amount_cents, share_cents: Math.round(b.amount_cents * c.share),
    }));
  const housingTotal = housingItems.reduce((a, i) => a + i.share_cents, 0);
  const housingFull = housingItems.reduce((a, i) => a + i.amount_cents, 0);
  const coupleSalary = c.mySalary + c.partnerSalary;

  // ----- Cartões -----
  const cards = d.cards.map((card) => {
    const inv = c.invoices.find((i) => i.card_id === card.id) ?? null;
    const futureInvoices = d.invoices.filter((i) => i.card_id === card.id && i.month > month).reduce((a, i) => a + i.amount_cents, 0);
    return {
      ...card,
      invoice: inv ? { ...inv, paid: isPaid('invoice', inv.id) } : null,
      free_limit_cents: Math.max(card.limit_cents - (inv && !isPaid('invoice', inv.id) ? inv.amount_cents : 0) - futureInvoices, 0),
    };
  });
  const invoiceTimeline = [0, 1, 2].map((n) => {
    const m = addMonths(month, n);
    return { month: m, total_cents: d.invoices.filter((i) => i.month === m).reduce((a, i) => a + i.amount_cents, 0) };
  });

  // ----- Destaques (ex.: Obra) -----
  const featured = c.bills
    .filter((b) => bool(b.featured))
    .map((b) => ({ id: b.id, name: b.name, amount_cents: b.amount_cents, estimated: bool(b.estimated), note: b.note, category: b.category, due_day: b.due_day }));

  return {
    month,
    settings: c.s,
    balance: {
      salary_cents: c.mySalary,
      house_share_cents: c.myHouseShare,
      personal_cents: c.personalTotal,
      daily_cents: c.daily,
      free_cents: c.free,
      pct: {
        house: pct(c.myHouseShare, c.mySalary),
        personal: pct(c.personalTotal, c.mySalary),
        daily: pct(c.daily, c.mySalary),
        free: pct(c.free, c.mySalary),
      },
    },
    income: { me_cents: c.mySalary, partner_cents: c.partnerSalary, couple_cents: coupleSalary },
    house: {
      total_cents: c.houseTotal,
      paid_by_me_cents: paidByMe,
      paid_by_partner_cents: paidByPartner,
      my_share_cents: c.myHouseShare,
      partner_share_cents: c.houseTotal - c.myHouseShare,
      me_pct: pct(paidByMe, c.houseTotal),
      partner_pct: pct(paidByPartner, c.houseTotal),
      share_pct: c.s.my_share_pct,
      bills: c.houseBills.map((b) => ({ id: b.id, name: b.name, amount_cents: b.amount_cents, payer: b.payer })),
      settlement: {
        amount_cents: settlement,
        done: d.settlements.some((s) => s.month === month),
      },
    },
    payables: {
      total_cents: payItems.reduce((a, i) => a + i.amount_cents, 0),
      count: payItems.length,
      paid_count: payItems.filter((i) => i.paid).length,
      items: payItems,
    },
    housing: {
      total_cents: housingTotal,
      couple_total_cents: housingFull,
      pct_of_my_salary: pct(housingTotal, c.mySalary),
      pct_of_couple_salary: pct(housingFull, coupleSalary),
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
      salary_cents: c.mySalary,
      house_share_cents: c.myHouseShare,
      personal_cents: c.personalTotal,
      daily_cents: c.daily,
      free_cents: c.free,
      accumulated_cents: accumulated,
    });
  }
  return rows;
}
