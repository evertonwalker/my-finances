import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { categoryInfo, EXPENSE_CATEGORIES } from '../categories';
import { Money, Skeleton } from '../components/ui';
import { money, monthLong, pct } from '../format';
import { useApp, useFetch } from '../store';
import type { ExpenseCategory, MonthlyExpense } from '../types';

const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

export default function MonthExpenses() {
  const { month, settings, openForm } = useApp();
  const { data, error } = useFetch<MonthlyExpense[]>(`/expenses?month=${month}`);
  const [filter, setFilter] = useState<ExpenseCategory | 'all'>('all');

  const all = data ?? [];
  const spent = all.reduce((a, e) => a + e.amount_cents, 0);
  const budget = settings?.month_budget_cents ?? 0;
  const over = budget > 0 && spent > budget;
  const usage = budget > 0 ? Math.round((spent / budget) * 1000) / 10 : 0;

  const totals = useMemo(() => {
    const t: Record<string, number> = {};
    for (const e of all) t[e.category] = (t[e.category] ?? 0) + e.amount_cents;
    return t;
  }, [all]);

  const visible = filter === 'all' ? all : all.filter((e) => e.category === filter);
  const byDay = useMemo(() => {
    const g = new Map<string, MonthlyExpense[]>();
    for (const e of visible) g.set(e.date, [...(g.get(e.date) ?? []), e]);
    return [...g.entries()];
  }, [visible]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card">
        <div className="card-head">
          <div>
            <div className="card-title">Gastos mensais</div>
            <div className="sub" style={{ marginTop: 2 }}>Gastos do dia a dia na rua: comida, roupas e eventualidades.</div>
            <div className="label" style={{ marginTop: 14 }}>Gasto em {monthLong(month).toLowerCase()}</div>
            <Money cents={spent} size="lg" className={over ? 'neg' : ''} />
          </div>
          <div className="illus" aria-hidden>🛍️</div>
        </div>
        {budget > 0 ? (
          <>
            <div className="gauge" style={{ marginTop: 18 }}>
              <div className="track">
                <div className={`bar ${over ? 'bad' : usage > 80 ? 'warn' : ''}`} style={{ width: `${Math.min(usage, 100)}%` }} />
              </div>
            </div>
            <div className="gauge-axis">
              <span>{pct(usage)} do orçamento</span>
              <span>Orçamento {money(budget)}</span>
            </div>
          </>
        ) : (
          <p className="sub">
            Sem orçamento definido. <Link to="/renda" style={{ color: 'var(--primary)' }}>Definir em Minha renda</Link>
          </p>
        )}
        <div className="stats" style={{ marginTop: 18 }}>
          {EXPENSE_CATEGORIES.map((c) => (
            <div className="stat" key={c.id}>
              <div className="label">{c.emoji} {c.label}</div>
              <b>{money(totals[c.id] ?? 0)}</b>
            </div>
          ))}
          {budget > 0 && (
            <div className="stat">
              <div className="label">{over ? 'Acima do orçamento' : 'Ainda pode gastar'}</div>
              <b className={over ? 'neg' : 'pos'}>{money(Math.abs(budget - spent))}</b>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="page-head">
          <h2>Lançamentos</h2>
          <button className="btn primary" onClick={() => openForm({ kind: 'expense' })}>
            <Plus size={16} /> Lançar gasto
          </button>
        </div>
        <div className="filter-chips">
          <button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>Todos · {all.length}</button>
          {EXPENSE_CATEGORIES.map((c) => (
            <button key={c.id} className={filter === c.id ? 'on' : ''} onClick={() => setFilter(c.id)}>
              {c.emoji} {c.label}
            </button>
          ))}
        </div>
        {error && <p className="neg">{error}</p>}
        {!data ? (
          <Skeleton />
        ) : byDay.length === 0 ? (
          <div className="empty-state">Nenhum gasto lançado {filter === 'all' ? 'neste mês' : 'nesta categoria'}.</div>
        ) : (
          byDay.map(([date, items]) => {
            const d = new Date(`${date}T12:00`);
            return (
              <div key={date}>
                <div className="day-head">
                  <span>{d.getDate()} · {WEEKDAYS[d.getDay()]}</span>
                  <span>{money(items.reduce((a, e) => a + e.amount_cents, 0))}</span>
                </div>
                <ul className="list">
                  {items.map((e) => {
                    const info = categoryInfo(e.category);
                    return (
                      <li key={e.id} onClick={() => openForm({ kind: 'expense', item: e })} style={{ cursor: 'pointer' }}>
                        <span className="cat-ico" style={{ background: 'var(--surface-2)' }} aria-hidden>{info.emoji}</span>
                        <div className="grow">
                          {e.description}
                          <div className="label">{info.label}</div>
                        </div>
                        <span className="amt">{money(e.amount_cents)}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
