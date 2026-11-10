import { useState, type FormEvent, type ReactNode } from 'react';
import { api } from '../api';
import { centsToInput, parseMoney } from '../format';
import { useApp, useFetch, type FormRequest } from '../store';
import type { Card } from '../types';
import { Field, Modal, Toggle } from './ui';

/** Renderiza o formulário pedido via openForm() — usado pelo "+ Adicionar" e pelas páginas. */
export function FormHost() {
  const { form, closeForm } = useApp();
  if (!form) return null;
  const titles: Record<FormRequest['kind'], string> = {
    bill: form.kind === 'bill' && form.scope === 'house' ? 'Conta da casa' : 'Conta pessoal',
    card: 'Cartão',
    invoice: 'Fatura do cartão',
    income: 'Renda',
    reserve: 'Movimento da reserva',
  };
  const editing = 'item' in form && form.item;
  return (
    <Modal title={`${editing ? 'Editar' : 'Nova'} ${titles[form.kind].toLowerCase()}`} onClose={closeForm}>
      {form.kind === 'bill' && <BillForm req={form} />}
      {form.kind === 'card' && <CardForm req={form} />}
      {form.kind === 'invoice' && <InvoiceForm req={form} />}
      {form.kind === 'income' && <IncomeForm req={form} />}
      {form.kind === 'reserve' && <ReserveForm req={form} />}
    </Modal>
  );
}

function useSubmit() {
  const { refresh, closeForm, toast } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (fn: () => Promise<unknown>, msg = 'Salvo ✔') => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      refresh();
      closeForm();
      toast(msg);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, submit };
}

