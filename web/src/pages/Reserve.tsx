import { Pencil, Plus } from 'lucide-react';
import { Money, Skeleton } from '../components/ui';
import { money, pct } from '../format';
import { useApp, useFetch } from '../store';
import type { ReserveEntry } from '../types';

export default function Reserve() {
  const { openForm, settings } = useApp();
  const { data, error } = useFetch<ReserveEntry[]>('/reserve');
  const balance = (data ?? []).reduce((a, e) => a + e.amount_cents, 0);
  const goal = settings?.reserve_goal_cents ?? 0;
  const progress = goal > 0 ? Math.min((balance / goal) * 100, 100) : 0;
  const deposits = (data ?? []).filter((e) => e.amount_cents > 0).reduce((a, e) => a + e.amount_cents, 0);
  const withdrawals = (data ?? []).filter((e) => e.amount_cents < 0).reduce((a, e) => a + e.amount_cents, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card">
        <div className="card-head">
          <div>
            <div className="card-title">Nossa reserva</div>
            <div className="label" style={{ marginTop: 14 }}>Saldo atual</div>
            <Money cents={balance} size="lg" />
          </div>
          <div className="illus" aria-hidden>🐷</div>
        </div>
        <div className="gauge" style={{ marginTop: 26 }}>
          <div className="track"><div className="bar" style={{ width: `${progress}%` }} /></div>
        </div>
        <div className="gauge-axis">
          <span>{pct(Math.round(progress * 10) / 10)} da meta</span>
          <span>Meta {money(goal)}</span>
        </div>
        <div className="stats" style={{ marginTop: 20 }}>
          <div className="stat"><div className="label">Aportes</div><b className="pos">{money(deposits)}</b></div>
          <div className="stat"><div className="label">Resgates</div><b className="neg">{money(withdrawals)}</b></div>
          <div className="stat"><div className="label">Falta para a meta</div><b>{money(Math.max(goal - balance, 0))}</b></div>
        </div>
      </div>
      <div className="card">
        <div className="page-head">
          <h2>Movimentações</h2>
          <button className="btn primary" onClick={() => openForm({ kind: 'reserve' })}>
            <Plus size={16} /> Movimento
          </button>
        </div>
        {error && <p className="neg">{error}</p>}
        {!data ? (
          <Skeleton />
        ) : data.length === 0 ? (
          <div className="empty-state">Nenhuma movimentação ainda.</div>
        ) : (
          <ul className="list">
            {data.map((e) => (
              <li key={e.id}>
                <div className="grow">
                  {e.description}
                  <div className="label">{new Date(e.date + 'T12:00').toLocaleDateString('pt-BR')}</div>
                </div>
                <span className={`amt ${e.amount_cents < 0 ? 'neg' : 'pos'}`}>
                  {e.amount_cents < 0 ? '− ' : '+ '}
                  {money(Math.abs(e.amount_cents))}
                </span>
                <button className="icon-btn ghost" onClick={() => openForm({ kind: 'reserve', item: e })} aria-label="Editar">
                  <Pencil size={15} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
