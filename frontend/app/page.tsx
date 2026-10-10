"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";

const SCHOOLS = [
  { id: "s01", name: "Springfield Elementary" },
  { id: "s02", name: "Shelbyville Middle School" },
  { id: "s03", name: "Ogdenville Primary" },
  { id: "s04", name: "North Haverbrook High" },
  { id: "s05", name: "Capital City Academy" },
  { id: "s06", name: "Brockway School" },
  { id: "s07", name: "Cypress Creek Elementary" },
  { id: "s08", name: "Waverly Hills School" },
  { id: "s09", name: "West Springfield School" },
  { id: "s10", name: "Shelbyville High" },
  { id: "s11", name: "Grandpa's School" },
  { id: "s12", name: "District Office Lab School" },
];

const STEP_NAMES = ["intent", "cache", "profile", "generate", "quality"];
const STEP_LABELS: Record<string, string> = {
  intent: "Intent",
  cache: "Cache",
  profile: "Profile",
  generate: "Generate",
  quality: "Quality Gate",
};

type Step = { name: string; duration_ms: number; detail: string };
type Result = {
  request_id: string;
  image_url: string;
  intent: Record<string, unknown>;
  profile: string;
  cache_hit: boolean;
  escalated: boolean;
  gpu_seconds: number;
  energy_wh: number;
  cost_usd: number;
  baseline_gpu_seconds: number;
  saved_pct: number;
  latency_ms: number;
  steps: Step[];
};

