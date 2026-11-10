import { Pencil, Plus } from 'lucide-react';
import { Skeleton } from '../components/ui';
import { dd, money, monthShort } from '../format';
import { useApp, useFetch } from '../store';
import type { Bill } from '../types';

function period(b: Bill) {
  if (!b.start_month && !b.end_month) return 'Recorrente';
  if (b.start_month && b.start_month === b.end_month) return `Só ${monthShort(b.start_month)}`;
  return `${b.start_month ? monthShort(b.start_month) : '…'} → ${b.end_month ? monthShort(b.end_month) : '…'}`;
}

export default function Bills({ scope }: { scope: 'house' | 'personal' }) {
  const { openForm, settings } = useApp();
  const { data, error } = useFetch<Bill[]>('/bills');
  const bills = (data ?? []).filter((b) => b.scope === scope);
  const total = bills.reduce((a, b) => a + b.amount_cents, 0);
  const title = scope === 'house' ? 'Contas da casa' : 'Contas pessoais';
  const who = (b: Bill) => (b.payer === 'me' ? settings?.me_name ?? 'Eu' : settings?.partner_name ?? 'Parceiro(a)');

  return (
    <div className="card">
      <div className="page-head">
        <div>
          <h2>{title}</h2>
          <div className="sub">
            {scope === 'house'
              ? `Divididas entre o casal (${settings?.my_share_pct ?? 50}% / ${100 - (settings?.my_share_pct ?? 50)}%). Total cadastrado: ${money(total)}`
              : `Só suas — entram no saldo e em “Contas a pagar”. Total: ${money(total)}`}
          </div>
        </div>
        <button className="btn primary" onClick={() => openForm({ kind: 'bill', scope })}>
          <Plus size={16} /> Nova conta
        </button>
      </div>
      {error && <p className="neg">{error}</p>}
      {!data && <Skeleton />}
      {data && bills.length === 0 && <div className="empty-state">Nenhuma conta cadastrada ainda.</div>}
      {bills.length > 0 && (
        <>
          <div className="table-wrap responsive">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Nome</th>
                  {scope === 'house' && <th>Quem paga</th>}
                  <th>Vence</th>
                  <th>Período</th>
                  <th>Tags</th>
                  <th className="r">Valor</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {bills.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <b>{b.name}</b>
                      {b.note && <div className="label">{b.note}</div>}
                    </td>
                    {scope === 'house' && (
                      <td>
                        <span className="dot" style={{ background: b.payer === 'me' ? 'var(--primary)' : 'var(--pink)', marginRight: 6 }} />
                        {who(b)}
                      </td>
                    )}
                    <td>Dia {dd(b.due_day)}</td>
                    <td>{period(b)}</td>
                    <td>
                      <div className="tags">
                        {b.category && !(b.is_housing && b.category.toLowerCase() === 'moradia') && (
                          <span className="chip gray">{b.category}</span>
                        )}
                        {b.is_housing && <span className="chip blue">moradia</span>}
                        {b.estimated && <span className="chip amber">estimado</span>}
                        {b.featured && <span className="chip green">destaque</span>}
                      </div>
                    </td>
                    <td className="r"><b>{money(b.amount_cents)}</b></td>
                    <td className="r">
                      <button className="icon-btn ghost" onClick={() => openForm({ kind: 'bill', scope, item: b })} aria-label="Editar">
                        <Pencil size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={scope === 'house' ? 5 : 4}>Total</td>
                  <td className="r">{money(total)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
          <ul className="list m-list">
            {bills.map((b) => (
              <li key={b.id} onClick={() => openForm({ kind: 'bill', scope, item: b })} style={{ cursor: 'pointer' }}>
                {scope === 'house' && <span className="dot" style={{ background: b.payer === 'me' ? 'var(--primary)' : 'var(--pink)' }} />}
                <div className="grow">
                  <b>{b.name}</b>
                  <div className="label">
                    Dia {dd(b.due_day)} · {period(b)}
                    {scope === 'house' && ` · ${who(b)}`}
                  </div>
                </div>
                <span className="amt">{money(b.amount_cents)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
