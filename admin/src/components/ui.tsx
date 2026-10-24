import React, { useEffect } from 'react';
import { Loader2, X, Inbox } from 'lucide-react';

export const fmtMoney = (n: number | null | undefined) =>
  n === null || n === undefined ? '—' : `${Math.round(n).toLocaleString('ru-RU').replace(/,/g, ' ')} soʻm`;

export const fmtNum = (n: number | null | undefined) => (n === null || n === undefined ? '—' : n.toLocaleString('ru-RU').replace(/,/g, ' '));

export const fmtMinutes = (m: number | null | undefined) => {
  if (m === null || m === undefined) return '—';
  if (m >= 120) return `${Math.round((m / 60) * 10) / 10} soat`;
  return `${Math.round(m * 10) / 10} daq`;
};

export const fmtDate = (iso?: string | null, withTime = true) => {
  if (!iso) return '—';
  const d = new Date(iso);
  const date = d.toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
  if (!withTime) return date;
  return `${date} ${d.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}`;
};

export const fmtDuration = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
};

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');

export const Card: React.FC<{ className?: string; children: React.ReactNode; title?: React.ReactNode; actions?: React.ReactNode; padded?: boolean }> = ({
  className,
  children,
  title,
  actions,
  padded = true,
}) => (
  <div className={cx('bg-white rounded-2xl border border-slate-200 shadow-sm fade-up', className)}>
    {(title || actions) && (
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
        <div className="text-sm font-bold text-slate-900">{title}</div>
        <div className="flex items-center gap-2">{actions}</div>
      </div>
    )}
    <div className={padded ? 'p-5' : ''}>{children}</div>
  </div>
);

export const PageHeader: React.FC<{ title: string; subtitle?: React.ReactNode; actions?: React.ReactNode; back?: React.ReactNode }> = ({
  title,
  subtitle,
  actions,
  back,
}) => (
  <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 mb-6">
    <div className="min-w-0">
      {back}
      <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 truncate">{title}</h1>
      {subtitle && <div className="text-sm text-slate-500 mt-1">{subtitle}</div>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
  </div>
);

type BtnVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
const BTN: Record<BtnVariant, string> = {
  primary: 'bg-slate-900 text-white hover:bg-slate-800 shadow-sm',
  secondary: 'bg-white text-slate-800 border border-slate-200 hover:bg-slate-50',
  danger: 'bg-rose-600 text-white hover:bg-rose-700',
  ghost: 'text-slate-600 hover:bg-slate-100',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700',
};

export const Button: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; loading?: boolean; icon?: React.ReactNode; size?: 'sm' | 'md' }
> = ({ variant = 'primary', loading, icon, size = 'md', className, children, disabled, ...rest }) => (
  <button
    {...rest}
    disabled={disabled || loading}
    className={cx(
      'inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
      size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-sm',
      BTN[variant],
      className
    )}
  >
    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
    {children}
  </button>
);

type Tone = 'slate' | 'green' | 'red' | 'amber' | 'indigo' | 'sky' | 'violet';
const TONES: Record<Tone, string> = {
  slate: 'bg-slate-100 text-slate-700 border-slate-200',
  green: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  red: 'bg-rose-50 text-rose-800 border-rose-200',
  amber: 'bg-amber-50 text-amber-800 border-amber-200',
  indigo: 'bg-indigo-50 text-indigo-800 border-indigo-200',
  sky: 'bg-sky-50 text-sky-800 border-sky-200',
  violet: 'bg-violet-50 text-violet-800 border-violet-200',
};

export const Badge: React.FC<{ tone?: Tone; children: React.ReactNode; className?: string; title?: string }> = ({ tone = 'slate', children, className, title }) => (
  <span title={title} className={cx('inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap', TONES[tone], className)}>
    {children}
  </span>
);

export const Stat: React.FC<{ label: string; value: React.ReactNode; hint?: React.ReactNode; icon?: React.ReactNode; tone?: 'dark' | 'light' }> = ({
  label,
  value,
  hint,
  icon,
  tone = 'light',
}) => (
  <div
    className={cx(
      'rounded-2xl border p-4 fade-up',
      tone === 'dark' ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 shadow-sm'
    )}
  >
    <div className="flex items-center justify-between">
      <div className={cx('text-[11px] font-bold uppercase tracking-wider', tone === 'dark' ? 'text-slate-400' : 'text-slate-500')}>{label}</div>
      {icon && <div className={tone === 'dark' ? 'text-indigo-300' : 'text-slate-400'}>{icon}</div>}
    </div>
    <div className="text-2xl font-extrabold mt-1.5 tracking-tight">{value}</div>
    {hint && <div className={cx('text-xs mt-1', tone === 'dark' ? 'text-slate-400' : 'text-slate-500')}>{hint}</div>}
  </div>
);

