import { Hono } from 'hono';
import { z, type ZodTypeAny } from 'zod';
import { all, one, run, getSettings, DEFAULT_SETTINGS } from './db.js';
import { Cents, Day, Month, OptMonth, bool } from './util.js';
import { buildSummary, buildCashflow } from './summary.js';

export const api = new Hono();

type Row = Record<string, unknown>;

/** Cria rotas REST (GET lista / POST / PUT :id / DELETE :id) para uma tabela simples. */
function crud(path: string, table: string, schema: z.ZodObject<Record<string, ZodTypeAny>>, opts: {
  order: string;
  map?: (r: Row) => Row;
  toDb?: (d: Row) => Row;
}) {
  const map = opts.map ?? ((r: Row) => r);
  const toDb = opts.toDb ?? ((d: Row) => d);

  api.get(path, async (c) => c.json((await all(`SELECT * FROM ${table} ORDER BY ${opts.order}`)).map(map)));

  api.get(`${path}/:id`, async (c) => {
    const row = await one(`SELECT * FROM ${table} WHERE id = ?`, [Number(c.req.param('id'))]);
    return row ? c.json(map(row)) : c.json({ error: 'not_found' }, 404);
  });

  api.post(path, async (c) => {
    const parsed = schema.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: 'validation', issues: parsed.error.issues }, 400);
    const data = toDb(parsed.data);
    const cols = Object.keys(data);
    const rs = await run(
      `INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`,
      cols.map((k) => data[k] as never),
    );
    const row = await one(`SELECT * FROM ${table} WHERE id = ?`, [Number(rs.lastInsertRowid)]);
    return c.json(map(row!), 201);
  });

  api.put(`${path}/:id`, async (c) => {
    const id = Number(c.req.param('id'));
    const parsed = schema.partial().safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: 'validation', issues: parsed.error.issues }, 400);
    const data = toDb(parsed.data);
    const cols = Object.keys(data);
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

// ---------- Rendas ----------
crud(
  '/incomes',
  'incomes',
  z.object({
    owner: z.enum(['me', 'partner']),
    description: z.string().min(1),
    amount_cents: Cents,
    start_month: OptMonth,
    end_month: OptMonth,
  }),
  { order: 'owner, amount_cents DESC' },
);

// ---------- Contas (casa e pessoais) ----------
const boolToInt = (d: Row) => {
  const out: Row = { ...d };
  for (const k of ['is_housing', 'estimated', 'featured']) if (k in out) out[k] = out[k] ? 1 : 0;
  return out;
};
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
    payer: z.enum(['me', 'partner']).default('me'),
    due_day: Day.default(5),
    is_housing: z.boolean().default(false),
    estimated: z.boolean().default(false),
    featured: z.boolean().default(false),
    category: z.string().nullish().transform((v) => v || null),
    note: z.string().nullish().transform((v) => v || null),
    start_month: OptMonth,
    end_month: OptMonth,
  }),
  { order: 'scope, amount_cents DESC', map: mapBill, toDb: boolToInt },
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
  await run(
    `INSERT INTO invoices (card_id, month, amount_cents) VALUES (?, ?, ?)
     ON CONFLICT(card_id, month) DO UPDATE SET amount_cents = excluded.amount_cents`,
    [card_id, month, amount_cents],
  );
  return c.json(await one('SELECT * FROM invoices WHERE card_id = ? AND month = ?', [card_id, month]), 201);
});
api.delete('/invoices/:id', async (c) => {
  await run('DELETE FROM invoices WHERE id = ?', [Number(c.req.param('id'))]);
  return c.json({ ok: true });
});

// ---------- Reserva ----------
crud(
  '/reserve',
  'reserve_entries',
  z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    description: z.string().min(1),
    amount_cents: Cents,
  }),
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

// ---------- Acerto do mês (Pix entre o casal) ----------
api.post('/settlements/:month/toggle', async (c) => {
  const month = Month.safeParse(c.req.param('month'));
  if (!month.success) return c.json({ error: 'validation' }, 400);
  const body = await c.req.json().catch(() => ({}));
  const existing = await one('SELECT month FROM settlements WHERE month = ?', [month.data]);
  if (existing) {
    await run('DELETE FROM settlements WHERE month = ?', [month.data]);
    return c.json({ done: false });
  }
  await run('INSERT INTO settlements (month, amount_cents) VALUES (?, ?)', [month.data, Number(body.amount_cents) || 0]);
  return c.json({ done: true });
});

// ---------- Configurações ----------
api.get('/settings', async (c) => c.json(await getSettings()));
api.put('/settings', async (c) => {
  const parsed = z
    .object({
      me_name: z.string().min(1),
      partner_name: z.string().min(1),
      my_share_pct: z.number().min(0).max(100),
      daily_budget_cents: Cents.min(0),
      housing_ref_pct: z.number().min(0).max(100),
      reserve_goal_cents: Cents.min(0),
    })
    .partial()
    .safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: 'validation', issues: parsed.error.issues }, 400);
  for (const [k, v] of Object.entries(parsed.data)) {
    if (k in DEFAULT_SETTINGS && v !== undefined) {
      await run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [k, String(v)]);
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
