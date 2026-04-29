import { ReactNode } from "react";

import { linePathFromPoints } from "../game/sim";

export type Tone = "default" | "good" | "warning" | "bad";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0d1117] text-[#e6edf3]">
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
    primary: "bg-[#1f6feb] text-white hover:bg-[#388bfd] border border-[#1f6feb]/80",
    secondary: "bg-[#21262d] text-[#c9d1d9] hover:bg-[#30363d] border border-[#30363d]",
    good: "bg-[#1a6b29] text-[#3fb950] hover:bg-[#1f7d31] border border-[#2ea043]/40",
    ghost: "bg-transparent text-[#8b949e] border border-[#30363d] hover:bg-[#161b22] hover:text-[#c9d1d9]",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${variants[variant]} ${disabled ? "cursor-not-allowed opacity-40" : ""} ${className}`}
    >
      {children}
    </button>
  );
}

export function Badge({ children, tone = "default" }: { children: ReactNode; tone?: Tone }) {
  const styles = {
    default: "bg-[#21262d] text-[#8b949e] border-[#30363d]",
    good: "bg-[#0d2619] text-[#3fb950] border-[#2ea043]/30",
    warning: "bg-[#1f1a0d] text-[#d29922] border-[#d29922]/30",
    bad: "bg-[#220d0d] text-[#f85149] border-[#f85149]/30",
  };

  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-medium leading-4 ${styles[tone]}`}>
      {children}
    </span>
  );
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
      className={`border-b-2 px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
        active
          ? "border-[#58a6ff] text-[#e6edf3]"
          : "border-transparent text-[#8b949e] hover:border-[#30363d] hover:text-[#c9d1d9]"
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
    <div className="inline-flex rounded border border-[#30363d] bg-[#0d1117] p-0.5">
      {options.map((option) => {
        const active = option.key === activeKey;
        return (
          <button
            key={option.key}
            onClick={() => onChange(option.key)}
            className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
              active
                ? "bg-[#21262d] text-[#e6edf3] shadow-sm"
                : "text-[#8b949e] hover:text-[#c9d1d9]"
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
    <section className={`overflow-hidden rounded-md border border-[#30363d] ${className}`}>
      <div className="flex items-center justify-between gap-4 border-b border-[#30363d] bg-[#161b22] px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6e7681]">{title}</span>
          {subtitle ? <span className="text-[#484f58]">/</span> : null}
          {subtitle ? <span className="truncate text-xs text-[#8b949e]">{subtitle}</span> : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      <div className="bg-[#0d1117] p-4">{children}</div>
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
    default: { stroke: "#8b949e", fill: "rgba(139,148,158,0.12)" },
    good: { stroke: "#3fb950", fill: "rgba(63,185,80,0.12)" },
    warning: { stroke: "#d29922", fill: "rgba(210,153,34,0.12)" },
    bad: { stroke: "#f85149", fill: "rgba(248,81,73,0.12)" },
  };

  return (
    <svg viewBox="0 0 120 40" className={`h-10 w-28 overflow-visible ${className}`}>
      <path d={`${path} L120,40 L0,40 Z`} fill={styles[tone].fill} />
      <path d={path} fill="none" stroke={styles[tone].stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
  const bgTones = {
    default: "bg-[#0d1117]",
    good: "bg-[#091d10]",
    warning: "bg-[#191100]",
    bad: "bg-[#190a0a]",
  };

  const valueTones = {
    default: "text-[#e6edf3]",
    good: "text-[#3fb950]",
    warning: "text-[#d29922]",
    bad: "text-[#f85149]",
  };

  return (
    <div className={`border-r border-[#21262d] px-4 py-3 last:border-r-0 ${bgTones[tone]}`}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#484f58]">{label}</div>
      <div className={`mt-1.5 font-mono text-lg font-semibold leading-none ${valueTones[tone]}`}>{value}</div>
      {subvalue ? <div className="mt-1 text-[11px] text-[#484f58]">{subvalue}</div> : null}
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
    default: "text-[#e6edf3]",
    good: "text-[#3fb950]",
    warning: "text-[#d29922]",
    bad: "text-[#f85149]",
  };

  return (
    <div className="flex items-center justify-between border-b border-[#161b22] py-2 text-sm last:border-0">
      <span className="text-[#8b949e]">{label}</span>
      <span className={`font-mono text-[13px] ${textTone[tone]}`}>{value}</span>
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
    default: "bg-[#8b949e]",
    good: "bg-[#3fb950]",
    warning: "bg-[#d29922]",
    bad: "bg-[#f85149]",
  };

  return (
    <div className="py-1">
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="text-[#8b949e]">{label}</span>
        <span className="font-mono text-[#e6edf3]">{value.toFixed(1)}</span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-[#21262d]">
        <div
          className={`h-1 rounded-full transition-all ${barTone[tone]}`}
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
    <div className="rounded border border-dashed border-[#30363d] bg-[#161b22]/40 px-4 py-6 text-center">
      <div className="text-sm font-medium text-[#c9d1d9]">{title}</div>
      <div className="mt-1 text-sm text-[#8b949e]">{body}</div>
    </div>
  );
}

export function LossCurve({ points }: { points: number[] }) {
  const safePoints = points.length ? points : [2.8, 2.5, 2.2, 1.8, 1.5, 1.1];
  const path = linePathFromPoints(safePoints);

  return (
    <div className="rounded-md border border-[#30363d] bg-[#161b22] p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6e7681]">Loss Curve</span>
        <span className="font-mono text-xs text-[#e6edf3]">{safePoints[safePoints.length - 1]?.toFixed(2)}</span>
      </div>
      <svg viewBox="0 0 320 96" className="h-28 w-full overflow-visible">
        <defs>
          <linearGradient id="curveFade" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#3fb950" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#3fb950" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${path} L320,96 L0,96 Z`} fill="url(#curveFade)" />
        <path d={path} fill="none" stroke="#3fb950" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
