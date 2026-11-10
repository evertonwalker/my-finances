import pg from 'pg';

/**
 * DATABASE_URL:
 *  - local (padrão): Postgres do docker-compose -> postgres://finances:finances@localhost:5433/finances
 *  - produção: qualquer Postgres (ex.: Neon grátis) -> postgres://user:pass@host/db?sslmode=require
 */
const connectionString = process.env.DATABASE_URL || 'postgres://finances:finances@localhost:5433/finances';

// BIGINT (int8) e NUMERIC como number; DATE como string 'AAAA-MM-DD'
pg.types.setTypeParser(20, (v) => Number(v));
pg.types.setTypeParser(1700, (v) => Number(v));
pg.types.setTypeParser(1082, (v) => v);

export const pool = new pg.Pool({ connectionString, max: 5 });

type Arg = string | number | boolean | null | undefined;

/** Converte placeholders "?" em "$1, $2..." (estilo Postgres). */
function toPg(sql: string) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

export async function all<T = Record<string, unknown>>(sql: string, args: Arg[] = []): Promise<T[]> {
  const rs = await pool.query(toPg(sql), args);
  return rs.rows as T[];
}

export async function one<T = Record<string, unknown>>(sql: string, args: Arg[] = []): Promise<T | undefined> {
  return (await all<T>(sql, args))[0];
}

export async function run(sql: string, args: Arg[] = []) {
  return pool.query(toPg(sql), args);
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS incomes (
    id SERIAL PRIMARY KEY,
    description TEXT NOT NULL,
    amount_cents BIGINT NOT NULL,
    start_month TEXT,
    end_month TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS bills (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    amount_cents BIGINT NOT NULL,
    scope TEXT NOT NULL CHECK (scope IN ('house','personal')),
    due_day INTEGER NOT NULL DEFAULT 5,
    is_housing BOOLEAN NOT NULL DEFAULT FALSE,
    estimated BOOLEAN NOT NULL DEFAULT FALSE,
    featured BOOLEAN NOT NULL DEFAULT FALSE,
    category TEXT,
    note TEXT,
    start_month TEXT,
    end_month TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS cards (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    bank TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#1f1f1f',
    closing_day INTEGER NOT NULL DEFAULT 28,
    due_day INTEGER NOT NULL DEFAULT 5,
    limit_cents BIGINT NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS invoices (
    id SERIAL PRIMARY KEY,
    card_id INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    month TEXT NOT NULL,
    amount_cents BIGINT NOT NULL,
    UNIQUE (card_id, month)
  )`,
  `CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    ref_type TEXT NOT NULL CHECK (ref_type IN ('bill','invoice')),
    ref_id INTEGER NOT NULL,
    month TEXT NOT NULL,
    paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (ref_type, ref_id, month)
  )`,
  `CREATE TABLE IF NOT EXISTS reserve_entries (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    description TEXT NOT NULL,
    amount_cents BIGINT NOT NULL
  )`,
  // Gastos mensais: gastos variáveis na rua (comida, roupas, eventualidades...)
  `CREATE TABLE IF NOT EXISTS monthly_expenses (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'outros',
    amount_cents BIGINT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS monthly_expenses_date_idx ON monthly_expenses (date)`,
  // --- migração da versão "casal" para uso individual ---
  `DROP TABLE IF EXISTS settlements`,
  `ALTER TABLE incomes DROP COLUMN IF EXISTS owner`,
  `ALTER TABLE bills DROP COLUMN IF EXISTS payer`,
  `INSERT INTO settings (key, value)
     SELECT 'month_budget_cents', value FROM settings WHERE key = 'daily_budget_cents'
   ON CONFLICT (key) DO NOTHING`,
  `DELETE FROM settings WHERE key IN ('partner_name', 'my_share_pct', 'daily_budget_cents')`,
];

export const DEFAULT_SETTINGS: Record<string, string> = {
  me_name: 'Você',
  month_budget_cents: '150000',
  housing_ref_pct: '30',
  reserve_goal_cents: '10000000',
};

export const EXPENSE_CATEGORIES = ['comida', 'roupas', 'eventualidades', 'outros'] as const;

export async function migrate() {
  for (const sql of SCHEMA) await run(sql);
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
    await run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO NOTHING', [k, v]);
  }
}

export async function getSettings() {
  const rows = await all<{ key: string; value: string }>('SELECT key, value FROM settings');
  const s: Record<string, string> = { ...DEFAULT_SETTINGS };
  for (const r of rows) s[r.key] = r.value;
  return {
    me_name: s.me_name,
    month_budget_cents: Number(s.month_budget_cents),
    housing_ref_pct: Number(s.housing_ref_pct),
    reserve_goal_cents: Number(s.reserve_goal_cents),
  };
}
export type Settings = Awaited<ReturnType<typeof getSettings>>;
