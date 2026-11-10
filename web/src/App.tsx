import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { api, getToken, setToken } from './api';
import { FormHost } from './components/Forms';
import { Layout } from './components/Layout';
import Bills from './pages/Bills';
import Cards from './pages/Cards';
import CashFlow from './pages/CashFlow';
import Dashboard from './pages/Dashboard';
import Income from './pages/Income';
import MonthExpenses from './pages/MonthExpenses';
import Reserve from './pages/Reserve';
import { AppProvider, useApp } from './store';

export default function App() {
  const [auth, setAuth] = useState<'loading' | 'login' | 'ok'>('loading');

  useEffect(() => {
    api
      .get<{ required: boolean }>('/auth')
      .then((r) => setAuth(!r.required || getToken() ? 'ok' : 'login'))
      .catch(() => setAuth('ok'));
    const onUnauth = () => setAuth('login');
    window.addEventListener('mf:unauthorized', onUnauth);
    return () => window.removeEventListener('mf:unauthorized', onUnauth);
  }, []);

  if (auth === 'loading') return null;
  if (auth === 'login') return <Login onOk={() => setAuth('ok')} />;

  return (
    <AppProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/contas-mes" element={<MonthExpenses />} />
          <Route path="/fluxo" element={<CashFlow />} />
          <Route path="/cartoes" element={<Cards />} />
          <Route path="/reserva" element={<Reserve />} />
          <Route path="/renda" element={<Income />} />
          <Route path="/contas-casa" element={<Bills scope="house" />} />
          <Route path="/contas-pessoais" element={<Bills scope="personal" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
      <FormHost />
      <Toast />
    </AppProvider>
  );
}

function Toast() {
  const { toastMsg } = useApp();
  return toastMsg ? <div className="toast" role="status">{toastMsg}</div> : null;
}

function Login({ onOk }: { onOk: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api.post<{ token: string }>('/login', { password });
      setToken(r.token);
      onOk();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <form className="card" onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="brand" style={{ padding: 0 }}>
          <span className="avatar me" aria-hidden>F</span>
          <div>
            <div className="brand-title">Finn</div>
            <div className="brand-sub">Minhas finanças</div>
          </div>
        </div>
        <label className="field">
          <span>Senha</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus required autoComplete="current-password" />
        </label>
        {error && <div className="neg">{error}</div>}
        <button className="btn primary" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
      </form>
    </div>
  );
}