export const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode; className?: string }> = ({ label, hint, children, className }) => (
  <label className={cx('block', className)}>
    <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500 block mb-1">{label}</span>
    {children}
    {hint && <span className="text-[11px] text-slate-400 block mt-1">{hint}</span>}
  </label>
);

export const inputCls = 'w-full text-sm rounded-lg border border-slate-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:bg-slate-50';

export const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} className={cx(inputCls, props.className)} />;
export const Select = (props: React.SelectHTMLAttributes<HTMLSelectElement>) => <select {...props} className={cx(inputCls, props.className)} />;
export const Textarea = (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} className={cx(inputCls, props.className)} />;

export const Modal: React.FC<{ open: boolean; onClose: () => void; title: string; children: React.ReactNode; width?: string; footer?: React.ReactNode }> = ({
  open,
  onClose,
  title,
  children,
  width = 'max-w-lg',
  footer,
}) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" onMouseDown={onClose}>
      <div className={cx('bg-white rounded-2xl shadow-2xl w-full fade-up max-h-[92vh] flex flex-col', width)} onMouseDown={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 overflow-y-auto thin-scroll">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
};

export const ErrorBox: React.FC<{ error?: string | null }> = ({ error }) =>
  error ? <div className="text-xs font-semibold text-rose-800 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</div> : null;

export const Empty: React.FC<{ text: string; children?: React.ReactNode }> = ({ text, children }) => (
  <div className="flex flex-col items-center justify-center text-center py-12 text-slate-500">
    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
      <Inbox className="w-6 h-6 text-slate-400" />
    </div>
    <div className="text-sm">{text}</div>
    {children && <div className="mt-3">{children}</div>}
  </div>
);

export const Spinner: React.FC<{ label?: string }> = ({ label = 'Yuklanmoqda…' }) => (
  <div className="flex items-center gap-2 text-sm text-slate-500 py-10 justify-center">
    <Loader2 className="w-4 h-4 animate-spin" /> {label}
  </div>
);

export const Table: React.FC<{ head: React.ReactNode[]; children: React.ReactNode; className?: string }> = ({ head, children, className }) => (
  <div className={cx('overflow-x-auto thin-scroll', className)}>
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500 border-b border-slate-200">
          {head.map((h, i) => (
            <th key={i} className="px-4 py-2.5 font-bold whitespace-nowrap">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">{children}</tbody>
    </table>
  </div>
);

export const Td: React.FC<{ children?: React.ReactNode; className?: string; mono?: boolean; title?: string }> = ({ children, className, mono, title }) => (
  <td title={title} className={cx('px-4 py-3 align-middle', mono && 'font-mono text-xs', className)}>
    {children}
  </td>
);

export const ScoreRing: React.FC<{ score: number | null; size?: number; dark?: boolean }> = ({ score, size = 56, dark = false }) => {
  const s = Math.max(0, Math.min(100, score ?? 0));
  const color = s >= 75 ? '#10b981' : s >= 50 ? '#f59e0b' : '#f43f5e';
  const track = dark ? 'rgba(255,255,255,0.12)' : '#e2e8f0';
  return (
    <div
      className="rounded-full flex items-center justify-center shrink-0"
      style={{
        width: size,
        height: size,
        background: `conic-gradient(${color} ${s * 3.6}deg, ${track} 0deg)`,
        boxShadow: dark ? `0 0 ${size / 3}px ${color}55` : undefined,
      }}
    >
      <div
        className={cx('rounded-full flex items-center justify-center font-extrabold', dark ? 'bg-slate-950 text-white' : 'bg-white text-slate-900')}
        style={{ width: size - 10, height: size - 10, fontSize: size / 3.4 }}
      >
        {score === null ? '—' : Math.round(s)}
      </div>
    </div>
  );
};

export const STATUS_TONE: Record<string, Tone> = { pending: 'amber', active: 'green', suspended: 'red', exhausted: 'amber', expired: 'slate', cancelled: 'slate', done: 'green', failed: 'red' };
export const STATUS_LABEL: Record<string, string> = {
  pending: 'Toʻlov kutilmoqda',
  active: 'Faol',
  suspended: 'Toʻxtatilgan',
  exhausted: 'Tugagan',
  expired: 'Muddati oʻtgan',
  cancelled: 'Bekor qilingan',
  done: 'Tayyor',
  failed: 'Xato',
};
export const StatusBadge: React.FC<{ status: string }> = ({ status }) => <Badge tone={STATUS_TONE[status] || 'slate'}>{STATUS_LABEL[status] || status}</Badge>;
