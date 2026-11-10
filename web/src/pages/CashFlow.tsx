import { Skeleton } from '../components/ui';
import { money, monthShort } from '../format';
import { useApp, useFetch } from '../store';
import type { CashflowRow } from '../types';

export default function CashFlow() {
  const { month, setMonth } = useApp();
  const { data, error } = useFetch<CashflowRow[]>(`/cashflow?from=${month}&months=12`);
  const max = Math.max(...(data ?? []).map((r) => Math.abs(r.free_cents)), 1);

  return (
    <div className="card">
      <div className="page-head">
        <div>
          <h2>Fluxo de caixa</h2>
          <div className="sub">Projeção dos próximos 12 meses a partir do mês selecionado, com base nas contas recorrentes, faturas lançadas e no orçamento dos gastos mensais (ou no gasto real, se for maior).</div>
        </div>
      </div>
      {error && <p className="neg">{error}</p>}
      {!data ? (
        <Skeleton h={300} />
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 140, margin: '10px 0 20px' }}>
            {data.map((r) => (
              <button
                key={r.month}
                onClick={() => setMonth(r.month)}
                title={`${monthShort(r.month)}: ${money(r.free_cents)}`}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', gap: 4, border: 0, background: 'none', padding: 0 }}
              >
                <div
                  style={{
                    width: '100%', maxWidth: 40, borderRadius: 6,
                    height: `${Math.max((Math.abs(r.free_cents) / max) * 100, 3)}%`,
                    background: r.free_cents >= 0 ? 'var(--green)' : 'var(--red)',
                    opacity: r.month === month ? 1 : 0.55,
                  }}
                />
                <span className="label" style={{ fontSize: 10 }}>{monthShort(r.month)}</span>
              </button>
            ))}
          </div>
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Mês</th>
                  <th className="r">Salário</th>
                  <th className="r">Contas da casa</th>
                  <th className="r">Contas pessoais</th>
                  <th className="r hide-sm">Gastos mensais</th>
                  <th className="r">Sobra</th>
                  <th className="r hide-sm">Acumulado</th>
                </tr>
              </thead>
              <tbody>
                {data.map((r) => (
                  <tr key={r.month}>
                    <td><b>{monthShort(r.month)}</b></td>
                    <td className="r">{money(r.salary_cents)}</td>
                    <td className="r">− {money(r.house_cents)}</td>
                    <td className="r">− {money(r.personal_cents)}</td>
                    <td className="r hide-sm">− {money(r.month_cents)}</td>
                    <td className={`r ${r.free_cents >= 0 ? 'pos' : 'neg'}`}><b>{money(r.free_cents)}</b></td>
                    <td className="r hide-sm">{money(r.accumulated_cents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
