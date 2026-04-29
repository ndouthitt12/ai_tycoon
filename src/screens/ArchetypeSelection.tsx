import { ARCHETYPES } from "../game/defs";
import { ArchetypeId } from "../game/types";
import { Badge, Button } from "../components/ui";

export function ArchetypeSelection({
  onSelect,
}: {
  onSelect: (archetypeId: ArchetypeId) => void;
}) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 md:px-6">
      {/* Page header */}
      <div className="mb-8 border-b border-[#21262d] pb-5">
        <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#58a6ff]">AI Tycoon</div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#e6edf3]">Select Company Archetype</h1>
        <p className="mt-1.5 text-sm text-[#8b949e]">
          Your archetype determines starting capital, talent mix, trust posture, and distribution before the first month begins.
        </p>
      </div>

      {/* Archetype cards as spreadsheet rows */}
      <div className="grid gap-4 xl:grid-cols-2">
        {Object.values(ARCHETYPES).map((archetype) => (
          <div
            key={archetype.id}
            className="overflow-hidden rounded-md border border-[#30363d] bg-[#161b22]"
          >
            {/* Card header row */}
            <div className="flex items-start justify-between gap-4 border-b border-[#30363d] bg-[#0d1117] px-4 py-3">
              <div className="min-w-0">
                <div className="text-base font-semibold text-[#e6edf3]">{archetype.name}</div>
                <div className="mt-1 text-xs leading-5 text-[#8b949e]">{archetype.summary}</div>
              </div>
              <Badge tone="default">{archetype.winStyle}</Badge>
            </div>

            {/* Stats grid — spreadsheet columns */}
            <div className="grid grid-cols-3 border-b border-[#21262d]">
              <div className="border-r border-[#21262d] px-3 py-3">
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#484f58]">Strengths</div>
                <div className="space-y-1.5">
                  {archetype.strengths.map((item) => (
                    <div key={item} className="text-xs leading-5 text-[#c9d1d9]">{item}</div>
                  ))}
                </div>
              </div>
              <div className="border-r border-[#21262d] px-3 py-3">
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#484f58]">Weaknesses</div>
                <div className="space-y-1.5">
                  {archetype.weaknesses.map((item) => (
                    <div key={item} className="text-xs leading-5 text-[#c9d1d9]">{item}</div>
                  ))}
                </div>
              </div>
              <div className="px-3 py-3">
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#484f58]">Starting Edge</div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-[#8b949e]">Cash</span>
                    <span className="font-mono text-xs font-medium text-[#3fb950]">
                      {Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(archetype.startingCash)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-[#8b949e]">Trust</span>
                    <span className="font-mono text-xs font-medium text-[#e6edf3]">{archetype.startingTrust}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-[#8b949e]">Consumer</span>
                    <span className="font-mono text-xs font-medium text-[#e6edf3]">{archetype.startingDistribution.consumer}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-[#8b949e]">Enterprise</span>
                    <span className="font-mono text-xs font-medium text-[#e6edf3]">{archetype.startingDistribution.enterprise}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action row */}
            <div className="flex items-center justify-end px-4 py-2.5">
              <Button onClick={() => onSelect(archetype.id)} variant="primary">
                Start as {archetype.name} →
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
