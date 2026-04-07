import { ReactNode } from "react";

import { linePathFromPoints } from "../game/sim";

export type Tone = "default" | "good" | "warning" | "bad";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.08),_transparent_32%),linear-gradient(180deg,_#0f172a_0%,_#020617_52%,_#020617_100%)] text-slate-100">
      {children}
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = "primary",
  disabled = false,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "good" | "ghost";
  disabled?: boolean;
  className?: string;
}) {
  const variants = {
    primary: "bg-cyan-400 text-slate-950 hover:bg-cyan-300",
    secondary: "bg-slate-800 text-slate-100 hover:bg-slate-700",
    good: "bg-emerald-400 text-slate-950 hover:bg-emerald-300",
    ghost: "bg-transparent text-slate-300 ring-1 ring-inset ring-slate-700 hover:bg-slate-900",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl px-4 py-2 text-sm font-medium transition ${variants[variant]} ${disabled ? "cursor-not-allowed opacity-40" : ""} ${className}`}
    >
      {children}
    </button>
  );
}

export function Badge({ children, tone = "default" }: { children: ReactNode; tone?: Tone }) {
  const styles = {
    default: "border-slate-700 bg-slate-900/80 text-slate-200",
    good: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    warning: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    bad: "border-rose-500/30 bg-rose-500/10 text-rose-300",
  };

  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs ${styles[tone]}`}>{children}</span>;
}

export function NavTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
        active ? "bg-slate-100 text-slate-950" : "bg-slate-900/70 text-slate-300 hover:bg-slate-800"
      }`}
    >
      {children}
    </button>
  );
}

export function SegmentedControl<T extends string>({
  options,
  activeKey,
  onChange,
}: {
  options: Array<{ key: T; label: string }>;
  activeKey: T;
  onChange: (key: T) => void;
}) {
  return (
    <div className="inline-flex flex-wrap gap-2 rounded-2xl bg-slate-950/60 p-1 ring-1 ring-inset ring-slate-800/70">
      {options.map((option) => {
        const active = option.key === activeKey;
        return (
          <button
            key={option.key}
            onClick={() => onChange(option.key)}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
              active
                ? "bg-slate-100 text-slate-950 shadow-[0_10px_20px_rgba(15,23,42,0.2)]"
                : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function Panel({
  title,
  subtitle,
  right,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-slate-800/80 bg-slate-900/55 p-5 shadow-[0_18px_45px_rgba(2,6,23,0.35)] ${className}`}>
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-base font-semibold text-slate-100">{title}</div>
          {subtitle ? <div className="mt-1 text-sm text-slate-400">{subtitle}</div> : null}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

export function MiniSparkline({
  points,
  tone = "default",
  className = "",
}: {
  points: number[];
  tone?: Tone;
  className?: string;
}) {
  const safePoints = points.length ? points : [0, 0];
  const path = linePathFromPoints(safePoints, 120, 40);
  const styles = {
    default: {
      stroke: "#cbd5e1",
      fill: "rgba(148, 163, 184, 0.14)",
    },
    good: {
      stroke: "#34d399",
      fill: "rgba(52, 211, 153, 0.14)",
    },
    warning: {
      stroke: "#fbbf24",
      fill: "rgba(251, 191, 36, 0.14)",
    },
    bad: {
      stroke: "#fb7185",
      fill: "rgba(251, 113, 133, 0.14)",
    },
  };

  return (
    <svg viewBox="0 0 120 40" className={`h-10 w-28 overflow-visible ${className}`}>
      <path d={`${path} L120,40 L0,40 Z`} fill={styles[tone].fill} />
      <path d={path} fill="none" stroke={styles[tone].stroke} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function KpiCard({
  label,
  value,
  subvalue,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  subvalue?: ReactNode;
  tone?: Tone;
}) {
  const tones = {
    default: "border-slate-800 bg-slate-900/65",
    good: "border-emerald-500/20 bg-emerald-500/10",
    warning: "border-amber-500/20 bg-amber-500/10",
    bad: "border-rose-500/20 bg-rose-500/10",
  };

  return (
    <div className={`rounded-2xl border p-4 ${tones[tone]}`}>
      <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">{label}</div>
      <div className="mt-2 font-mono text-2xl font-semibold tracking-tight text-slate-50">{value}</div>
      {subvalue ? <div className="mt-1 text-sm text-slate-400">{subvalue}</div> : null}
    </div>
  );
}

export function StatRow({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  tone?: Tone;
}) {
  const textTone = {
    default: "text-slate-100",
    good: "text-emerald-300",
    warning: "text-amber-300",
    bad: "text-rose-300",
  };

  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-slate-400">{label}</span>
      <span className={`font-mono ${textTone[tone]}`}>{value}</span>
    </div>
  );
}

export function Meter({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: Tone;
}) {
  const barTone = {
    default: "bg-slate-300",
    good: "bg-emerald-400",
    warning: "bg-amber-400",
    bad: "bg-rose-400",
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="text-slate-400">{label}</span>
        <span className="font-mono text-slate-100">{value.toFixed(1)}</span>
      </div>
      <div className="h-2 rounded-full bg-slate-800">
        <div
          className={`h-2 rounded-full ${barTone[tone]}`}
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/40 p-6">
      <div className="text-sm font-medium text-slate-200">{title}</div>
      <div className="mt-1 text-sm text-slate-400">{body}</div>
    </div>
  );
}

export function LossCurve({ points }: { points: number[] }) {
  const safePoints = points.length ? points : [2.8, 2.5, 2.2, 1.8, 1.5, 1.1];
  const path = linePathFromPoints(safePoints);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
      <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-[0.22em] text-slate-500">
        <span>Loss Curve</span>
        <span className="font-mono text-slate-200">{safePoints[safePoints.length - 1]?.toFixed(2)}</span>
      </div>
      <svg viewBox="0 0 320 96" className="h-28 w-full overflow-visible">
        <defs>
          <linearGradient id="curveFade" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#22c55e" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${path} L320,96 L0,96 Z`} fill="url(#curveFade)" />
        <path d={path} fill="none" stroke="#4ade80" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
