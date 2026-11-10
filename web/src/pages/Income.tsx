import { Pencil, Plus } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../api';
import { Field, Skeleton } from '../components/ui';
import { centsToInput, money, monthShort, parseMoney } from '../format';
import { useApp, useFetch } from '../store';
import type { Income as IncomeT, Settings } from '../types';

export default function Income() {
  const { openForm, settings } = useApp();
  const { data, error } = useFetch<IncomeT[]>('/incomes');
  const total = (data ?? []).filter((i) => !i.start_month && !i.end_month).reduce((a, i) => a + i.amount_cents, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card">
        <div className="page-head">
          <div>
            <h2>Minha renda</h2>
            <div className="sub">Valores líquidos mensais. É a base do “Saldo previsto”. Renda fixa: {money(total)}</div>
          </div>
          <button className="btn primary" onClick={() => openForm({ kind: 'income' })}>
            <Plus size={16} /> Nova renda
          </button>
        </div>
        {error && <p className="neg">{error}</p>}
        {!data ? (
          <Skeleton />
        ) : (
          <ul className="list">
            {data.map((i) => (
              <li key={i.id}>
                <div className="grow">
                  {i.description}
                  {(i.start_month || i.end_month) && (
                    <div className="label">
                      {i.start_month ? monthShort(i.start_month) : '…'} → {i.end_month ? monthShort(i.end_month) : '…'}
                    </div>
                  )}
                </div>
                <span className="amt">{money(i.amount_cents)}</span>
                <button className="icon-btn ghost" onClick={() => openForm({ kind: 'income', item: i })} aria-label="Editar">
                  <Pencil size={15} />
                </button>
              </li>
            ))}
            {data.length === 0 && <li className="muted">Nenhuma renda cadastrada.</li>}
          </ul>
        )}
      </div>
      {settings && <SettingsCard s={settings} />}
    </div>
  );
}

function SettingsCard({ s }: { s: Settings }) {
  const { refresh, toast } = useApp();
  const [name, setName] = useState(s.me_name);
  const [budget, setBudget] = useState(centsToInput(s.month_budget_cents));
  const [ref, setRef] = useState(String(s.housing_ref_pct));
  const [goal, setGoal] = useState(centsToInput(s.reserve_goal_cents));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setName(s.me_name);
    setBudget(centsToInput(s.month_budget_cents));
    setRef(String(s.housing_ref_pct));
    setGoal(centsToInput(s.reserve_goal_cents));
  }, [s]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.put('/settings', {
        me_name: name,
        month_budget_cents: parseMoney(budget),
        housing_ref_pct: Number(ref),
        reserve_goal_cents: parseMoney(goal),
      });
      toast('Configurações salvas ✔');
      refresh();
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <div className="page-head">
        <div>
          <h2>Configurações</h2>
          <div className="sub">Seu nome, orçamento das contas do mês e metas.</div>
        </div>
      </div>
      <form className="form" onSubmit={save}>
        <Field label="Seu nome"><input value={name} onChange={(e) => setName(e.target.value)} required /></Field>
        <Field label="Orçamento das contas do mês (R$)" hint="Comida, roupas e eventualidades. Entra no saldo previsto.">
          <input inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} />
        </Field>
        <Field label="Referência de moradia (% do salário)">
          <input type="number" min={0} max={100} value={ref} onChange={(e) => setRef(e.target.value)} />
        </Field>
        <Field label="Meta da reserva (R$)">
          <input inputMode="decimal" value={goal} onChange={(e) => setGoal(e.target.value)} />
        </Field>
        <div className="form-actions">
          <button className="btn primary" disabled={busy}>{busy ? 'Salvando…' : 'Salvar configurações'}</button>
        </div>
      </form>
    </div>
  );
}
