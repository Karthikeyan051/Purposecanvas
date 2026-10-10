"use client";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";

type BenchItem = {
  index: number;
  prompt: string;
  intent_type: string;
  baseline: { gpu_seconds: number; cost_usd: number; image_url: string; profile: string };
  smart: { gpu_seconds: number; cost_usd: number; image_url: string; profile: string; cache_hit: boolean };
};
type Summary = {
  total_baseline_gpu_seconds: number;
  total_smart_gpu_seconds: number;
  saved_gpu_seconds: number;
  saved_pct: number;
  baseline_cost_usd: number;
  smart_cost_usd: number;
  cost_label: string;
};

export default function BenchmarkPage() {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<BenchItem[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket(`${WS_URL}/ws/events`);
    wsRef.current = ws;
    ws.onmessage = (e) => {
      const d = JSON.parse(e.data);
      if (d.event === "benchmark_progress") setProgress(d.completed);
      if (d.event === "benchmark_complete") setRunning(false);
    };
    return () => ws.close();
  }, []);

  const runBenchmark = async () => {
    setRunning(true);
    setResults([]);
    setSummary(null);
    setProgress(0);
    setError("");
    try {
      const res = await fetch(`${API}/api/benchmark`, { method: "POST" });
      const data = await res.json();
      setResults(data.results);
      setSummary(data.summary);
    } catch {
      setError("Backend not reachable. Start with: python -m uvicorn backend.main:app --port 8000");
    } finally {
      setRunning(false);
    }
  };

  const savedPct = summary?.saved_pct ?? 0;

  return (
    <div className="min-h-screen p-6 max-w-7xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-4xl font-black tracking-tight">
          <span className="text-[#00f5ff]">20-Prompt</span> Benchmark
        </h1>
        <p className="text-white/50 mt-1">Same prompts. Smart routing vs always-SDXL baseline. Real GPU-seconds measured.</p>
      </motion.div>

      {/* Run button */}
      <div className="glass p-6 mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="font-semibold">14 outlines · 3 flashcards · 3 posters</p>
            <p className="text-sm text-white/40">Each prompt runs in both modes. Timings are real GPU measurements.</p>
          </div>
          <button
            id="run-benchmark-btn"
            onClick={runBenchmark}
            disabled={running}
            className={`px-8 py-3 rounded-xl font-bold transition-all ${
              running
                ? "bg-[#00f5ff]/20 text-[#00f5ff] animate-pulse cursor-wait"
                : "btn-accent"
            }`}
          >
            {running ? `⟳ Running... (${progress}/20)` : "▶ Run Benchmark"}
          </button>
        </div>

        {/* Progress bar */}
        {running && (
          <div className="mt-4">
            <div className="bg-white/5 rounded-full h-2 overflow-hidden">
              <motion.div
                animate={{ width: `${(progress / 20) * 100}%` }}
                className="h-full bg-[#00f5ff] rounded-full transition-all"
              />
            </div>
            <p className="text-xs text-white/40 mt-1">{progress} / 20 prompts complete</p>
          </div>
        )}
      </div>

      {error && <p className="text-red-400 text-sm mb-4 glass p-3">{error}</p>}

      {/* Hero counter */}
      <AnimatePresence>
        {summary && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass p-8 mb-6 text-center gradient-border"
          >
            <p className="text-white/40 uppercase tracking-widest text-sm mb-2">GPU-seconds saved</p>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-7xl font-black text-[#00f5ff] glow-text"
            >
              {savedPct.toFixed(1)}%
            </motion.div>
            <p className="text-white/40 mt-2 text-sm">
              Baseline: {summary.total_baseline_gpu_seconds.toFixed(1)}s &nbsp;·&nbsp;
              Smart: {summary.total_smart_gpu_seconds.toFixed(1)}s &nbsp;·&nbsp;
              Saved: {summary.saved_gpu_seconds.toFixed(1)}s
            </p>
            <p className="text-[10px] text-white/25 mt-1">
              Cost: baseline ${summary.baseline_cost_usd.toFixed(4)} → smart ${summary.smart_cost_usd.toFixed(4)} ({summary.cost_label})
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results grid */}
      {results.length > 0 && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-xs font-semibold text-white/40 uppercase px-4">
            <span>Baseline (SDXL 25-step always)</span>
            <span>Smart (Purpose-routed)</span>
          </div>
          {results.map((item) => {
            const saved = item.baseline.gpu_seconds - item.smart.gpu_seconds;
            const pct = item.baseline.gpu_seconds > 0 ? (saved / item.baseline.gpu_seconds) * 100 : 0;
            return (
              <motion.div
                key={item.index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: item.index * 0.03 }}
                className="glass p-4"
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs text-white/30">#{item.index}</span>
                  <span className="text-sm font-medium truncate">{item.prompt}</span>
                  <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-white/5 text-white/40">{item.intent_type}</span>
                  <span className={`text-xs font-bold ${pct > 0 ? "text-[#10b981]" : "text-white/40"}`}>
                    {pct > 0 ? `↓${pct.toFixed(0)}%` : "—"}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {/* Baseline */}
                  <div className="bg-white/[0.02] rounded-lg p-2">
                    {item.baseline.image_url && (
                      <img src={`${API}${item.baseline.image_url}`} alt="baseline" className="w-full h-28 object-contain rounded mb-2 bg-white/5" />
                    )}
                    <div className="flex justify-between text-xs text-white/40">
                      <span>{item.baseline.gpu_seconds.toFixed(2)}s</span>
                      <span>${item.baseline.cost_usd.toFixed(5)}</span>
                    </div>
                  </div>
                  {/* Smart */}
                  <div className="bg-[#10b981]/[0.04] border border-[#10b981]/10 rounded-lg p-2">
                    {item.smart.image_url && (
                      <img src={`${API}${item.smart.image_url}`} alt="smart" className="w-full h-28 object-contain rounded mb-2 bg-white/5" />
                    )}
                    <div className="flex justify-between text-xs">
                      <span className="text-[#10b981]">{item.smart.gpu_seconds.toFixed(2)}s</span>
                      <span className="text-white/40">${item.smart.cost_usd.toFixed(5)}</span>
                    </div>
                    {item.smart.cache_hit && (
                      <span className="text-[10px] text-[#10b981]/70">💾 cached</span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
