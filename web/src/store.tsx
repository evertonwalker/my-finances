import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from './api';
import { currentMonth } from './format';
import type { Bill, Card, Income, MonthlyExpense, ReserveEntry, Settings } from './types';

export type FormRequest =
  | { kind: 'bill'; scope: 'house' | 'personal'; item?: Bill }
  | { kind: 'expense'; item?: MonthlyExpense }
  | { kind: 'card'; item?: Card }
  | { kind: 'invoice'; cardId?: number; month?: string; amount_cents?: number }
  | { kind: 'income'; item?: Income }
  | { kind: 'reserve'; item?: ReserveEntry };

type Theme = 'light' | 'dark';

interface Ctx {
  month: string;
  setMonth: (m: string) => void;
  version: number;
  refresh: () => void;
  settings: Settings | null;
  theme: Theme;
  setTheme: (t: Theme) => void;
  form: FormRequest | null;
  openForm: (f: FormRequest) => void;
  closeForm: () => void;
  toast: (msg: string) => void;
  toastMsg: string | null;
}

const AppCtx = createContext<Ctx>(null as unknown as Ctx);
export const useApp = () => useContext(AppCtx);

function initialTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [month, setMonth] = useState(() => new URLSearchParams(location.search).get('m') || currentMonth());
  const [version, setVersion] = useState(0);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [theme, setThemeState] = useState<Theme>(initialTheme);
  const [form, setForm] = useState<FormRequest | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    api.get<Settings>('/settings').then(setSettings).catch(() => {});
  }, [version]);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    document.documentElement.dataset.theme = t;
    try {
      localStorage.setItem('theme', t);
    } catch {
      /* ignore */
    }
  };

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => setToastMsg((cur) => (cur === msg ? null : cur)), 2600);
  }, []);

  return (
    <AppCtx.Provider
      value={{
        month, setMonth, version, refresh, settings, theme, setTheme,
        form, openForm: setForm, closeForm: () => setForm(null), toast, toastMsg,
      }}
    >
      {children}
    </AppCtx.Provider>
  );
}

/** Busca dados e recarrega quando o path mudar ou após qualquer mutação (refresh). */
export function useFetch<T>(path: string | null) {
  const { version } = useApp();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!path) return;
    let alive = true;
    setLoading(true);
    api
      .get<T>(path)
      .then((d) => alive && (setData(d), setError(null)))
      .catch((e: Error) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [path, version]);

  return { data, error, loading };
}