export default function StudioPage() {
  const [prompt, setPrompt] = useState("");
  const [schoolId, setSchoolId] = useState("s01");
  const [mode, setMode] = useState<"smart" | "baseline">("smart");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [activeSteps, setActiveSteps] = useState<string[]>([]);
  const [chips, setChips] = useState<string[]>([]);
  const [pendingIntent, setPendingIntent] = useState<Record<string, unknown> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // WebSocket connection
  useEffect(() => {
    const ws = new WebSocket(`${WS_URL}/ws/events`);
    wsRef.current = ws;

    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      const evt = data.event;
      if (evt === "generating_start") setActiveSteps((p) => [...new Set([...p, "generate"])]);
      if (evt === "cache_hit") setActiveSteps((p) => [...new Set([...p, "cache"])]);
      if (evt === "generating_end") setActiveSteps((p) => [...new Set([...p, "generate", "quality"])]);
      if (evt === "complete") setActiveSteps(STEP_NAMES);
    };

    return () => ws.close();
  }, []);

  const doGenerate = useCallback(async (clarification?: string) => {
    if (!prompt.trim()) return;
    setLoading(true);
    setResult(null);
    setError("");
    setActiveSteps(["intent"]);
    setChips([]);
    setPendingIntent(null);

    try {
      const res = await fetch(`${API}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, school_id: schoolId, mode, clarification }),
      });
      const data = await res.json();

      if (data.needs_confirmation) {
        setChips(data.options || []);
        setPendingIntent(data.intent);
        setActiveSteps([]);
        return;
      }

      setResult(data);
      setActiveSteps(data.steps?.map((s: Step) => s.name) ?? STEP_NAMES);
    } catch {
      setError("Could not reach backend. Is it running on port 8000?");
    } finally {
      setLoading(false);
    }
  }, [prompt, schoolId, mode]);

  const handleChip = (chip: string) => doGenerate(chip);

  const savedPct = result ? Math.round(result.saved_pct) : 0;

  return (
    <div className="min-h-screen p-6 max-w-7xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-4xl font-black tracking-tight">
          Image <span className="text-[#00f5ff]">Studio</span>
        </h1>
        <p className="text-white/50 mt-1">Generate purpose-aware classroom images. The AI picks the cheapest model that meets the need.</p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Left: Input ── */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
          {/* School picker */}
          <div className="glass p-4">
            <label className="text-xs text-white/40 uppercase tracking-widest mb-2 block">School</label>
            <select
              id="school-picker"
              value={schoolId}
              onChange={(e) => setSchoolId(e.target.value)}
              className="w-full bg-transparent border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00f5ff]/50"
            >
              {SCHOOLS.map((s) => (
                <option key={s.id} value={s.id} className="bg-[#1a1a2e]">{s.name}</option>
              ))}
            </select>
          </div>

          {/* Mode toggle */}
          <div className="glass p-4">
            <label className="text-xs text-white/40 uppercase tracking-widest mb-3 block">Generation Mode</label>
            <div className="flex rounded-lg overflow-hidden border border-white/10 p-1 gap-1">
              {(["smart", "baseline"] as const).map((m) => (
                <button
                  key={m}
                  id={`mode-${m}`}
                  onClick={() => setMode(m)}
                  className={`flex-1 py-2 rounded-md text-sm font-semibold transition-all ${
                    mode === m
                      ? m === "smart"
                        ? "bg-[#00f5ff] text-[#0a0a0f]"
                        : "bg-white/20 text-white"
                      : "text-white/40 hover:text-white/70"
                  }`}
                >
                  {m === "smart" ? "⚡ Smart" : "📊 Baseline"}
                </button>
              ))}
            </div>
            <p className="text-xs text-white/30 mt-2">
              {mode === "smart"
                ? "Smart: routes to cheapest model that meets purpose"
                : "Baseline: always uses SDXL 25-step (district's current tool)"}
            </p>
          </div>

          {/* Prompt input */}
          <div className="glass p-4">
            <label className="text-xs text-white/40 uppercase tracking-widest mb-2 block">Describe the image</label>
            <textarea
              id="prompt-input"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && e.ctrlKey && doGenerate()}
              rows={4}
              placeholder="e.g. draw a cow for children to colour in..."
              className="w-full bg-transparent border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-[#00f5ff]/50 resize-none"
            />
            <p className="text-xs text-white/20 mt-1">Ctrl+Enter to generate</p>
          </div>

          {/* Purpose chips */}
          <AnimatePresence>
            {chips.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                className="glass p-4"
              >
                <p className="text-sm font-semibold mb-3 text-[#00f5ff]">What is this image for?</p>
                <div className="grid grid-cols-2 gap-2">
                  {chips.map((c) => (
                    <button
                      key={c}
                      onClick={() => handleChip(c)}
                      className="py-2 px-3 rounded-lg border border-white/10 text-sm hover:border-[#00f5ff]/50 hover:bg-[#00f5ff]/10 transition-all text-left"
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Generate button */}
          <button
            id="generate-btn"
            onClick={() => doGenerate()}
            disabled={loading || !prompt.trim()}
            className={`w-full py-4 rounded-xl font-bold text-base transition-all ${
              loading
                ? "bg-[#00f5ff]/30 text-[#00f5ff] animate-pulse cursor-wait"
                : "btn-accent"
            }`}
          >
            {loading ? "⟳ Generating..." : "⚡ Generate Image"}
          </button>

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
        </motion.div>

        {/* ── Right: Result ── */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
          {/* Image result */}
          <div className="glass p-4 min-h-[300px] flex items-center justify-center">
            <AnimatePresence mode="wait">
              {result ? (
                <motion.img
                  key={result.image_url}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  src={`${API}${result.image_url}`}
                  alt="Generated"
                  className="rounded-lg max-h-[400px] w-full object-contain"
                />
              ) : (
                <motion.div className="text-center text-white/25 py-16">
                  <div className="text-5xl mb-4">🎨</div>
                  <p className="text-sm">Your generated image will appear here</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Routing timeline */}
          <AnimatePresence>
            {(loading || result) && (
              <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="glass p-4"
              >
                <p className="text-xs text-white/40 uppercase tracking-widest mb-3">Routing Pipeline</p>
                <div className="flex items-center gap-1 flex-wrap">
                  {STEP_NAMES.map((step, i) => {
                    const stepData = result?.steps?.find((s) => s.name === step);
                    const isActive = activeSteps.includes(step);
                    return (
                      <div key={step} className="flex items-center gap-1">
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: isActive ? 1 : 0.7 }}
                          className={`flex flex-col items-center`}
                        >
                          <div className={`w-2.5 h-2.5 rounded-full mb-1 transition-all duration-500 ${
                            isActive ? "bg-[#00f5ff] shadow-[0_0_8px_#00f5ff]" : "bg-white/15"
                          }`} />
                          <span className={`text-xs ${isActive ? "text-white/80" : "text-white/25"}`}>
                            {STEP_LABELS[step]}
                          </span>
                          {stepData && (
                            <span className="text-[10px] text-white/35">{stepData.duration_ms.toFixed(0)}ms</span>
                          )}
                        </motion.div>
                        {i < STEP_NAMES.length - 1 && (
                          <div className={`w-6 h-px mb-4 transition-all duration-500 ${isActive ? "bg-[#00f5ff]/40" : "bg-white/10"}`} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Metrics badges */}
          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="glass p-4 space-y-3"
              >
                <div className="flex flex-wrap gap-2">
                  {/* Cache hit */}
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    result.cache_hit
                      ? "bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/30"
                      : "bg-white/5 text-white/50 border border-white/10"
                  }`}>
                    💾 Cache {result.cache_hit ? "HIT" : "MISS"}
                  </span>

                  {/* GPU-s */}
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#00f5ff]/10 text-[#00f5ff] border border-[#00f5ff]/20">
                    ⚡ {result.gpu_seconds.toFixed(2)} GPU-s
                  </span>

                  {/* Energy */}
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-white/5 text-white/60 border border-white/10">
                    🔋 {result.energy_wh.toFixed(4)} Wh
                  </span>

                  {/* Cost */}
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/20">
                    💰 ${result.cost_usd.toFixed(5)}*
                  </span>

                  {/* Escalated */}
                  {result.escalated && (
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#7c3aed]/20 text-[#7c3aed] border border-[#7c3aed]/30">
                      🔺 Escalated
                    </span>
                  )}
                </div>

                <p className="text-[10px] text-white/25">*assumed cloud rate ($0.0004/GPU-s) — GPU-s and Wh are real measurements</p>

                {/* Savings vs baseline */}
                {mode === "smart" && savedPct > 0 && (
                  <div className="border-t border-white/5 pt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-white/40">vs Baseline (SDXL 25-step)</span>
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-[#10b981] font-bold text-lg"
                      >
                        {savedPct}% saved
                      </motion.span>
                    </div>
                    <div className="mt-2 bg-white/5 rounded-full h-1.5 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${savedPct}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className="h-full bg-[#10b981] rounded-full"
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-white/30 mt-1">
                      <span>Baseline: {result.baseline_gpu_seconds.toFixed(1)} GPU-s</span>
                      <span>Smart: {result.gpu_seconds.toFixed(2)} GPU-s</span>
                    </div>
                  </div>
                )}

                {/* Profile info */}
                <div className="border-t border-white/5 pt-3">
                  <span className="text-xs text-white/30">Profile: </span>
                  <span className="text-xs text-white/60 font-mono">{result.profile}</span>
                  {result.intent && (
                    <span className="ml-2 text-xs text-white/30">
                      → {String(result.intent.type)} / {String(result.intent.colour)}
                    </span>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
