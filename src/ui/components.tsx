import { useEffect, useId, useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className="switch"
      onClick={() => onChange(!checked)}
    />
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ProgressBar({ value, label }: { value: number; label: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div
      className="progress"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-valuetext={`${pct}%`}
    >
      <div style={{ width: `${pct}%` }} />
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <Icon size={28} aria-hidden="true" />
      <h3>{title}</h3>
      <p className="small">{body}</p>
      {action}
    </div>
  );
}

export function Loading() {
  return (
    <div className="stack-sm" role="status" aria-live="polite" style={{ padding: 20 }}>
      <span className="sr-only">Loading</span>
      <div className="skeleton" style={{ width: '60%' }} />
      <div className="skeleton" style={{ width: '90%' }} />
      <div className="skeleton" style={{ width: '75%' }} />
    </div>
  );
}

export function ErrorBanner({ text }: { text: string }) {
  return (
    <div className="banner err" role="alert">
      {text}
    </div>
  );
}

export function SettingRow({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div className="setting" role="group" aria-labelledby={id}>
      <div className="grow">
        <h3 id={id}>{title}</h3>
        <p className="muted small">{description}</p>
      </div>
      <div className="ctl">{children}</div>
    </div>
  );
}

/** Commits on blur/Enter so every keystroke does not round-trip through storage. */
export function NumberField({
  value,
  min,
  max,
  onCommit,
  label,
  suffix,
}: {
  value: number;
  min: number;
  max: number;
  onCommit: (n: number) => void;
  label: string;
  suffix?: string;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const commit = (): void => {
    const n = Number(text);
    if (Number.isFinite(n)) onCommit(Math.min(max, Math.max(min, Math.round(n))));
    else setText(String(value));
  };
  return (
    <div className="row" style={{ gap: 8 }}>
      <input
        type="number"
        aria-label={label}
        min={min}
        max={max}
        value={text}
        style={{ width: 96 }}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && commit()}
      />
      {suffix && <span className="muted small">{suffix}</span>}
    </div>
  );
}

/** One entry per line. */
export function ListField({
  value,
  onCommit,
  label,
  placeholder,
}: {
  value: string[];
  onCommit: (v: string[]) => void;
  label: string;
  placeholder?: string;
}) {
  const [text, setText] = useState(value.join('\n'));
  useEffect(() => setText(value.join('\n')), [value]);
  return (
    <textarea
      aria-label={label}
      placeholder={placeholder}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() =>
        onCommit(
          text
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean),
        )
      }
    />
  );
}

export function Toast({ text, kind }: { text: string | null; kind: 'ok' | 'err' }) {
  if (!text) return null;
  return (
    <div
      className={`toast ${kind === 'err' ? 'err' : ''}`}
      role={kind === 'err' ? 'alert' : 'status'}
    >
      {text}
    </div>
  );
}

export function BarChart({
  days,
  goalSeconds,
}: {
  days: Array<{ label: string; seconds: number }>;
  goalSeconds: number;
}) {
  const max = Math.max(goalSeconds, ...days.map((d) => d.seconds), 60);
  return (
    <div
      className="bars"
      role="img"
      aria-label={`Focused viewing time for the last ${days.length} days: ${days.map((d) => `${d.label} ${Math.round(d.seconds / 60)} minutes`).join(', ')}`}
    >
      {days.map((d) => (
        <div className="col" key={d.label}>
          <span className="small muted num">
            {d.seconds > 0 ? `${Math.round(d.seconds / 60)}m` : ''}
          </span>
          <div
            className={`bar ${d.seconds === 0 ? 'zero' : ''}`}
            style={{ height: `${(d.seconds / max) * 100}%` }}
          />
          <span className="small muted">{d.label}</span>
        </div>
      ))}
    </div>
  );
}
