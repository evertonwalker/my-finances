import { createClient, type InValue } from '@libsql/client';
import { mkdirSync } from 'node:fs';

/**
 * DATABASE_URL:
 *  - local (padrão): file:./data/finances.db
 *  - Turso (produção gratuita): libsql://<db>-<org>.turso.io  + DATABASE_AUTH_TOKEN
 */
const url = process.env.DATABASE_URL || 'file:./data/finances.db';
if (url.startsWith('file:')) mkdirSync('./data', { recursive: true });

export const db = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN });

export async function all<T = Record<string, unknown>>(sql: string, args: InValue[] = []): Promise<T[]> {
  const rs = await db.execute({ sql, args });
  return rs.rows.map((r) => ({ ...r }) as T);
}

export async function one<T = Record<string, unknown>>(sql: string, args: InValue[] = []): Promise<T | undefined> {
  return (await all<T>(sql, args))[0];
}

export async function run(sql: string, args: InValue[] = []) {
  return db.execute({ sql, args });
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS incomes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner TEXT NOT NULL CHECK (owner IN ('me','partner')),
    description TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    start_month TEXT,
    end_month TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS bills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    scope TEXT NOT NULL CHECK (scope IN ('house','personal')),
    payer TEXT NOT NULL DEFAULT 'me' CHECK (payer IN ('me','partner')),
    due_day INTEGER NOT NULL DEFAULT 5,
    is_housing INTEGER NOT NULL DEFAULT 0,
    estimated INTEGER NOT NULL DEFAULT 0,
    featured INTEGER NOT NULL DEFAULT 0,
    category TEXT,
    note TEXT,
    start_month TEXT,
    end_month TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    bank TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#1f1f1f',
    closing_day INTEGER NOT NULL DEFAULT 28,
    due_day INTEGER NOT NULL DEFAULT 5,
    limit_cents INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    card_id INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    month TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    UNIQUE (card_id, month)
  )`,
  `CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ref_type TEXT NOT NULL CHECK (ref_type IN ('bill','invoice')),
    ref_id INTEGER NOT NULL,
    month TEXT NOT NULL,
    paid_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (ref_type, ref_id, month)
  )`,
  `CREATE TABLE IF NOT EXISTS reserve_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    description TEXT NOT NULL,
    amount_cents INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS settlements (
    month TEXT PRIMARY KEY,
    amount_cents INTEGER NOT NULL,
    done_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
];

export const DEFAULT_SETTINGS: Record<string, string> = {
  me_name: 'Pessoa 1',
  partner_name: 'Esposa',
  my_share_pct: '50',
  daily_budget_cents: '50000',
  housing_ref_pct: '30',
  reserve_goal_cents: '10000000',
};

export async function migrate() {
  for (const sql of SCHEMA) await run(sql);
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
    await run('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', [k, v]);
  }
}

export async function getSettings() {
  const rows = await all<{ key: string; value: string }>('SELECT key, value FROM settings');
  const s: Record<string, string> = { ...DEFAULT_SETTINGS };
  for (const r of rows) s[r.key] = r.value;
  return {
    me_name: s.me_name,
    partner_name: s.partner_name,
    my_share_pct: Number(s.my_share_pct),
    daily_budget_cents: Number(s.daily_budget_cents),
    housing_ref_pct: Number(s.housing_ref_pct),
    reserve_goal_cents: Number(s.reserve_goal_cents),
  };
}
export type Settings = Awaited<ReturnType<typeof getSettings>>;