function Actions({ busy, error, onDelete }: { busy: boolean; error: string | null; onDelete?: () => void }) {
  const { closeForm } = useApp();
  return (
    <>
      {error && <div className="form-error">{error}</div>}
      <div className="form-actions">
        {onDelete && (
          <button type="button" className="btn danger" onClick={() => confirm('Excluir este item?') && onDelete()} disabled={busy}>
            Excluir
          </button>
        )}
        <span className="spacer" />
        <button type="button" className="btn" onClick={closeForm}>
          Cancelar
        </button>
        <button className="btn primary" disabled={busy}>
          {busy ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
    </>
  );
}

function MoneyInput({ value, onChange, autoFocus }: { value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  return (
    <input
      inputMode="decimal"
      placeholder="0,00"
      value={value}
      autoFocus={autoFocus}
      required
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

const dayOptions = Array.from({ length: 31 }, (_, i) => i + 1);
function DaySelect({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(Number(e.target.value))}>
      {dayOptions.map((d) => (
        <option key={d} value={d}>
          Dia {String(d).padStart(2, '0')}
        </option>
      ))}
    </select>
  );
}

function Form({ onSubmit, children }: { onSubmit: () => void; children: ReactNode }) {
  return (
    <form
      className="form"
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      {children}
    </form>
  );
}

// ------------------------------------------------------------------
function BillForm({ req }: { req: Extract<FormRequest, { kind: 'bill' }> }) {
  const { settings } = useApp();
  const it = req.item;
  const [scope, setScope] = useState(it?.scope ?? req.scope);
  const [name, setName] = useState(it?.name ?? '');
  const [amount, setAmount] = useState(it ? centsToInput(it.amount_cents) : '');
  const [payer, setPayer] = useState(it?.payer ?? 'me');
  const [dueDay, setDueDay] = useState(it?.due_day ?? 5);
  const [isHousing, setIsHousing] = useState(it?.is_housing ?? false);
  const [estimated, setEstimated] = useState(it?.estimated ?? false);
  const [featured, setFeatured] = useState(it?.featured ?? false);
  const [category, setCategory] = useState(it?.category ?? '');
  const [note, setNote] = useState(it?.note ?? '');
  const [start, setStart] = useState(it?.start_month ?? '');
  const [end, setEnd] = useState(it?.end_month ?? '');
  const { busy, error, submit } = useSubmit();

  const save = () =>
    submit(() => {
      const body = {
        name, scope, payer: scope === 'personal' ? 'me' : payer, due_day: dueDay,
        amount_cents: parseMoney(amount), is_housing: scope === 'house' && isHousing, estimated, featured,
        category, note, start_month: start || null, end_month: end || null,
      };
      return it ? api.put(`/bills/${it.id}`, body) : api.post('/bills', body);
    });

  return (
    <Form onSubmit={save}>
      <Field label="Nome" full>
        <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus placeholder="Ex.: Aluguel" />
      </Field>
      <Field label="Valor (R$)">
        <MoneyInput value={amount} onChange={setAmount} />
      </Field>
      <Field label="Vencimento">
        <DaySelect value={dueDay} onChange={setDueDay} />
      </Field>
      <Field label="Tipo">
        <select value={scope} onChange={(e) => setScope(e.target.value as 'house' | 'personal')}>
          <option value="house">Conta da casa (dividida)</option>
          <option value="personal">Conta pessoal</option>
        </select>
      </Field>
      {scope === 'house' ? (
        <Field label="Quem paga">
          <select value={payer} onChange={(e) => setPayer(e.target.value as 'me' | 'partner')}>
            <option value="me">{settings?.me_name ?? 'Eu'}</option>
            <option value="partner">{settings?.partner_name ?? 'Parceiro(a)'}</option>
          </select>
        </Field>
      ) : (
        <Field label="Categoria">
          <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Ex.: saúde" />
        </Field>
      )}
      {scope === 'house' && (
        <Field label="Categoria">
          <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Ex.: moradia, obra" />
        </Field>
      )}
      <Field label="Início (opcional)" hint="Vazio = desde sempre">
        <input type="month" value={start} onChange={(e) => setStart(e.target.value)} />
      </Field>
      <Field label="Fim (opcional)" hint="Mesmo mês do início = conta avulsa">
        <input type="month" value={end} onChange={(e) => setEnd(e.target.value)} />
      </Field>
      <Field label="Observação" full>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: débito na Caixa dia 01" />
      </Field>
      <div className="field full" style={{ gap: 8 }}>
        {scope === 'house' && <Toggle label="Entra no custo de moradia" checked={isHousing} onChange={setIsHousing} />}
        <Toggle label="Valor estimado (≈)" checked={estimated} onChange={setEstimated} />
        <Toggle label="Destacar no painel (ex.: Obra)" checked={featured} onChange={setFeatured} />
      </div>
      <Actions busy={busy} error={error} onDelete={it ? () => submit(() => api.del(`/bills/${it.id}`), 'Excluído') : undefined} />
    </Form>
  );
}

// ------------------------------------------------------------------
const CARD_COLORS = ['#1c1c1e', '#ec7000', '#820ad1', '#cc092f', '#2563eb', '#0f766e', '#b8860b'];

function CardForm({ req }: { req: Extract<FormRequest, { kind: 'card' }> }) {
  const it = req.item;
  const [name, setName] = useState(it?.name ?? '');
  const [bank, setBank] = useState(it?.bank ?? '');
  const [color, setColor] = useState(it?.color ?? CARD_COLORS[0]);
  const [closing, setClosing] = useState(it?.closing_day ?? 28);
  const [due, setDue] = useState(it?.due_day ?? 5);
  const [limit, setLimit] = useState(it ? centsToInput(it.limit_cents) : '');
  const { busy, error, submit } = useSubmit();

  const save = () =>
    submit(() => {
      const body = { name, bank, color, closing_day: closing, due_day: due, limit_cents: parseMoney(limit) };
      return it ? api.put(`/cards/${it.id}`, body) : api.post('/cards', body);
    });

  return (
    <Form onSubmit={save}>
      <Field label="Nome do cartão">
        <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus placeholder="Ex.: Santander Unique" />
      </Field>
      <Field label="Banco">
        <input value={bank} onChange={(e) => setBank(e.target.value)} required placeholder="Ex.: Santander" />
      </Field>
      <Field label="Fechamento">
        <DaySelect value={closing} onChange={setClosing} />
      </Field>
      <Field label="Vencimento">
        <DaySelect value={due} onChange={setDue} />
      </Field>
      <Field label="Limite total (R$)">
        <MoneyInput value={limit} onChange={setLimit} />
      </Field>
      <Field label="Cor">
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {CARD_COLORS.map((c) => (
            <button
              type="button" key={c} onClick={() => setColor(c)} aria-label={c}
              style={{ width: 28, height: 28, borderRadius: 8, background: c, border: color === c ? '3px solid var(--primary)' : '1px solid var(--border)' }}
            />
          ))}
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ width: 40, height: 30, padding: 0, border: 0, background: 'none' }} />
        </div>
      </Field>
      <Actions busy={busy} error={error} onDelete={it ? () => submit(() => api.del(`/cards/${it.id}`), 'Cartão excluído') : undefined} />
    </Form>
  );
}

// ------------------------------------------------------------------
function InvoiceForm({ req }: { req: Extract<FormRequest, { kind: 'invoice' }> }) {
  const { month: currentMonth } = useApp();
  const { data: cards } = useFetch<Card[]>('/cards');
  const [cardId, setCardId] = useState<number | ''>(req.cardId ?? '');
  const [month, setMonth] = useState(req.month ?? currentMonth);
  const [amount, setAmount] = useState(req.amount_cents != null ? centsToInput(req.amount_cents) : '');
  const { busy, error, submit } = useSubmit();
  const selected = cardId === '' ? cards?.[0]?.id : cardId;

  if (cards && cards.length === 0) return <p className="muted">Cadastre um cartão primeiro (menu Cartões).</p>;

  return (
    <Form onSubmit={() => submit(() => api.post('/invoices', { card_id: selected, month, amount_cents: parseMoney(amount) }))}>
      <Field label="Cartão">
        <select value={selected ?? ''} onChange={(e) => setCardId(Number(e.target.value))}>
          {cards?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Mês de vencimento">
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} required />
      </Field>
      <Field label="Valor da fatura (R$)" full hint="Se já existir fatura nesse mês, o valor é atualizado.">
        <MoneyInput value={amount} onChange={setAmount} autoFocus />
      </Field>
      <Actions busy={busy} error={error} />
    </Form>
  );
}

// ------------------------------------------------------------------
function IncomeForm({ req }: { req: Extract<FormRequest, { kind: 'income' }> }) {
  const { settings } = useApp();
  const it = req.item;
  const [owner, setOwner] = useState(it?.owner ?? 'me');
  const [description, setDescription] = useState(it?.description ?? 'Salário');
  const [amount, setAmount] = useState(it ? centsToInput(it.amount_cents) : '');
  const [start, setStart] = useState(it?.start_month ?? '');
  const [end, setEnd] = useState(it?.end_month ?? '');
  const { busy, error, submit } = useSubmit();

  const save = () =>
    submit(() => {
      const body = { owner, description, amount_cents: parseMoney(amount), start_month: start || null, end_month: end || null };
      return it ? api.put(`/incomes/${it.id}`, body) : api.post('/incomes', body);
    });

  return (
    <Form onSubmit={save}>
      <Field label="De quem">
        <select value={owner} onChange={(e) => setOwner(e.target.value as 'me' | 'partner')}>
          <option value="me">{settings?.me_name ?? 'Eu'}</option>
          <option value="partner">{settings?.partner_name ?? 'Parceiro(a)'}</option>
        </select>
      </Field>
      <Field label="Descrição">
        <input value={description} onChange={(e) => setDescription(e.target.value)} required />
      </Field>
      <Field label="Valor líquido mensal (R$)" full>
        <MoneyInput value={amount} onChange={setAmount} autoFocus />
      </Field>
      <Field label="Início (opcional)">
        <input type="month" value={start} onChange={(e) => setStart(e.target.value)} />
      </Field>
      <Field label="Fim (opcional)" hint="Use início = fim para renda avulsa (ex.: 13º)">
        <input type="month" value={end} onChange={(e) => setEnd(e.target.value)} />
      </Field>
      <Actions busy={busy} error={error} onDelete={it ? () => submit(() => api.del(`/incomes/${it.id}`), 'Excluído') : undefined} />
    </Form>
  );
}

// ------------------------------------------------------------------
function ReserveForm({ req }: { req: Extract<FormRequest, { kind: 'reserve' }> }) {
  const it = req.item;
  const [type, setType] = useState<'in' | 'out'>(it && it.amount_cents < 0 ? 'out' : 'in');
  const [date, setDate] = useState(it?.date ?? new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState(it?.description ?? 'Aporte mensal');
  const [amount, setAmount] = useState(it ? centsToInput(Math.abs(it.amount_cents)) : '');
  const { busy, error, submit } = useSubmit();

  const save = () =>
    submit(() => {
      const cents = Math.abs(parseMoney(amount)) * (type === 'out' ? -1 : 1);
      const body = { date, description, amount_cents: cents };
      return it ? api.put(`/reserve/${it.id}`, body) : api.post('/reserve', body);
    });

  return (
    <Form onSubmit={save}>
      <Field label="Tipo">
        <select value={type} onChange={(e) => setType(e.target.value as 'in' | 'out')}>
          <option value="in">Aporte (entrada)</option>
          <option value="out">Resgate (saída)</option>
        </select>
      </Field>
      <Field label="Data">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      </Field>
      <Field label="Descrição" full>
        <input value={description} onChange={(e) => setDescription(e.target.value)} required />
      </Field>
      <Field label="Valor (R$)" full>
        <MoneyInput value={amount} onChange={setAmount} autoFocus />
      </Field>
      <Actions busy={busy} error={error} onDelete={it ? () => submit(() => api.del(`/reserve/${it.id}`), 'Excluído') : undefined} />
    </Form>
  );
}
