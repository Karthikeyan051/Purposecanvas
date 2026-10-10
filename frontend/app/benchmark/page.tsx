"use client";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SectionReveal } from "../../components/SectionReveal";
import { FloatingShape } from "../../components/FloatingShape";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";

type BenchItem = {
  index: number; prompt: string; intent_type: string;
  baseline: { gpu_seconds: number; cost_usd: number; image_url: string; profile: string };
  smart: { gpu_seconds: number; cost_usd: number; image_url: string; profile: string; cache_hit: boolean };
};
type Summary = {
  total_baseline_gpu_seconds: number; total_smart_gpu_seconds: number;
  saved_gpu_seconds: number; saved_pct: number;
  baseline_cost_usd: number; smart_cost_usd: number; cost_label: string;
};

// Count-up hook
function useCountUp(target: number, dur = 1400) {
  const [v, setV] = useState(0);
  const raf = useRef<number>(0);
  const t0 = useRef<number | null>(null);
  useEffect(() => {
    if (!target) return;
    t0.current = null;
    const fn = (ts: number) => {
      if (!t0.current) t0.current = ts;
      const p = Math.min((ts - t0.current) / dur, 1);
      setV((1 - Math.pow(1 - p, 4)) * target);
      if (p < 1) raf.current = requestAnimationFrame(fn);
    };
    raf.current = requestAnimationFrame(fn);
    return () => cancelAnimationFrame(raf.current);
  }, [target, dur]);
  return v;
}

const TYPE_COLORS: Record<string, string> = {
  outline: "#34D399", flashcard: "#8B5CF6", poster: "#FBBF24", worksheet: "#F472B6",
};
const TOTAL = 20;

