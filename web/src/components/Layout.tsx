import {
  ArrowLeftRight, Bell, Building2, ChevronDown, ChevronLeft, ChevronRight, CreditCard, Home, LayoutGrid, LogOut,
  Menu, Moon, PiggyBank, Plus, Receipt, Sun, Wallet,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { getToken, setToken } from '../api';
import { addMonths, currentMonth, daysUntil, dd, dueDate, money, monthLong, monthName, monthYear } from '../format';
import { useApp, useFetch } from '../store';
import type { Summary } from '../types';

const MENU = [
  { to: '/', label: 'Visão geral', icon: LayoutGrid },
  { to: '/fluxo', label: 'Fluxo de caixa', icon: ArrowLeftRight },
  { to: '/cartoes', label: 'Cartões', icon: CreditCard },
  { to: '/casa', label: 'Nossa casa', icon: Building2 },
  { to: '/reserva', label: 'Nossa reserva', icon: PiggyBank },
];
const SETTINGS_MENU = [
  { to: '/renda', label: 'Nossa renda', icon: Wallet },
  { to: '/contas-casa', label: 'Contas da casa', icon: Home },
  { to: '/contas-pessoais', label: 'Contas pessoais', icon: Receipt },
];

export function Layout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);

  return (
    <div className="shell">
      <div className={`backdrop ${open ? 'open' : ''}`} onClick={() => setOpen(false)} />
      <Sidebar open={open} />
      <main className="main">
        <Topbar onMenu={() => setOpen(true)} />
        {children}
      </main>
      <nav className="bottom-nav">
        {[
          { ...MENU[0], short: 'Início' },
          { ...SETTINGS_MENU[1], short: 'Casa' },
          { ...SETTINGS_MENU[2], short: 'Pessoais' },
          { ...MENU[2], short: 'Cartões' },
          { ...MENU[4], short: 'Reserva' },
        ].map((m) => (
          <NavLink key={m.to} to={m.to} end>
            <m.icon size={20} />
            {m.short}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

function Sidebar({ open }: { open: boolean }) {
  const { settings, theme, setTheme } = useApp();
  const me = settings?.me_name ?? 'Pessoa 1';
  const partner = settings?.partner_name ?? 'Parceiro(a)';
  return (
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <div className="brand">
        <div className="avatars">
          <span className="avatar me">{me.charAt(0)}</span>
          <span className="avatar partner">{partner.charAt(0)}</span>
        </div>
        <div>
          <div className="brand-title">Duo Finn</div>
          <div className="brand-sub">Finanças em casal</div>
        </div>
      </div>
      <nav className="nav">
        <div className="nav-label">Menu</div>
        {MENU.map((m) => (
          <NavLink key={m.to} to={m.to} end>
            <m.icon size={16} /> {m.label}
          </NavLink>
        ))}
        <div className="nav-label">Ajustes</div>
        {SETTINGS_MENU.map((m) => (
          <NavLink key={m.to} to={m.to} end>
            <m.icon size={16} /> {m.label}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-foot">
        <div className="theme-row">
          <span>
            <Sun size={16} /> Tema
          </span>
          <div className="seg-mini">
            <button className={theme === 'light' ? 'on' : ''} onClick={() => setTheme('light')} aria-label="Tema claro">
              <Sun size={14} />
            </button>
            <button className={theme === 'dark' ? 'on' : ''} onClick={() => setTheme('dark')} aria-label="Tema escuro">
              <Moon size={14} />
            </button>
          </div>
        </div>
        <div className="user-box">
          <span className="avatar me">{me.charAt(0)}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="name">{me}</div>
            <div className="status">com {partner}</div>
          </div>
          {getToken() && (
            <button
              className="icon-btn ghost"
              title="Sair"
              onClick={() => {
                setToken(null);
                location.reload();
              }}
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}

function useClickOutside(onOut: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && onOut();
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onOut]);
  return ref;
}

function Topbar({ onMenu }: { onMenu: () => void }) {
  const { month, setMonth, openForm } = useApp();
  const [addOpen, setAddOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const addRef = useClickOutside(() => setAddOpen(false));
  const bellRef = useClickOutside(() => setBellOpen(false));

  // Notificações: contas não pagas vencidas ou vencendo em até 7 dias (mês atual e próximo)
  const now = currentMonth();
  const { data: cur } = useFetch<Summary>(`/summary?month=${now}`);
  const { data: next } = useFetch<Summary>(`/summary?month=${addMonths(now, 1)}`);
  const alerts = [cur, next]
    .filter(Boolean)
    .flatMap((s) => s!.payables.items.filter((i) => !i.paid).map((i) => ({ ...i, month: s!.month, days: daysUntil(dueDate(s!.month, i.due_day)) })))
    .filter((i) => i.days <= 7)
    .sort((a, b) => a.days - b.days);

  const options: string[] = [];
  for (let n = -24; n <= 24; n++) options.push(addMonths(now, n));

  const go = (m: string) => {
    setMonth(m);
    const url = new URL(location.href);
    url.searchParams.set('m', m);
    history.replaceState(null, '', url);
  };

  const add = (f: Parameters<typeof openForm>[0]) => {
    setAddOpen(false);
    openForm(f);
  };

  return (
    <header className="topbar">
      <button className="icon-btn menu-toggle" onClick={onMenu} aria-label="Abrir menu">
        <Menu size={18} />
      </button>
      <div className="month-nav">
        <button className="icon-btn ghost" onClick={() => go(addMonths(month, -1))} aria-label="Mês anterior">
          <ChevronLeft size={18} />
        </button>
        <button className="icon-btn ghost" onClick={() => go(addMonths(month, 1))} aria-label="Próximo mês">
          <ChevronRight size={18} />
        </button>
        <div className="month-picker">
          <div className="month-title">
            {monthName(month)} <span className="year">{monthYear(month)}</span>
            <ChevronDown size={16} className="muted" />
          </div>
          <select value={month} onChange={(e) => go(e.target.value)} aria-label="Selecionar mês" className="month-select"
            style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}>
            {options.map((m) => (
              <option key={m} value={m}>
                {monthLong(m)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="top-actions">
        <div className="dropdown" ref={bellRef}>
          <button className="icon-btn" onClick={() => setBellOpen((v) => !v)} aria-label="Notificações">
            <Bell size={17} />
            {alerts.length > 0 && <span className="badge">{alerts.length}</span>}
          </button>
          {bellOpen && (
            <div className="dropdown-menu" style={{ minWidth: 'min(300px, calc(100vw - 32px))', right: -56 }}>
              {alerts.length === 0 && <div className="empty">Nada vencendo nos próximos 7 dias 🎉</div>}
              {alerts.map((a) => (
                <div key={a.month + a.key} className={`notif-item ${a.days < 0 ? 'late' : ''}`}>
                  <div>
                    {a.name}
                    <small>
                      {a.days < 0 ? `Venceu há ${-a.days} dia(s)` : a.days === 0 ? 'Vence hoje' : `Vence em ${a.days} dia(s)`} · {dd(a.due_day)}/{a.month.slice(5)}
                    </small>
                  </div>
                  <strong>{money(a.amount_cents)}</strong>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="dropdown" ref={addRef}>
          <div className="split-btn">
            <button className="btn primary" onClick={() => add({ kind: 'bill', scope: 'house' })}>
              <Plus size={16} /> <span className="add-label">Adicionar</span>
            </button>
            <button className="btn primary" onClick={() => setAddOpen((v) => !v)} aria-label="Mais opções">
              <ChevronDown size={16} />
            </button>
          </div>
          {addOpen && (
            <div className="dropdown-menu">
              <button onClick={() => add({ kind: 'bill', scope: 'house' })}><Home size={16} /> Conta da casa</button>
              <button onClick={() => add({ kind: 'bill', scope: 'personal' })}><Receipt size={16} /> Conta pessoal</button>
              <button onClick={() => add({ kind: 'invoice', month })}><CreditCard size={16} /> Fatura de cartão</button>
              <button onClick={() => add({ kind: 'card' })}><CreditCard size={16} /> Novo cartão</button>
              <button onClick={() => add({ kind: 'income' })}><Wallet size={16} /> Renda</button>
              <button onClick={() => add({ kind: 'reserve' })}><PiggyBank size={16} /> Movimento na reserva</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
