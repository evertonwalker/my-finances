import { ArrowDownRight, ArrowUpRight, Building, Check, ChevronLeft, ChevronRight, CreditCard, KeyRound, Pencil, Wifi, Zap, Home } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { Money, Skeleton } from '../components/ui';
import { daysUntil, dd, dueDate, money, monthName, monthShort, pct } from '../format';
import { useApp, useFetch } from '../store';
import type { Summary } from '../types';

export default function Dashboard() {
  const { month } = useApp();
  const { data, error } = useFetch<Summary>(`/summary?month=${month}`);

  if (error) return <div className="card neg">Erro ao carregar: {error}</div>;
  if (!data)
    return (
      <div className="grid">
        <div className="span-2"><Skeleton h={240} /></div>
        <Skeleton h={240} />
        <Skeleton h={420} /><Skeleton h={420} /><Skeleton h={420} />
      </div>
    );

  return (
    <div className="grid">
      <div className="dash-left">
        <div className="span-2"><BalanceCard s={data} /></div>
        <HouseSplitCard s={data} />
        <CardsCard s={data} />
      </div>
      <div className="col-3-stack">
        <PayablesCard s={data} />
        <HousingCard s={data} />
      </div>
      {data.featured.map((f) => (
        <div className="card span-3" key={f.id}>
          <div className="featured">
            <div>
              <div className="card-title">{f.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '6px 0 4px' }}>
                <Money cents={f.amount_cents} size="md" approx={f.estimated} />
                {f.estimated && <span className="chip amber">estimado</span>}
              </div>
              <div className="sub">{f.note ?? `vence dia ${dd(f.due_day)}`}</div>
            </div>
            <div className="illus">{f.category?.toLowerCase().includes('obra') ? '🏗️' : '⭐'}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------
export function BalanceCard({ s }: { s: Summary }) {
  const b = s.balance;
  const positive = b.free_cents >= 0;
  const segs = [
    { label: 'Sua metade da casa', v: b.house_share_cents, p: b.pct.house, color: 'var(--navy)' },
    { label: 'Contas pessoais', v: b.personal_cents, p: b.pct.personal, color: 'var(--primary)' },
    { label: 'Dia a dia', v: b.daily_cents, p: b.pct.daily, color: 'var(--surface-3)' },
  ];
  const total = Math.max(b.salary_cents, b.house_share_cents + b.personal_cents + b.daily_cents, 1);
  return (
    <div className="card">
      <div className="card-head">
        <div className="card-title">Saldo previsto</div>
        <div className="illus" aria-hidden>👛</div>
      </div>
      <div className="saldo-row" style={{ marginTop: -20 }}>
        <Money cents={b.free_cents} size="xl" className={positive ? '' : 'neg'} />
        <div className={`saldo-note ${positive ? '' : 'neg'}`}>
          <strong>
            {positive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {pct(b.pct.free)} do salário livre
          </strong>
          <span className="sub">valor estimado após pagar todas as contas</span>
        </div>
      </div>
      <div className="stack-bar">
        {segs.map((sg) => (
          <div key={sg.label} style={{ width: `${(sg.v / total) * 100}%`, background: sg.color }} />
        ))}
        {positive && <div style={{ width: `${(b.free_cents / total) * 100}%`, background: 'var(--green)' }} />}
      </div>
      <div className="saldo-legend">
        <div>
          <div className="l">
            <Link to="/renda" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              Salário <Pencil size={11} />
            </Link>
          </div>
          <div className="v">{money(b.salary_cents)}</div>
        </div>
        {segs.map((sg) => (
          <div key={sg.label}>
            <div className="l"><span className="dot" style={{ background: sg.color }} /> {sg.label}</div>
            <div className="v">− {money(sg.v)} <small>· {pct(sg.p)}</small></div>
          </div>
        ))}
        <div>
          <div className="l"><span className="dot" style={{ background: 'var(--green)' }} /> <b>= Sobra</b></div>
          <div className={`v ${positive ? 'pos' : 'neg'}`}>{money(b.free_cents)} <small>· {pct(b.pct.free)}</small></div>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
export function PayablesCard({ s }: { s: Summary }) {
  const { refresh, toast } = useApp();
  const items = s.payables.items;
  const days = useMemo(() => {
    const m = new Map<number, { count: number; unpaid: number }>();
    for (const i of items) {
      const cur = m.get(i.due_day) ?? { count: 0, unpaid: 0 };
      cur.count++;
      if (!i.paid) cur.unpaid++;
      m.set(i.due_day, cur);
    }
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [items]);
  const firstUnpaidDay = days.find(([, d]) => d.unpaid > 0)?.[0];
  const [day, setDay] = useState<number | null>(null);
  const activeDay = day != null && days.some(([d]) => d === day) ? day : firstUnpaidDay ?? days[0]?.[0] ?? null;
  const unpaid = items.filter((i) => !i.paid);
  const nextDue = unpaid[0] ? daysUntil(dueDate(s.month, unpaid[0].due_day)) : null;
  const visible = activeDay == null ? items : items.filter((i) => i.due_day === activeDay);
  const unpaidTotal = unpaid.reduce((a, i) => a + i.amount_cents, 0);

  const toggle = async (ref_type: string, ref_id: number) => {
    const r = await api.post<{ paid: boolean }>('/payments/toggle', { ref_type, ref_id, month: s.month });
    toast(r.paid ? 'Marcada como paga ✔' : 'Marcada como pendente');
    refresh();
  };

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="card-title">
            Contas a pagar {firstUnpaidDay && <small>• dia {dd(firstUnpaidDay)}</small>}
          </div>
          <div style={{ margin: '10px 0 4px' }}><Money cents={unpaidTotal} size="lg" /></div>
          <div className="sub">
            {nextDue != null && (nextDue < 0 ? <span className="neg">vencida há {-nextDue} dias · </span> : `em ${nextDue} dias · `)}
            <b>{s.payables.paid_count} de {s.payables.count} pagas</b>
          </div>
        </div>
        <div className="illus" aria-hidden>📅</div>
      </div>
      <div className="days">
        {days.map(([d, info]) => (
          <button key={d} className={`day ${d === activeDay ? 'on' : ''} ${info.unpaid === 0 ? 'done' : ''}`} onClick={() => setDay(d)}>
            {dd(d)}
            <span className="dots">{Array.from({ length: Math.min(info.count, 6) }, (_, i) => <i key={i} />)}</span>
          </button>
        ))}
      </div>
      {items.length === 0 ? (
        <div className="empty-state">Nenhuma conta neste mês.</div>
      ) : (
        <ul className="list scroll-list">
          {visible.map((i) => (
            <li key={i.key} className={i.paid ? 'paid' : ''}>
              <button className={`check ${i.paid ? 'on' : ''}`} onClick={() => toggle(i.ref_type, i.ref_id)} aria-label={i.paid ? 'Desmarcar' : 'Marcar como paga'}>
                {i.paid && <Check size={12} strokeWidth={3} />}
              </button>
              <span className="grow">{i.name}</span>
              <span className="amt">{money(i.amount_cents)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ------------------------------------------------------------------
export function HouseSplitCard({ s }: { s: Summary }) {
  const { refresh, toast } = useApp();
  const h = s.house;
  const me = s.settings.me_name;
  const partner = s.settings.partner_name;
  const st = h.settlement;
  const iReceive = st.amount_cents > 0;

  const toggle = async () => {
    const r = await api.post<{ done: boolean }>(`/settlements/${s.month}/toggle`, { amount_cents: st.amount_cents });
    toast(r.done ? 'Acerto registrado ✔' : 'Acerto desfeito');
    refresh();
  };

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="card-title">Divisão da casa</div>
          <div className="label" style={{ marginTop: 14 }}>Total das contas</div>
          <Money cents={h.total_cents} size="lg" />
        </div>
        <div className="illus" aria-hidden>⚖️</div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', margin: '18px 0 6px' }}>
        <div>
          <div className="label"><span className="dot" style={{ background: 'var(--primary)' }} /> Você paga</div>
          <b style={{ fontSize: 15 }}>{money(h.paid_by_me_cents)}</b>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="label">{partner} paga <span className="dot" style={{ background: 'var(--pink)' }} /></div>
          <b style={{ fontSize: 15 }}>{money(h.paid_by_partner_cents)}</b>
        </div>
      </div>
      <div className="split-bar">
        <div style={{ width: `${h.me_pct}%`, background: 'var(--primary)' }}>{h.me_pct > 12 && pct(h.me_pct)}</div>
        <div style={{ flex: 1, background: 'var(--pink)', justifyContent: 'flex-end' }}>{h.partner_pct > 12 && pct(h.partner_pct)}</div>
        <span className="marker" style={{ left: `calc(${h.share_pct}% - 1px)` }} title={`Divisão combinada: ${h.share_pct}%`} />
      </div>
      <div className="card-title" style={{ fontSize: 12, marginTop: 22 }}>Quem paga cada conta</div>
      <ul className="list">
        {h.bills.map((b) => (
          <li key={b.id}>
            <span className="dot" style={{ background: b.payer === 'me' ? 'var(--primary)' : 'var(--pink)' }} />
            <span className="grow">{b.name}</span>
            <span className="amt">{money(b.amount_cents)}</span>
          </li>
        ))}
        {h.bills.length === 0 && <li className="muted">Nenhuma conta da casa. Cadastre em “Contas da casa”.</li>}
      </ul>
      {st.amount_cents !== 0 && (
        <div className="settle">
          <span className={`avatar sm ${iReceive ? 'partner' : 'me'}`}>{(iReceive ? partner : me).charAt(0)}</span>
          <span className="muted">→</span>
          <span className={`avatar sm ${iReceive ? 'me' : 'partner'}`}>{(iReceive ? me : partner).charAt(0)}</span>
          <span className="txt" style={st.done ? { textDecoration: 'line-through', color: 'var(--muted)' } : undefined}>
            {iReceive ? `${partner} te devolve` : `Você devolve para ${partner}`} <b>{money(Math.abs(st.amount_cents))}</b> <span className="muted">no Pix</span>
          </span>
          <button className="btn sm" onClick={toggle}>{st.done ? 'Desfazer' : 'Marcar feito'}</button>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------
function CardsCard({ s }: { s: Summary }) {
  const { openForm } = useApp();
  const rowRef = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);
  const cards = s.cards;
  const current = cards[idx];
  const monthTotal = s.invoice_timeline[0]?.total_cents ?? 0;
  const max = Math.max(...s.invoice_timeline.map((t) => t.total_cents), 1);

  const scrollTo = (i: number) => {
    const n = Math.max(0, Math.min(cards.length - 1, i));
    setIdx(n);
    const el = rowRef.current?.children[n] as HTMLElement | undefined;
    if (el && rowRef.current) rowRef.current.scrollTo({ left: el.offsetLeft - rowRef.current.offsetLeft, behavior: 'smooth' });
  };

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="card-title">Cartões</div>
          <div className="label" style={{ marginTop: 14 }}>Fatura de {monthName(s.month).toLowerCase()}</div>
          <Money cents={monthTotal} size="lg" />
        </div>
        <div className="illus" aria-hidden>💳</div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '14px 0' }}>
        {current ? (
          <button
            className="btn sm"
            onClick={() => openForm({ kind: 'invoice', cardId: current.id, month: s.month, amount_cents: current.invoice?.amount_cents })}
          >
            {current.invoice ? `Editar fatura · ${current.bank}` : `Lançar fatura · ${current.bank}`}
          </button>
        ) : (
          <button className="btn sm" onClick={() => openForm({ kind: 'card' })}>Adicionar cartão</button>
        )}
        {cards.length > 1 && (
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="icon-btn" style={{ width: 28, height: 28 }} disabled={idx === 0} onClick={() => scrollTo(idx - 1)} aria-label="Anterior">
              <ChevronLeft size={14} />
            </button>
            <button className="icon-btn" style={{ width: 28, height: 28 }} disabled={idx === cards.length - 1} onClick={() => scrollTo(idx + 1)} aria-label="Próximo">
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
      <div className="cards-row" ref={rowRef}>
        {cards.map((c) => (
          <CreditCardView key={c.id} c={c} month={s.month} />
        ))}
        {cards.length === 0 && <div className="empty-state" style={{ width: '100%' }}>Nenhum cartão cadastrado.</div>}
      </div>
      <div className="section-label">Próximas faturas</div>
      <div className="timeline">
        {s.invoice_timeline.map((t, i) => (
          <div key={t.month} className={`tl-col ${i === 0 ? 'on' : ''}`}>
            <span className="m">{i === 0 ? monthName(t.month).slice(0, 3) : monthShort(t.month)}</span>
            {i === 0 && <span className="chip blue" style={{ marginTop: 4, position: 'relative' }}>Aberta</span>}
            <div className="fill" style={{ height: `${Math.max((t.total_cents / max) * 55, 4)}%` }} />
            <span className="v">{money(t.total_cents)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CreditCardView({ c, month }: { c: Summary['cards'][number]; month: string }) {
  const status = c.invoice ? (c.invoice.paid ? 'Paga' : 'Aberta') : 'Sem fatura';
  return (
    <div className="credit" style={{ backgroundColor: c.color }}>
      <div className="top">
        <span>{c.bank}</span>
        <span className="tag">{status}</span>
      </div>
      <div className="mid">
        <span className="chipimg" />
        <span>{c.name.replace(c.bank, '').trim().toUpperCase() || c.name.toUpperCase()}</span>
        <CreditCard size={16} opacity={0.6} />
      </div>
      <div className="bottom">
        <div>Vence<b>{dd(c.due_day)}/{month.slice(5)}</b></div>
        <div style={{ textAlign: 'right' }}>Limite livre<b>{money(c.free_limit_cents)}</b></div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
const HOUSING_ICONS: [RegExp, typeof Home][] = [
  [/aluguel/i, KeyRound],
  [/cart[aã]o/i, CreditCard],
  [/luz|energia/i, Zap],
  [/internet|wi-?fi/i, Wifi],
  [/condom/i, Building],
];
const iconFor = (name: string) => HOUSING_ICONS.find(([re]) => re.test(name))?.[1] ?? Home;

export function HousingCard({ s }: { s: Summary }) {
  const [mode, setMode] = useState<'mine' | 'couple'>('mine');
  const h = s.housing;
  const value = mode === 'mine' ? h.pct_of_my_salary : h.pct_of_couple_salary;
  const scaleMax = Math.max(60, Math.ceil(value / 10) * 10);
  const tone = value <= h.ref_pct ? '' : value <= h.ref_pct + 10 ? 'warn' : 'bad';
  const total = mode === 'mine' ? h.total_cents : h.couple_total_cents;

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="card-title">Moradia</div>
          <div className="label" style={{ marginTop: 14 }}>{mode === 'mine' ? 'Quanto você gasta pra morar' : 'Quanto o casal gasta pra morar'}</div>
          <Money cents={total} size="lg" />
          <div className="sub" style={{ marginTop: 6 }}>
            <b className={tone ? 'neg' : 'pos'}>{tone ? '!' : '✓'} {pct(value)} do salário</b> &nbsp;referência: até {h.ref_pct}%
          </div>
        </div>
        <div className="illus" aria-hidden>🏠</div>
      </div>
      <div className="seg">
        <button className={mode === 'mine' ? 'on' : ''} onClick={() => setMode('mine')}>Só meu salário</button>
        <button className={mode === 'couple' ? 'on' : ''} onClick={() => setMode('couple')}>Salário do casal</button>
      </div>
      <div className="gauge">
        <div className="track">
          <div className={`bar ${tone}`} style={{ width: `${Math.min((value / scaleMax) * 100, 100)}%` }} />
        </div>
        <div className="ref" style={{ left: `${(h.ref_pct / scaleMax) * 100}%` }}>
          <span>{h.ref_pct}%</span>
        </div>
      </div>
      <div className="gauge-axis"><span>0%</span><span>{scaleMax}% do salário</span></div>
      <div className="card-title" style={{ fontSize: 12, marginTop: 20 }}>O que entra na conta</div>
      <div className="housing-grid">
        {h.items.map((i) => {
          const Icon = iconFor(i.name);
          return (
            <div className="housing-item" key={i.id}>
              <span className="ico"><Icon size={16} /></span>
              <div style={{ minWidth: 0 }}>
                <div className="n">{i.name}</div>
                <div className="v">{i.estimated && '≈ '}{money(mode === 'mine' ? i.share_cents : i.amount_cents)}</div>
              </div>
            </div>
          );
        })}
        {h.items.length === 0 && <div className="muted">Marque contas da casa como “moradia”.</div>}
      </div>
    </div>
  );
}
