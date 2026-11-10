import { Hono } from 'hono';
import { z, type ZodTypeAny } from 'zod';
import { all, one, run, getSettings, DEFAULT_SETTINGS, EXPENSE_CATEGORIES } from './db.js';
import { Cents, Day, Month, OptMonth, bool } from './util.js';
import { buildSummary, buildCashflow } from './summary.js';

export const api = new Hono();

type Row = Record<string, unknown>;
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use o formato AAAA-MM-DD');

/** Cria rotas REST (GET lista / POST / PUT :id / DELETE :id) para uma tabela simples. */
function crud(path: string, table: string, schema: z.ZodObject<Record<string, ZodTypeAny>>, opts: {
  order: string;
  map?: (r: Row) => Row;
  /** filtro opcional da listagem a partir da query string */
  filter?: (q: (k: string) => string | undefined) => { where: string; args: (string | number)[] } | null;
}) {
  const map = opts.map ?? ((r: Row) => r);

  api.get(path, async (c) => {
    const f = opts.filter?.((k) => c.req.query(k)) ?? null;
    const rows = await all(`SELECT * FROM ${table} ${f ? `WHERE ${f.where}` : ''} ORDER BY ${opts.order}`, f?.args ?? []);
    return c.json(rows.map(map));
  });

  api.get(`${path}/:id`, async (c) => {
    const row = await one(`SELECT * FROM ${table} WHERE id = ?`, [Number(c.req.param('id'))]);
    return row ? c.json(map(row)) : c.json({ error: 'not_found' }, 404);
  });

  api.post(path, async (c) => {
    const parsed = schema.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: 'validation', issues: parsed.error.issues }, 400);
    const data = parsed.data as Row;
    const cols = Object.keys(data);
    const row = await one(
      `INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')}) RETURNING *`,
      cols.map((k) => data[k] as never),
    );
    return c.json(map(row!), 201);
  });

  api.put(`${path}/:id`, async (c) => {
    const id = Number(c.req.param('id'));
    const parsed = schema.partial().safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: 'validation', issues: parsed.error.issues }, 400);
    const data = parsed.data as Row;
    const cols = Object.keys(data).filter((k) => data[k] !== undefined);
    if (cols.length) {
      await run(`UPDATE ${table} SET ${cols.map((k) => `${k} = ?`).join(',')} WHERE id = ?`, [
        ...cols.map((k) => data[k] as never),
        id,
      ]);
    }
    const row = await one(`SELECT * FROM ${table} WHERE id = ?`, [id]);
    return row ? c.json(map(row)) : c.json({ error: 'not_found' }, 404);
  });

  api.delete(`${path}/:id`, async (c) => {
    await run(`DELETE FROM ${table} WHERE id = ?`, [Number(c.req.param('id'))]);
    return c.json({ ok: true });
  });
}

// ---------- Renda ----------
crud(
  '/incomes',
  'incomes',
  z.object({
    description: z.string().min(1),
    amount_cents: Cents,
    start_month: OptMonth,
    end_month: OptMonth,
  }),
  { order: 'amount_cents DESC' },
);

// ---------- Contas fixas (casa e pessoais) ----------
const mapBill = (r: Row) => ({
  ...r,
  is_housing: bool(r.is_housing),
  estimated: bool(r.estimated),
  featured: bool(r.featured),
});
crud(
  '/bills',
  'bills',
  z.object({
    name: z.string().min(1),
    amount_cents: Cents,
    scope: z.enum(['house', 'personal']),
    due_day: Day.default(5),
    is_housing: z.boolean().default(false),
    estimated: z.boolean().default(false),
    featured: z.boolean().default(false),
    category: z.string().nullish().transform((v) => v || null),
    note: z.string().nullish().transform((v) => v || null),
    start_month: OptMonth,
    end_month: OptMonth,
  }),
  { order: 'scope, amount_cents DESC', map: mapBill },
);

// ---------- Gastos mensais (gastos variáveis) ----------
crud(
  '/expenses',
  'monthly_expenses',
  z.object({
    date: IsoDate,
    description: z.string().min(1),
    category: z.enum(EXPENSE_CATEGORIES).default('outros'),
    amount_cents: Cents.min(0),
  }),
  {
    order: 'date DESC, id DESC',
    filter: (q) => {
      const m = Month.safeParse(q('month'));
      return m.success ? { where: `to_char(date, 'YYYY-MM') = ?`, args: [m.data] } : null;
    },
  },
);

