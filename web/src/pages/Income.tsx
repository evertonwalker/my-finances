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
  const groups: { owner: 'me' | 'partner'; name: string }[] = [
    { owner: 'me', name: settings?.me_name ?? 'Eu' },
    { owner: 'partner', name: settings?.partner_name ?? 'Parceiro(a)' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card">
        <div className="page-head">
          <div>
            <h2>Nossa renda</h2>
            <div className="sub">Valores líquidos mensais. A sua renda é a base do “Saldo previsto”.</div>
          </div>
          <button className="btn primary" onClick={() => openForm({ kind: 'income' })}>
            <Plus size={16} /> Nova renda
          </button>
        </div>
        {error && <p className="neg">{error}</p>}
        {!data ? (
          <Skeleton />
        ) : (
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
            {groups.map((g) => {
              const items = data.filter((i) => i.owner === g.owner);
              return (
                <div key={g.owner}>
                  <div className="card-title" style={{ marginBottom: 6 }}>
                    <span className={`avatar sm ${g.owner}`}>{g.name.charAt(0)}</span> {g.name}
                  </div>
                  <ul className="list">
                    {items.map((i) => (
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
                    {items.length === 0 && <li className="muted">Nenhuma renda cadastrada.</li>}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {settings && <SettingsCard s={settings} />}
    </div>
  );
}

function SettingsCard({ s }: { s: Settings }) {
  const { refresh, toast } = useApp();
  const [me, setMe] = useState(s.me_name);
  const [partner, setPartner] = useState(s.partner_name);
  const [share, setShare] = useState(String(s.my_share_pct));
  const [daily, setDaily] = useState(centsToInput(s.daily_budget_cents));
  const [ref, setRef] = useState(String(s.housing_ref_pct));
  const [goal, setGoal] = useState(centsToInput(s.reserve_goal_cents));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setMe(s.me_name);
    setPartner(s.partner_name);
    setShare(String(s.my_share_pct));
    setDaily(centsToInput(s.daily_budget_cents));
    setRef(String(s.housing_ref_pct));
    setGoal(centsToInput(s.reserve_goal_cents));
  }, [s]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.put('/settings', {
        me_name: me, partner_name: partner, my_share_pct: Number(share), daily_budget_cents: parseMoney(daily),
        housing_ref_pct: Number(ref), reserve_goal_cents: parseMoney(goal),
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
          <h2>Configurações do casal</h2>
          <div className="sub">Nomes, divisão das contas da casa e metas.</div>
        </div>
      </div>
      <form className="form" onSubmit={save}>
        <Field label="Seu nome"><input value={me} onChange={(e) => setMe(e.target.value)} required /></Field>
        <Field label="Nome do(a) parceiro(a)"><input value={partner} onChange={(e) => setPartner(e.target.value)} required /></Field>
        <Field label="Sua parte nas contas da casa (%)" hint="50 = metade pra cada">
          <input type="number" min={0} max={100} step="0.1" value={share} onChange={(e) => setShare(e.target.value)} required />
        </Field>
        <Field label="Orçamento do dia a dia (R$)">
          <input inputMode="decimal" value={daily} onChange={(e) => setDaily(e.target.value)} />
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
