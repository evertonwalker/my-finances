import { Pencil, Plus, Trash2 } from 'lucide-react';
import { api } from '../api';
import { Skeleton } from '../components/ui';
import { dd, money, monthLong } from '../format';
import { useApp, useFetch } from '../store';
import type { Invoice, Summary } from '../types';
import { CreditCardView } from './Dashboard';

export default function Cards() {
  const { month, openForm, refresh, toast } = useApp();
  const { data: summary } = useFetch<Summary>(`/summary?month=${month}`);
  const { data: invoices } = useFetch<Invoice[]>('/invoices');

  const delInvoice = async (id: number) => {
    if (!confirm('Excluir esta fatura?')) return;
    await api.del(`/invoices/${id}`);
    toast('Fatura excluída');
    refresh();
  };

  if (!summary) return <Skeleton h={300} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card">
        <div className="page-head">
          <div>
            <h2>Cartões</h2>
            <div className="sub">Cadastre os cartões e lance a fatura de cada mês.</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={() => openForm({ kind: 'invoice', month })}>
              <Plus size={16} /> Fatura
            </button>
            <button className="btn primary" onClick={() => openForm({ kind: 'card' })}>
              <Plus size={16} /> Cartão
            </button>
          </div>
        </div>
        {summary.cards.length === 0 && <div className="empty-state">Nenhum cartão cadastrado.</div>}
        <div className="grid">
          {summary.cards.map((c) => (
            <div key={c.id} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="cards-row" style={{ margin: 0, padding: 0 }}>
                <CreditCardView c={c} month={month} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <div className="sub">
                  Fecha dia {dd(c.closing_day)} · vence dia {dd(c.due_day)}
                  <br />
                  Limite {money(c.limit_cents)}
                </div>
                <button className="btn sm" onClick={() => openForm({ kind: 'card', item: c })}>
                  <Pencil size={13} /> Editar
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="page-head">
          <h2>Faturas lançadas</h2>
        </div>
        {!invoices ? (
          <Skeleton />
        ) : invoices.length === 0 ? (
          <div className="empty-state">Nenhuma fatura lançada.</div>
        ) : (
          <ul className="list">
            {[...invoices].reverse().map((i) => {
              const card = summary.cards.find((c) => c.id === i.card_id);
              return (
                <li key={i.id}>
                  <span className="dot" style={{ background: card?.color ?? 'var(--muted)' }} />
                  <div className="grow">
                    <b>{card?.name ?? 'Cartão removido'}</b>
                    <div className="label">{monthLong(i.month)}</div>
                  </div>
                  <span className="amt">{money(i.amount_cents)}</span>
                  <button className="icon-btn ghost" aria-label="Editar"
                    onClick={() => openForm({ kind: 'invoice', cardId: i.card_id, month: i.month, amount_cents: i.amount_cents })}>
                    <Pencil size={15} />
                  </button>
                  <button className="icon-btn ghost" aria-label="Excluir" onClick={() => delInvoice(i.id)}>
                    <Trash2 size={15} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
