/**
 * Popula o banco com os dados de exemplo do layout (Dezembro/2026).
 * ATENÇÃO: apaga os dados existentes. Uso: npm run seed
 */
import { migrate, one, pool, run } from './db.js';

await migrate();
await run('TRUNCATE incomes, bills, invoices, cards, payments, reserve_entries, settlements RESTART IDENTITY CASCADE');

const settings: Record<string, string> = {
  me_name: 'Pessoa 1',
  partner_name: 'Esposa',
  my_share_pct: '50',
  daily_budget_cents: '50000',
  housing_ref_pct: '30',
  reserve_goal_cents: '10000000',
};
for (const [k, v] of Object.entries(settings)) {
  await run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', [k, v]);
}

await run(`INSERT INTO incomes (owner, description, amount_cents) VALUES ('me', 'Salário', 2800000), ('partner', 'Salário', 2000000)`);

type B = [name: string, cents: number, scope: 'house' | 'personal', payer: 'me' | 'partner', due: number, housing: boolean, estimated: boolean, featured: boolean, category: string | null, note: string | null];
const bills: B[] = [
  // Contas da casa
  ['Aluguel', 480000, 'house', 'partner', 10, true, false, false, 'moradia', null],
  ['Guardar na reserva', 400000, 'house', 'me', 8, false, false, false, 'reserva', null],
  ['Apartamento Vila Olímpia', 233254, 'house', 'partner', 1, true, true, true, 'obra', 'juros de obra, débito na Caixa dia 01'],
  ['Cartão da casa', 215000, 'house', 'me', 10, true, false, false, 'cartão', null],
  ['Condomínio', 158000, 'house', 'me', 12, true, false, false, 'moradia', null],
  ['Luz', 34000, 'house', 'me', 15, true, false, false, 'moradia', null],
  ['Internet', 12990, 'house', 'me', 15, true, false, false, 'moradia', null],
  // Contas pessoais
  ['Ajuda pra família', 300000, 'personal', 'me', 5, false, false, false, 'família', null],
  ['Academia', 25000, 'personal', 'me', 5, false, false, false, 'saúde', null],
  ['Plano de saúde', 89980, 'personal', 'me', 5, false, false, false, 'saúde', null],
  ['Celular', 18000, 'personal', 'me', 5, false, false, false, 'serviços', null],
  ['Streaming', 20000, 'personal', 'me', 10, false, false, false, 'lazer', null],
  ['Curso de inglês', 200000, 'personal', 'me', 12, false, false, false, 'educação', null],
];
for (const b of bills) {
  await run(
    `INSERT INTO bills (name, amount_cents, scope, payer, due_day, is_housing, estimated, featured, category, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    b,
  );
}

const sId = (await one<{ id: number }>(
  `INSERT INTO cards (name, bank, color, closing_day, due_day, limit_cents) VALUES ('Santander Unique', 'Santander', '#1c1c1e', 28, 5, 4000000) RETURNING id`,
))!.id;
const iId = (await one<{ id: number }>(
  `INSERT INTO cards (name, bank, color, closing_day, due_day, limit_cents) VALUES ('Itaú Click', 'Itaú', '#ec7000', 5, 12, 1500000) RETURNING id`,
))!.id;
const inv: [number, string, number][] = [
  [sId, '2026-12', 799970],
  [sId, '2027-01', 929970],
  [sId, '2027-02', 1001970],
  [iId, '2027-01', 45000],
];
for (const i of inv) await run('INSERT INTO invoices (card_id, month, amount_cents) VALUES (?, ?, ?)', i);

const reserve: [string, string, number][] = [
  ['2026-09-08', 'Aporte mensal', 400000],
  ['2026-10-08', 'Aporte mensal', 400000],
  ['2026-11-08', 'Aporte mensal', 400000],
  ['2026-11-20', 'Conserto do carro', -120000],
];
for (const r of reserve) await run('INSERT INTO reserve_entries (date, description, amount_cents) VALUES (?, ?, ?)', r);

await pool.end();
console.log('Seed concluído ✔');
