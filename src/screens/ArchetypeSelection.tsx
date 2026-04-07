import { ARCHETYPES } from "../game/defs";
import { ArchetypeId } from "../game/types";
import { Badge, Button } from "../components/ui";

export function ArchetypeSelection({
  onSelect,
}: {
  onSelect: (archetypeId: ArchetypeId) => void;
}) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-10">
      <div className="rounded-[28px] border border-slate-800 bg-slate-900/55 p-6 shadow-[0_18px_45px_rgba(2,6,23,0.35)] md:p-8">
        <div className="max-w-3xl">
          <div className="text-[11px] uppercase tracking-[0.28em] text-cyan-300">AI Company Tycoon</div>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-50 md:text-5xl">Step 2 Strategic Core</h1>
          <p className="mt-4 text-base leading-7 text-slate-300">
            Pick a company identity first. This decision sets your capital, talent mix, trust posture,
            distribution base, and passive advantages before the first month starts.
          </p>
        </div>

        <div className="mt-8 grid gap-5 xl:grid-cols-2">
          {Object.values(ARCHETYPES).map((archetype) => (
            <div
              key={archetype.id}
              className="rounded-[24px] border border-slate-800 bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(2,6,23,0.88))] p-5"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="text-2xl font-semibold text-slate-50">{archetype.name}</div>
                  <div className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{archetype.summary}</div>
                </div>
                <Badge tone="default">{archetype.winStyle}</Badge>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Strengths</div>
                  <div className="mt-3 space-y-2 text-sm text-slate-200">
                    {archetype.strengths.map((item) => (
                      <div key={item}>{item}</div>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Weaknesses</div>
                  <div className="mt-3 space-y-2 text-sm text-slate-200">
                    {archetype.weaknesses.map((item) => (
                      <div key={item}>{item}</div>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Starting Edge</div>
                  <div className="mt-3 space-y-2 text-sm text-slate-200">
                    <div>Cash {Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(archetype.startingCash)}</div>
                    <div>Trust {archetype.startingTrust}</div>
                    <div>Consumer Dist {archetype.startingDistribution.consumer}</div>
                    <div>Enterprise Dist {archetype.startingDistribution.enterprise}</div>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex justify-end">
                <Button onClick={() => onSelect(archetype.id)}>Start {archetype.name}</Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