export default function BenchmarkPage() {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<BenchItem[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const wsRef = useRef<WebSocket | null>(null);

  const savedPct = useCountUp(summary?.saved_pct || 0);
  const savedSeconds = useCountUp(summary?.saved_gpu_seconds || 0, 1600);

  useEffect(() => {
    wsRef.current = new WebSocket(`${WS_URL}/ws/events`);
    wsRef.current.onmessage = (e) => {
      const d = JSON.parse(e.data);
      if (d.event === "benchmark_progress") setProgress(d.completed ?? 0);
    };
    return () => wsRef.current?.close();
  }, []);

  const runBenchmark = async () => {
    setRunning(true); setResults([]); setSummary(null); setProgress(0); setError("");
    try {
      const res = await fetch(`${API}/api/benchmark`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setResults(data.results || []);
      setSummary(data.summary || null);
    } catch (e: any) {
      setError(e.message || "Benchmark failed");
    } finally {
      setRunning(false);
    }
  };

  const filtered = filter === "all" ? results : results.filter((r) => r.intent_type === filter);
  const types = [...new Set(results.map((r) => r.intent_type))];

  return (
    <div className="min-h-screen relative">
      <FloatingShape shape="triangle" color="#FBBF24" size={80}  top="15%"   right="8%"   opacity={0.1} delay={1} />
      <FloatingShape shape="ring"    color="#8B5CF6" size={350}  top="-60px" left="-80px"  opacity={0.05} animate={false} />
      <FloatingShape shape="dot-grid" color="#8B5CF6" size={100} bottom="20%" right="3%" opacity={0.06} animate={false} />

      <div className="max-w-7xl mx-auto px-6 py-12 space-y-10">
        {/* Header */}
        <SectionReveal>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
            <div>
              <span className="badge badge-amber mb-3">20-Prompt Benchmark</span>
              <h1 className="text-display">
                <span className="text-[#FBBF24]">Benchmark</span> Results
              </h1>
              <p className="text-white/45 font-body text-[16px] mt-2">
                14 outlines · 3 flashcards · 3 posters — each run baseline vs Smart.
              </p>
            </div>
            <button
              onClick={runBenchmark}
              disabled={running}
              className={`btn-candy text-[15px] px-8 py-4 ${running ? "opacity-70" : ""}`}
              style={{ boxShadow: "4px 4px 0px #FBBF24" }}
            >
              {running ? <><span className="animate-spin">⏳</span> Running…</> : "▶ Run Benchmark"}
            </button>
          </div>
        </SectionReveal>

        {/* Progress */}
        <AnimatePresence>
          {running && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="glass p-5 space-y-3">
              <div className="flex justify-between text-sm font-body">
                <span className="text-[#FBBF24] font-semibold">Running {TOTAL}-prompt benchmark…</span>
                <span className="text-white/50">{progress} / {TOTAL} complete</span>
              </div>
              <div className="progress-bar h-3">
                <motion.div
                  className="progress-fill"
                  style={{ background: "#FBBF24" }}
                  animate={{ width: `${(progress / TOTAL) * 100}%` }}
                  transition={{ duration: 0.4 }}
                />
              </div>
              <div className="flex gap-2 flex-wrap text-xs font-body text-white/30">
                <span>Each item runs baseline (SDXL 25-step) AND smart (cheapest passing profile)</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error */}
        {error && (
          <div className="p-4 rounded-xl border border-red-500/25 bg-red-500/06 text-red-400 text-sm font-body">{error}</div>
        )}

        {/* ── Summary Hero ─────────────────────────────────────────────────── */}
        <AnimatePresence>
          {summary && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
              className="space-y-6">

              {/* Big number */}
              <div className="text-center py-10 relative overflow-hidden rounded-2xl border border-[#34D399]/20"
                style={{ background: "linear-gradient(135deg, #34D39906, #8B5CF606, #0A0A14)" }}>
                <FloatingShape shape="circle" color="#34D399" size={280} top="-60px" left="-60px" opacity={0.04} animate={false} />
                <p className="text-[11px] uppercase tracking-widest text-white/30 font-body font-semibold mb-2">Total GPU-seconds saved</p>
                <div className="text-[clamp(60px,10vw,120px)] font-heading font-black leading-none text-[#34D399]">
                  {savedPct.toFixed(1)}%
                </div>
                <p className="text-white/50 font-body text-lg mt-2">
                  {savedSeconds.toFixed(1)}s saved &nbsp;·&nbsp; {summary.total_smart_gpu_seconds.toFixed(1)}s used vs {summary.total_baseline_gpu_seconds.toFixed(1)}s baseline
                </p>
              </div>

              {/* Summary stat strip */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Baseline Total", value: `${summary.total_baseline_gpu_seconds.toFixed(1)}s`, color: "#ef4444", sub: "SDXL 25-step × 20" },
                  { label: "Smart Total",    value: `${summary.total_smart_gpu_seconds.toFixed(1)}s`,    color: "#8B5CF6", sub: "cheapest passing tier" },
                  { label: "GPU-s Saved",    value: `${summary.saved_gpu_seconds.toFixed(1)}s`,          color: "#34D399", sub: `${summary.saved_pct.toFixed(1)}% faster` },
                  { label: "Cost Note",      value: summary.cost_label || "—",                            color: "#FBBF24", sub: "relative compute cost" },
                ].map((s) => (
                  <div key={s.label} className="metric-card text-center"
                    style={{ borderColor: `${s.color}20`, boxShadow: `4px 4px 0px ${s.color}20` }}>
                    <p className="text-[10px] uppercase tracking-widest text-white/30 font-body mb-1">{s.label}</p>
                    <p className="font-heading font-black text-2xl" style={{ color: s.color }}>{s.value}</p>
                    <p className="text-[11px] text-white/30 font-body mt-0.5">{s.sub}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Results grid ─────────────────────────────────────────────────── */}
        <AnimatePresence>
          {results.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              {/* Filter chips */}
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => setFilter("all")}
                  className={`badge cursor-pointer transition-all ${filter === "all" ? "badge-violet" : "badge-ghost"}`}>
                  All ({results.length})
                </button>
                {types.map((t) => (
                  <button key={t} onClick={() => setFilter(t)}
                    className={`badge cursor-pointer transition-all ${filter === t ? "badge-violet" : "badge-ghost"}`}
                    style={filter === t ? { color: TYPE_COLORS[t], borderColor: `${TYPE_COLORS[t]}40`, backgroundColor: `${TYPE_COLORS[t]}12` } : {}}>
                    {t} ({results.filter((r) => r.intent_type === t).length})
                  </button>
                ))}
              </div>

              <div className="space-y-4">
                {filtered.map((item, i) => (
                  <SectionReveal key={item.index} delay={i * 0.03}>
                    <div className="card-sticker p-5 space-y-4" style={{ borderColor: `${TYPE_COLORS[item.intent_type] || "#8B5CF6"}30` }}>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-body font-bold text-white/30">#{item.index + 1}</span>
                          <span className="badge" style={{
                            color: TYPE_COLORS[item.intent_type] || "#8B5CF6",
                            borderColor: `${TYPE_COLORS[item.intent_type] || "#8B5CF6"}40`,
                            backgroundColor: `${TYPE_COLORS[item.intent_type] || "#8B5CF6"}12`,
                          }}>{item.intent_type}</span>
                          <p className="text-sm font-body text-white/70 flex-1">{item.prompt}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-red-400 font-mono text-sm line-through opacity-50">{item.baseline.gpu_seconds}s</span>
                          <span className="text-[#34D399] font-heading font-black text-lg">
                            {item.smart.cache_hit ? "⚡ 0s" : `${item.smart.gpu_seconds}s`}
                          </span>
                          {item.smart.cache_hit && <span className="badge badge-cyan">Cache Hit</span>}
                        </div>
                      </div>

                      {/* Image comparison */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <p className="text-[10px] uppercase tracking-widest text-red-400/60 font-body font-semibold">Baseline (SDXL 25-step)</p>
                          {item.baseline.image_url ? (
                            <img src={`${API}${item.baseline.image_url}`} className="w-full h-36 object-cover rounded-xl border border-red-500/15" />
                          ) : (
                            <div className="w-full h-36 rounded-xl bg-red-500/05 border border-red-500/15 flex items-center justify-center text-white/20 text-xs">No image</div>
                          )}
                          <div className="flex justify-between text-[10px] font-mono">
                            <span className="text-red-400">{item.baseline.gpu_seconds}s</span>
                            <span className="text-white/25">{item.baseline.profile}</span>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <p className="text-[10px] uppercase tracking-widest text-[#34D399]/60 font-body font-semibold">
                            Smart {item.smart.cache_hit ? "· Cache Hit" : ""}
                          </p>
                          {item.smart.image_url ? (
                            <img src={`${API}${item.smart.image_url}`} className="w-full h-36 object-cover rounded-xl border border-[#34D399]/15" />
                          ) : (
                            <div className="w-full h-36 rounded-xl bg-[#34D399]/05 border border-[#34D399]/15 flex items-center justify-center text-white/20 text-xs">
                              {item.smart.cache_hit ? "⚡ served from cache" : "No image"}
                            </div>
                          )}
                          <div className="flex justify-between text-[10px] font-mono">
                            <span className="text-[#34D399]">{item.smart.cache_hit ? "0s (cached)" : `${item.smart.gpu_seconds}s`}</span>
                            <span className="text-white/25">{item.smart.profile}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </SectionReveal>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty state */}
        {!running && results.length === 0 && !error && (
          <div className="text-center py-20">
            <div className="text-6xl mb-6 opacity-30">⚡</div>
            <p className="text-white/25 font-body text-lg">Click "Run Benchmark" to compare</p>
            <p className="text-white/15 font-body text-sm mt-2">Runs 20 prompts: baseline SDXL vs PurposeCanvas smart routing</p>
          </div>
        )}
      </div>
    </div>
  );
}
