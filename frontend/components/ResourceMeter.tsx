"use client";
import { motion } from "framer-motion";

interface ResourceCard {
  tier: number;
  tier_label: string;
  tier_desc: string;
  model: string;
  resolution: string;
  steps: number;
  gpu_seconds: number;
  energy_wh: number;
  co2_grams: number;
  baseline_gpu_seconds: number;
  baseline_energy_wh: number;
  baseline_co2_grams: number;
  saved_gpu_seconds: number;
  saved_energy_wh: number;
  saved_co2_grams: number;
  saved_pct: number;
  calculation_note: string;
}

interface ResourceMeterProps {
  card: ResourceCard;
  isBaseline?: boolean;
  cacheHit?: boolean;
}

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
      <motion.div
        className="h-full rounded-full"
        style={{ backgroundColor: color }}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      />
    </div>
  );
}

function Stat({ label, value, unit, sub }: { label: string; value: string | number; unit: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-widest text-white/40">{label}</span>
      <span className="text-lg font-black text-white">
        {value}<span className="text-xs text-white/50 ml-1">{unit}</span>
      </span>
      {sub && <span className="text-[10px] text-white/30">{sub}</span>}
    </div>
  );
}

export function ResourceMeter({ card, isBaseline, cacheHit }: ResourceMeterProps) {
  if (cacheHit) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass p-4 mt-3 border border-green-500/30"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">⚡</span>
          <div>
            <h3 className="text-green-400 font-black text-sm">Cache Hit — 100% Saved!</h3>
            <p className="text-white/50 text-xs mt-0.5">
              Image served from cache. <strong className="text-green-400">0 GPU seconds</strong> used.
              Saved <strong className="text-green-400">62.5s / 5.56 Wh / 1.29g CO₂</strong> vs max quality.
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  const barMax = card.baseline_gpu_seconds;
  const usedPct = Math.round((card.gpu_seconds / barMax) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`glass p-4 mt-3 space-y-4 border ${isBaseline ? "border-red-500/30" : "border-[#00f5ff]/20"}`}
    >
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-xs uppercase tracking-widest text-white/40 mb-1">⚡ Resource Estimate</h3>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
              isBaseline
                ? "bg-red-500/20 text-red-400"
                : card.tier_label.includes("Draft")
                ? "bg-green-500/20 text-green-400"
                : "bg-yellow-500/20 text-yellow-400"
            }`}>
              {card.tier_label}
            </span>
            <span className="text-[10px] text-white/40">{card.model.toUpperCase()} · {card.resolution} · {card.steps} steps</span>
          </div>
          <p className="text-[11px] text-white/40 mt-1">{card.tier_desc}</p>
        </div>

        {!isBaseline && (
          <div className="text-right">
            <div className="text-2xl font-black text-green-400">{card.saved_pct}%</div>
            <div className="text-[10px] text-white/40">saved vs max</div>
          </div>
        )}
      </div>

      {/* GPU time bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="text-white/50">Compute time used</span>
          <span className="text-white/80 font-bold">{card.gpu_seconds}s of {card.baseline_gpu_seconds}s max</span>
        </div>
        <Bar value={card.gpu_seconds} max={barMax} color={isBaseline ? "#ef4444" : "#00f5ff"} />
        <div className="flex justify-between text-[10px] text-white/30">
          <span>0s</span>
          <span className="text-green-400 font-bold">
            {!isBaseline && `← Saved ${card.saved_gpu_seconds}s (${card.saved_pct}% faster)`}
          </span>
          <span>{card.baseline_gpu_seconds}s (max)</span>
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-3 gap-3 pt-1 border-t border-white/5">
        <Stat
          label="GPU Time"
          value={card.gpu_seconds}
          unit="seconds"
          sub={`Max = ${card.baseline_gpu_seconds}s`}
        />
        <Stat
          label="Energy Used"
          value={card.energy_wh.toFixed(4)}
          unit="Wh"
          sub={`Max = ${card.baseline_energy_wh} Wh`}
        />
        <Stat
          label="CO₂ Emitted"
          value={card.co2_grams.toFixed(4)}
          unit="g"
          sub={`Max = ${card.baseline_co2_grams} g`}
        />
      </div>

      {/* Savings row */}
      {!isBaseline && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 grid grid-cols-3 gap-3">
          <div>
            <div className="text-[10px] text-green-400/60 uppercase tracking-widest">Time Saved</div>
            <div className="text-sm font-black text-green-400">{card.saved_gpu_seconds}s</div>
          </div>
          <div>
            <div className="text-[10px] text-green-400/60 uppercase tracking-widest">Energy Saved</div>
            <div className="text-sm font-black text-green-400">{card.saved_energy_wh.toFixed(4)} Wh</div>
          </div>
          <div>
            <div className="text-[10px] text-green-400/60 uppercase tracking-widest">CO₂ Saved</div>
            <div className="text-sm font-black text-green-400">{card.saved_co2_grams.toFixed(4)} g</div>
          </div>
        </div>
      )}

      {/* Calculation note (for judges) */}
      <details className="text-[10px] text-white/30 cursor-pointer">
        <summary className="hover:text-white/60 transition-colors">🔬 How is this calculated?</summary>
        <p className="mt-2 p-2 bg-black/40 rounded font-mono leading-relaxed">{card.calculation_note}</p>
      </details>
    </motion.div>
  );
}
