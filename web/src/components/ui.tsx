import { X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { moneyParts } from '../format';

export function Money({ cents, size = 'md', approx, className = '' }: { cents: number; size?: 'xl' | 'lg' | 'md'; approx?: boolean; className?: string }) {
  const { neg, int, dec } = moneyParts(cents);
  return (
    <span className={`money ${size} ${className}`}>
      {approx && <span className="cur">≈</span>}
      <span className="cur">{neg ? '−R$' : 'R$'}</span>
      {int}
      <span className="dec">,{dec}</span>
    </span>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <h3>
          {title}
          <button className="icon-btn ghost" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </h3>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, children, full, hint }: { label: string; children: ReactNode; full?: boolean; hint?: string }) {
  return (
    <label className={`field ${full ? 'full' : ''}`}>
      <span>{label}</span>
      {children}
      {hint && <small className="hint">{hint}</small>}
    </label>
  );
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

export function Skeleton({ h = 180 }: { h?: number }) {
  return <div className="skeleton" style={{ minHeight: h }} />;
}