// ---------- Cartões ----------
crud(
  '/cards',
  'cards',
  z.object({
    name: z.string().min(1),
    bank: z.string().min(1),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#1f1f1f'),
    closing_day: Day.default(28),
    due_day: Day.default(5),
    limit_cents: Cents.min(0).default(0),
  }),
  { order: 'id' },
);

// ---------- Faturas ----------
const InvoiceSchema = z.object({ card_id: z.number().int(), month: Month, amount_cents: Cents.min(0) });
api.get('/invoices', async (c) => {
  const cardId = c.req.query('card_id');
  const rows = cardId
    ? await all('SELECT * FROM invoices WHERE card_id = ? ORDER BY month', [Number(cardId)])
    : await all('SELECT * FROM invoices ORDER BY month, card_id');
  return c.json(rows);
});
// upsert: uma fatura por cartão/mês
api.post('/invoices', async (c) => {
  const parsed = InvoiceSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: 'validation', issues: parsed.error.issues }, 400);
  const { card_id, month, amount_cents } = parsed.data;
  const row = await one(
    `INSERT INTO invoices (card_id, month, amount_cents) VALUES (?, ?, ?)
     ON CONFLICT (card_id, month) DO UPDATE SET amount_cents = EXCLUDED.amount_cents
     RETURNING *`,
    [card_id, month, amount_cents],
  );
  return c.json(row, 201);
});
api.delete('/invoices/:id', async (c) => {
  await run('DELETE FROM invoices WHERE id = ?', [Number(c.req.param('id'))]);
  return c.json({ ok: true });
});

// ---------- Reserva ----------
crud(
  '/reserve',
  'reserve_entries',
  z.object({ date: IsoDate, description: z.string().min(1), amount_cents: Cents }),
  { order: 'date DESC, id DESC' },
);

// ---------- Pagamentos (marcar conta/fatura como paga no mês) ----------
const PaymentSchema = z.object({ ref_type: z.enum(['bill', 'invoice']), ref_id: z.number().int(), month: Month });
api.post('/payments/toggle', async (c) => {
  const parsed = PaymentSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: 'validation', issues: parsed.error.issues }, 400);
  const { ref_type, ref_id, month } = parsed.data;
  const existing = await one('SELECT id FROM payments WHERE ref_type = ? AND ref_id = ? AND month = ?', [ref_type, ref_id, month]);
  if (existing) {
    await run('DELETE FROM payments WHERE id = ?', [existing.id as number]);
    return c.json({ paid: false });
  }
  await run('INSERT INTO payments (ref_type, ref_id, month) VALUES (?, ?, ?)', [ref_type, ref_id, month]);
  return c.json({ paid: true });
});

// ---------- Configurações ----------
api.get('/settings', async (c) => c.json(await getSettings()));
api.put('/settings', async (c) => {
  const parsed = z
    .object({
      me_name: z.string().min(1),
      month_budget_cents: Cents.min(0),
      housing_ref_pct: z.number().min(0).max(100),
      reserve_goal_cents: Cents.min(0),
    })
    .partial()
    .safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: 'validation', issues: parsed.error.issues }, 400);
  for (const [k, v] of Object.entries(parsed.data)) {
    if (k in DEFAULT_SETTINGS && v !== undefined) {
      await run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', [k, String(v)]);
    }
  }
  return c.json(await getSettings());
});

// ---------- Visões calculadas ----------
api.get('/summary', async (c) => {
  const month = Month.safeParse(c.req.query('month'));
  if (!month.success) return c.json({ error: 'month obrigatório (AAAA-MM)' }, 400);
  return c.json(await buildSummary(month.data));
});

api.get('/cashflow', async (c) => {
  const month = Month.safeParse(c.req.query('from'));
  if (!month.success) return c.json({ error: 'from obrigatório (AAAA-MM)' }, 400);
  const months = Math.min(Math.max(Number(c.req.query('months')) || 12, 1), 24);
  return c.json(await buildCashflow(month.data, months));
});
