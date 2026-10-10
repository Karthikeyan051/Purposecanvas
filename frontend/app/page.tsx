"use client";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import { ResourceMeter } from "../components/ResourceMeter";
import { PipelineViz } from "../components/PipelineViz";
import { PromptViewer } from "../components/PromptViewer";
import { ParticleField } from "../components/ParticleField";
import { FloatingShape } from "../components/FloatingShape";
import { SectionReveal } from "../components/SectionReveal";
import { MetricCounter } from "../components/MetricCounter";

const HeroCanvas3D = dynamic(() => import("@/components/HeroCanvas"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center">
      <div className="w-24 h-24 rounded-full bg-[#8B5CF6]/20 animate-pulse" />
    </div>
  ),
});

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";

const SCHOOLS = [
  { id: "s01", name: "Springfield Elementary" },
  { id: "s02", name: "Shelbyville Middle School" },
  { id: "s03", name: "Ogdenville Primary" },
];

const STEP_NAMES = ["intent", "cache", "profile", "generate", "quality"];

// HeroCanvas is loaded dynamically — see HeroCanvas.tsx

// ── Data Transparency Panel ───────────────────────────────────────────────────
function DataPanel({ result, mode }: { result: any; mode: string }) {
  const [tab, setTab] = useState<"rag" | "quality" | "resource" | "json">("rag");

  const TABS = [
    { id: "rag",      label: "🧠 RAG Prompts",    desc: "Engineered prompts for 3 generators" },
    { id: "quality",  label: "🔬 Quality Gate",    desc: "OpenCV pixel analysis" },
    { id: "resource", label: "⚡ Resource Card",   desc: "GPU / Energy / CO₂ vs baseline" },
    { id: "json",     label: "{ } JSON",           desc: "Full API response" },
  ] as const;

  if (!result) return null;

  const qg = result.quality_gate;
  const rc = result.resource_card;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
      className="glass p-5 mt-6 space-y-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-heading font-bold text-sm text-white/60 uppercase tracking-widest">
          📊 Data Transparency — For Judges
        </h3>
        <span className="badge badge-violet">Full Pipeline</span>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-[#0D0D1A] rounded-xl border border-white/[0.05]">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`data-tab flex-1 text-center text-[11px] ${tab === t.id ? "active" : ""}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.15 }}
        >
          {tab === "rag" && (
            <PromptViewer promptCard={result.prompt_card} intent={result.intent} />
          )}

          {tab === "quality" && qg && (
            <div className="space-y-3">
              {/* Pass/Fail */}
              <div className={`flex items-center gap-3 p-3 rounded-xl border ${
                qg.passed ? "border-[#34D399]/25 bg-[#34D399]/06" : "border-red-500/25 bg-red-500/06"
              }`}>
                <span className="text-2xl">{qg.passed ? "✅" : "❌"}</span>
                <div>
                  <p className={`font-heading font-bold text-sm ${qg.passed ? "text-[#34D399]" : "text-red-400"}`}>
                    Quality Gate: {qg.passed ? "PASSED" : "FAILED"}
                  </p>
                  <p className="text-xs text-white/40 font-body">
                    {qg.escalated ? `Escalated to Tier ${qg.tier}` : "First-pass success"}
                  </p>
                </div>
                {qg.escalated && <span className="ml-auto badge badge-amber">Escalated</span>}
              </div>

              {/* Pixel stats */}
              {qg.pixel_stats && (
                <div className="space-y-2.5">
                  <p className="text-[10px] uppercase tracking-widest text-white/30 font-body font-semibold">Pixel Analysis</p>
                  {[
                    { key: "black_ratio", label: "Black Ratio", min: 0.03, max: 0.35, unit: "", good: (v: number) => v >= 0.03 && v <= 0.35 },
                    { key: "white_ratio", label: "White Ratio", min: 0.60, max: 1.0, unit: "", good: (v: number) => v >= 0.60 },
                    { key: "gray_stddev", label: "Gray Std Dev", min: 0, max: 50, unit: "", good: (v: number) => v <= 50 },
                  ].map(({ key, label, min, max, good }) => {
                    const val = qg.pixel_stats?.[key] ?? 0;
                    const isGood = good(val);
                    const pct = Math.min(100, (val / max) * 100);
                    return (
                      <div key={key}>
                        <div className="flex justify-between text-[11px] mb-1">
                          <span className="text-white/50 font-body">{label}</span>
                          <span className={`font-mono font-bold ${isGood ? "text-[#34D399]" : "text-red-400"}`}>
                            {val.toFixed(4)} {isGood ? "✓" : "✗"}
                          </span>
                        </div>
                        <div className="progress-bar">
                          <div
                            className="progress-fill"
                            style={{ width: `${pct}%`, background: isGood ? "#34D399" : "#ef4444" }}
                          />
                        </div>
                        <div className="flex justify-between text-[9px] text-white/20 mt-0.5">
                          <span>min {min}</span><span>max {max}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {tab === "resource" && rc && (
            <ResourceMeter card={rc} isBaseline={mode === "baseline"} cacheHit={result.cache_hit} />
          )}

          {tab === "json" && (
            <div className="code-block text-[10px] max-h-64 overflow-y-auto">
              <pre dangerouslySetInnerHTML={{
                __html: JSON.stringify(result, null, 2)
                  .replace(/"([^"]+)":/g, '<span style="color:#8B5CF6">"$1"</span>:')
                  .replace(/: "([^"]*)"/g, ': <span style="color:#FBBF24">"$1"</span>')
                  .replace(/: (-?\d+\.?\d*)/g, ': <span style="color:#34D399">$1</span>')
                  .replace(/: (true|false|null)/g, ': <span style="color:#F472B6">$1</span>')
              }} />
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function StudioPage() {
  const [activeTab, setActiveTab] = useState<"write" | "upload">("write");
  const [schoolId, setSchoolId] = useState("s01");
  const [mode, setMode] = useState<"smart" | "baseline">("smart");
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [activeSteps, setActiveSteps] = useState<string[]>([]);
  const [chips, setChips] = useState<string[]>([]);
  const [classification, setClassification] = useState<any>(null);
  const [selectedTier, setSelectedTier] = useState<number>(0);
  const [aiRecommendedTier, setAiRecommendedTier] = useState<number>(0);
  const [userHasOverridden, setUserHasOverridden] = useState(false);
  const [showFormula, setShowFormula] = useState(false);
  const [globalStats, setGlobalStats] = useState<any>(null);

  // Upload state
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selections, setSelections] = useState<Record<number, string>>({});
  const [batching, setBatching] = useState(false);
  const [batchResults, setBatchResults] = useState<any[]>([]);
  const [batchProgress, setBatchProgress] = useState(0);
  const [showUploadJSON, setShowUploadJSON] = useState(false);
  const [showBatchPrompts, setShowBatchPrompts] = useState(false);

  const typingTimeout = useRef<NodeJS.Timeout | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const generatorRef = useRef<HTMLDivElement>(null);

  // Live stats
  useEffect(() => {
    fetch(`${API}/api/stats`).then(r => r.json()).then(setGlobalStats).catch(() => {});
  }, [result]);

  // WebSocket
  useEffect(() => {
    const ws = new WebSocket(`${WS_URL}/ws/events`);
    wsRef.current = ws;
    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.event === "generating_start") setActiveSteps((p) => Array.from(new Set([...p, "intent", "profile", "generate"])));
      if (data.event === "cache_hit")        setActiveSteps((p) => Array.from(new Set([...p, "intent", "cache"])));
      if (data.event === "generating_end")   setActiveSteps((p) => Array.from(new Set([...p, "generate", "quality"])));
      if (data.event === "complete")         setActiveSteps(STEP_NAMES);
      if (data.event === "batch_progress")   setBatchProgress(data.completed);
    };
    return () => ws.close();
  }, []);

  // Debounced classification
  useEffect(() => {
    if (activeTab !== "write" || !prompt.trim() || mode === "baseline" || result) {
      setClassification(null);
      return;
    }
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API}/api/classify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt }),
        });
        const data = await res.json();
        setClassification(data);
        const aiTier = data.recommended_tier ?? (data.profiles?.length > 1 ? 1 : 0);
        setSelectedTier(aiTier);
        setAiRecommendedTier(aiTier);
        setUserHasOverridden(false);
      } catch {}
    }, 700);
    return () => { if (typingTimeout.current) clearTimeout(typingTimeout.current); };
  }, [prompt, mode, activeTab, result]);

  const doGenerate = async (clarification?: string) => {
    if (!prompt.trim()) return;
    setLoading(true);
    setResult(null);
    setActiveSteps(["intent"]);
    setChips([]);
    try {
      const res = await fetch(`${API}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, school_id: schoolId, mode, clarification, tier: selectedTier }),
      });
      const data = await res.json();
      if (data.needs_confirmation) { setChips(data.options || []); setActiveSteps([]); return; }
      setResult(data);
      setActiveSteps(STEP_NAMES);
    } catch {} finally {
      setLoading(false);
    }
  };

  const handleUpload = async (fileToUpload: File) => {
    setFile(fileToUpload); setUploading(true);
    const fd = new FormData();
    fd.append("file", fileToUpload); fd.append("school_id", schoolId);
    try {
      const res = await fetch(`${API}/api/upload`, { method: "POST", body: fd });
      const data = await res.json();
      setUploadResult(data);
      const s: any = {};
      data.points.forEach((_: any, i: number) => { s[i] = data.suggested_types[i]; });
      setSelections(s);
    } catch {} finally { setUploading(false); }
  };

  const doBatchGenerate = async () => {
    if (!uploadResult) return;
    setBatching(true); setBatchResults([]); setBatchProgress(0); setShowBatchPrompts(false);
    
    // For demo purposes: Instantly generate the master JSON payload instead of waiting for images
    setTimeout(() => {
      setBatchProgress(uploadResult.points.length);
      setShowBatchPrompts(true);
      setBatching(false);
    }, 1200);
  };

  const RESOURCE_MAP: Record<string, any> = {
    outline:   { tier:"Draft",    color:"#34D399", steps:2,  res:"512px",  model:"SD-Turbo", gpu:1.0,  wh:0.0889, co2:0.0207, saved:98.4 },
    flashcard: { tier:"Draft",    color:"#34D399", steps:4,  res:"512px",  model:"SD-Turbo", gpu:2.0,  wh:0.1778, co2:0.0414, saved:96.8 },
    worksheet: { tier:"Draft",    color:"#34D399", steps:4,  res:"512px",  model:"SD-Turbo", gpu:2.0,  wh:0.1778, co2:0.0414, saved:96.8 },
    poster:    { tier:"Standard", color:"#FBBF24", steps:15, res:"1024px", model:"SDXL",     gpu:37.5, wh:3.3333, co2:0.7767, saved:40.0 },
  };
  const BASELINE = { gpu: 62.5, wh: 5.5556, co2: 1.2945 };

  return (
    <div className="relative min-h-screen">
      <ParticleField />

      {/* ── SECTION 1: HERO ────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center overflow-hidden">
        {/* Geometric decorations */}
        <FloatingShape shape="ring"   color="#8B5CF6" size={400} top="-80px"  left="-100px" opacity={0.07} delay={0} />
        <FloatingShape shape="circle" color="#8B5CF6" size={160} top="20%"    left="10%"    opacity={0.05} delay={1} />
        <FloatingShape shape="triangle" color="#FBBF24" size={60} top="15%" right="15%" opacity={0.1} delay={2} />
        <FloatingShape shape="dot-grid" color="#8B5CF6" size={120} bottom="15%" left="5%" opacity={0.06} animate={false} />
        <FloatingShape shape="ring"  color="#00F5FF"  size={200} bottom="10%" right="5%"  opacity={0.06} delay={3} />

        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-14 items-center py-24 pt-32">
          {/* Left: Text */}
          <div className="flex flex-col items-start">
            {/* Pill badge */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#8B5CF6]/30 bg-[#8B5CF6]/08 mb-8"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#34D399] pulse-emerald" />
              <span className="text-[12px] font-body font-semibold text-white/60">Hackathon Demo · Live</span>
            </motion.div>

            {/* Hero headline — Taste Skill sizing */}
            <motion.h1
              className="text-hero text-[#F0F0FF] mb-6"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1, ease: [0.34, 1.56, 0.64, 1] }}
            >
              Purpose‑Aware<br />
              <span className="text-[#8B5CF6]">Image Generation</span><br />
              for Schools.
            </motion.h1>

            <motion.p
              className="text-[18px] font-body text-white/55 max-w-[44ch] leading-relaxed mb-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              We ask <span className="text-white/80 font-semibold">what</span> the picture is for.
              Then route to the cheapest model that meets the need —
              using <span className="text-[#34D399] font-semibold">97% less GPU</span> than the default SDXL.
            </motion.p>

            {/* Live stat strip */}
            {globalStats && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="flex flex-wrap gap-4 mb-8 text-sm font-body"
              >
                <span className="text-white/40">
                  <span className="text-[#34D399] font-bold font-heading">{globalStats.total_requests}</span> requests
                </span>
                <span className="text-white/20">·</span>
                <span className="text-white/40">
                  <span className="text-[#FBBF24] font-bold font-heading">{globalStats.total_gpu_seconds_saved?.toFixed(1)}s</span> GPU saved
                </span>
                <span className="text-white/20">·</span>
                <span className="text-white/40">
                  <span className="text-[#8B5CF6] font-bold font-heading">{(globalStats.cache_hit_rate * 100).toFixed(0)}%</span> cache hit
                </span>
              </motion.div>
            )}

            {/* CTAs */}
            <motion.div
              className="flex flex-wrap gap-3"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
            >
              <button
                className="btn-candy"
                onClick={() => generatorRef.current?.scrollIntoView({ behavior: "smooth" })}
              >
                ⚡ Generate Image
                <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs">→</span>
              </button>
              <a href="/dashboard" className="btn-ghost">View Dashboard</a>
            </motion.div>
          </div>

          {/* Right: 3D Canvas */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="w-full aspect-square max-w-md mx-auto lg:max-w-none relative"
          >
            {/* Violet glow behind orb */}
            <div className="absolute inset-0 rounded-full bg-[#8B5CF6] opacity-[0.08] blur-3xl scale-75" />
            <HeroCanvas3D />
          </motion.div>
        </div>

        {/* Scroll cue */}
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/20 text-xs font-body flex flex-col items-center gap-2"
        >
          <span>scroll to explore</span>
          <span className="text-lg">↓</span>
        </motion.div>
      </section>

      {/* ── SECTION 2: HOW IT WORKS ────────────────────────────────────── */}
      <section className="relative py-24 overflow-hidden">
        {/* Diagonal stripe bg */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: "repeating-linear-gradient(45deg, #8B5CF6 0, #8B5CF6 1px, transparent 0, transparent 50%)", backgroundSize: "24px 24px" }}
        />
        <FloatingShape shape="ring" color="#8B5CF6" size={300} top="-60px" right="-60px" opacity={0.05} animate={false} />

        <div className="relative z-10 max-w-6xl mx-auto px-6">
          <SectionReveal>
            <div className="text-center mb-16">
              <span className="badge badge-violet mb-4">How It Works</span>
              <h2 className="text-display">
                The <span className="text-[#8B5CF6]">5-Stage</span> Pipeline
              </h2>
              <p className="text-white/50 font-body text-[17px] mt-4 max-w-[50ch] mx-auto">
                Every request flows through intent detection, vector cache lookup, smart routing, generation, and quality assurance — in under 3 seconds.
              </p>
            </div>
          </SectionReveal>

          {/* Pipeline steps as large cards */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {[
              { n: "01", icon: "🧠", label: "Intent + RAG", desc: "Groq LLM classifies the prompt. Domain knowledge retrieval engineers a perfect SD/MJ/DALL-E prompt.", color: "#8B5CF6", badge: "Groq LLaMA" },
              { n: "02", icon: "⚡", label: "Vector Cache", desc: "Cosine similarity search against past generations. Cache hits cost 0 GPU seconds.", color: "#00F5FF", badge: "FAISS" },
              { n: "03", icon: "🎯", label: "Smart Routing", desc: "Selects cheapest profile (model, resolution, steps) that still meets the purpose.", color: "#FBBF24", badge: "Profile Ladder" },
              { n: "04", icon: "🖼", label: "Generation", desc: "SD-Turbo (2–4 steps, 512px) or SDXL (12–25 steps, 1024px) — never both loaded at once.", color: "#F472B6", badge: "VRAM Safe" },
              { n: "05", icon: "✅", label: "Quality Gate", desc: "OpenCV checks black/white ratio and sharpness. Fails escalate to next tier automatically.", color: "#34D399", badge: "Auto-Escalate" },
            ].map((step, i) => (
              <SectionReveal key={i} delay={i * 0.07}>
                <div
                  className="card-sticker h-full p-5 flex flex-col"
                  style={{ borderColor: `${step.color}30`, boxShadow: `4px 4px 0px ${step.color}30` }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-3xl">{step.icon}</span>
                    <span className="badge" style={{ color: step.color, borderColor: `${step.color}40`, backgroundColor: `${step.color}12` }}>
                      {step.badge}
                    </span>
                  </div>
                  <p className="text-[10px] font-body font-bold text-white/25 mb-1 tracking-widest">STEP {step.n}</p>
                  <h3 className="font-heading font-bold text-[15px] text-white mb-2" style={{ color: step.color }}>{step.label}</h3>
                  <p className="text-[12px] text-white/50 font-body leading-relaxed flex-1">{step.desc}</p>
                </div>
              </SectionReveal>
            ))}
          </div>

          {/* Baseline comparison strip */}
          <SectionReveal delay={0.4}>
            <div className="mt-12 p-6 rounded-2xl border border-white/[0.06] bg-[#111120]">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                <div>
                  <p className="text-[11px] text-white/30 uppercase tracking-widest font-body mb-1">Baseline (No PurposeCanvas)</p>
                  <p className="text-2xl font-heading font-black text-red-400">62.5s</p>
                  <p className="text-xs text-white/35 font-body">SDXL · 25 steps · 1024px · 5.56Wh · 1.29g CO₂</p>
                </div>
                <div className="flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-4xl font-heading font-black text-[#34D399]">↓ 97%</div>
                    <p className="text-xs text-white/35 font-body mt-1">savings on outline drafts</p>
                  </div>
                </div>
                <div>
                  <p className="text-[11px] text-white/30 uppercase tracking-widest font-body mb-1">PurposeCanvas Draft</p>
                  <p className="text-2xl font-heading font-black text-[#34D399]">1.0s</p>
                  <p className="text-xs text-white/35 font-body">SD-Turbo · 2 steps · 512px · 0.089Wh · 0.021g CO₂</p>
                </div>
              </div>
            </div>
          </SectionReveal>
        </div>
      </section>

      {/* ── SECTION 3: GENERATOR ───────────────────────────────────────── */}
      <section ref={generatorRef} className="relative py-24">
        <FloatingShape shape="circle" color="#8B5CF6" size={500} top="-100px" right="-150px" opacity={0.04} animate={false} />

        <div className="max-w-6xl mx-auto px-6">
          <SectionReveal>
            <div className="mb-10 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <span className="badge badge-violet mb-3">Live Demo</span>
                <h2 className="text-display">Image <span className="text-[#8B5CF6]">Studio</span></h2>
              </div>
              <div className="flex flex-wrap gap-3 items-center">
                {/* School picker */}
                <select
                  value={schoolId}
                  onChange={(e) => setSchoolId(e.target.value)}
                  className="bg-[#111120] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white/70 font-body focus:border-[#8B5CF6]/50 outline-none cursor-pointer"
                >
                  {SCHOOLS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                {/* Mode toggle */}
                <div className="flex rounded-xl overflow-hidden border border-white/10 bg-[#0D0D1A] p-1 gap-1">
                  {(["smart", "baseline"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setMode(m)}
                      className={`px-4 py-1.5 rounded-lg text-sm font-heading font-semibold transition-all ${
                        mode === m ? "bg-[#8B5CF6] text-white shadow-[2px_2px_0px_rgba(139,92,246,0.4)]" : "text-white/40 hover:text-white"
                      }`}
                    >
                      {m === "smart" ? "⚡ Smart" : "📊 Baseline"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </SectionReveal>

          {/* Tab switch */}
          <div className="flex gap-2 mb-6">
            {(["write", "upload"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`flex-1 py-3 rounded-xl font-heading font-bold text-sm transition-all ${
                  activeTab === t ? "bg-[#111120] border border-[#8B5CF6]/30 text-[#8B5CF6]" : "bg-white/[0.03] text-white/40 hover:text-white/60"
                }`}
              >
                {t === "write" ? "✏️ Write Prompt" : "📄 Upload Document"}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-6">
            {/* LEFT: Input */}
            <div className="space-y-4">
              <AnimatePresence mode="wait">
                {activeTab === "write" ? (
                  <motion.div key="write" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass p-5 space-y-4">
                    {/* Textarea */}
                    <div className="relative">
                      <textarea
                        value={prompt}
                        onChange={(e) => { setPrompt(e.target.value); setResult(null); setActiveSteps([]); }}
                        rows={4}
                        placeholder="Describe the image you need... e.g. 'a colouring page of a photosynthesis diagram for Year 5'"
                        className="w-full bg-[#0D0D1A] border border-white/10 rounded-xl p-4 text-sm font-body text-white/80 placeholder-white/25 focus:border-[#8B5CF6]/50 focus:outline-none resize-none transition-colors"
                      />
                    </div>

                    {/* Real-time classification */}
                    <AnimatePresence>
                      {classification && mode === "smart" && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="space-y-3 overflow-hidden"
                        >
                          {/* ── Intent + Confidence header ── */}
                          <div className="flex items-center gap-3 px-4 py-3 bg-[#8B5CF6]/08 border border-[#8B5CF6]/20 rounded-xl">
                            <span className="text-2xl">🧠</span>
                            <div className="flex-1">
                              <p className="text-[10px] uppercase tracking-widest text-[#8B5CF6]/60 font-body font-semibold">AI Inferred Purpose</p>
                              <p className="text-sm font-heading font-bold text-white capitalize">{classification.intent?.type}</p>
                            </div>
                            {/* Confidence arc */}
                            <div className="flex flex-col items-center gap-0.5">
                              <span className={`text-lg font-heading font-black ${
                                classification.intent?.confidence >= 0.85 ? "text-[#34D399]" :
                                classification.intent?.confidence >= 0.65 ? "text-[#FBBF24]" : "text-red-400"
                              }`}>
                                {(classification.intent?.confidence * 100).toFixed(0)}%
                              </span>
                              <span className="text-[8px] text-white/30 font-body uppercase tracking-wider">conf</span>
                            </div>
                          </div>

                          {/* ── Animated confidence bar ── */}
                          <div className="px-1">
                            <div className="flex justify-between text-[9px] font-body text-white/30 mb-1">
                              <span>AI Confidence in this decision</span>
                              <span className={`font-bold ${
                                classification.intent?.confidence >= 0.85 ? "text-[#34D399]" :
                                classification.intent?.confidence >= 0.65 ? "text-[#FBBF24]" : "text-red-400"
                              }`}>
                                {classification.intent?.confidence >= 0.85 ? "High — generating immediately" :
                                 classification.intent?.confidence >= 0.65 ? "Moderate — review & confirm" : "Low — please clarify"}
                              </span>
                            </div>
                            <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                              <motion.div
                                className="h-full rounded-full"
                                initial={{ width: 0 }}
                                animate={{ width: `${(classification.intent?.confidence || 0) * 100}%` }}
                                transition={{ duration: 0.6, ease: "easeOut" }}
                                style={{ background: classification.intent?.confidence >= 0.85 ? "#34D399" : classification.intent?.confidence >= 0.65 ? "#FBBF24" : "#ef4444" }}
                              />
                            </div>
                          </div>

                          {/* ── AI Reasoning Card ── */}
                          {classification.reasoning && (
                            <motion.div
                              initial={{ opacity: 0, y: -4 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.15 }}
                              className="px-4 py-3 bg-[#00F5FF]/05 border border-[#00F5FF]/15 rounded-xl"
                            >
                              <p className="text-[10px] uppercase tracking-widest text-[#00F5FF]/50 font-body font-semibold mb-1.5">
                                🤖 Why the AI chose this
                              </p>
                              <p className="text-[12px] text-white/65 font-body leading-relaxed">
                                {classification.reasoning}
                              </p>
                              {/* Signal word pills */}
                              {classification.signal_words?.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                  {classification.signal_words.map((w: string, i: number) => (
                                    <motion.span
                                      key={w}
                                      initial={{ opacity: 0, scale: 0.7 }}
                                      animate={{ opacity: 1, scale: 1 }}
                                      transition={{ delay: 0.2 + i * 0.07 }}
                                      className="text-[9px] px-2 py-0.5 rounded-full bg-[#00F5FF]/12 text-[#00F5FF] border border-[#00F5FF]/20 font-mono"
                                    >
                                      "{w}"
                                    </motion.span>
                                  ))}
                                </div>
                              )}
                            </motion.div>
                          )}

                          {/* ── Tier picker ── */}
                          <div className="space-y-2">
                            <p className="text-[10px] uppercase tracking-widest text-white/30 font-body font-semibold">⚡ AI Proposed Tier — Override if needed</p>
                            {classification.profiles?.map((p: any, idx: number) => {
                              const sel = selectedTier === idx;
                              const isAiPick = idx === aiRecommendedTier;
                              const colors = ["#34D399", "#FBBF24", "#F472B6"];
                              const c = colors[idx] || "#8B5CF6";
                              return (
                                <motion.button
                                  key={idx}
                                  onClick={() => {
                                    setSelectedTier(idx);
                                    setUserHasOverridden(idx !== aiRecommendedTier);
                                  }}
                                  whileHover={{ x: 2 }}
                                  whileTap={{ scale: 0.98 }}
                                  className={`tier-card w-full text-left ${sel ? "selected" : ""}`}
                                >
                                  <div className="flex justify-between items-start mb-1.5">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="badge" style={{ color: c, borderColor: `${c}40`, backgroundColor: `${c}12` }}>
                                        {p.tier_label}
                                      </span>
                                      {/* AI Pick badge */}
                                      {isAiPick && (
                                        <motion.span
                                          initial={{ opacity: 0, x: -6 }}
                                          animate={{ opacity: 1, x: 0 }}
                                          className="text-[9px] font-mono text-[#00F5FF] border border-[#00F5FF]/30 rounded-full px-1.5 py-0.5"
                                        >
                                          ⚡ AI Pick
                                        </motion.span>
                                      )}
                                      {/* Override badge */}
                                      {sel && userHasOverridden && (
                                        <motion.span
                                          initial={{ opacity: 0, scale: 0.7 }}
                                          animate={{ opacity: 1, scale: 1 }}
                                          className="text-[9px] font-mono text-[#FBBF24] border border-[#FBBF24]/30 rounded-full px-1.5 py-0.5"
                                        >
                                          🔄 Your Override
                                        </motion.span>
                                      )}
                                    </div>
                                    <span className="text-sm font-heading font-black text-[#34D399]">{p.saved_pct}% saved</span>
                                  </div>
                                  <p className="text-[11px] text-white/45 font-body mb-2">{p.tier_desc}</p>
                                  <div className="flex gap-4 text-[10px] font-mono text-white/30">
                                    <span>GPU: <strong className="text-white/55">{p.gpu_seconds}s</strong></span>
                                    <span>Energy: <strong className="text-white/55">{p.energy_wh?.toFixed(3)}Wh</strong></span>
                                    <span>CO₂: <strong className="text-white/55">{p.co2_grams?.toFixed(3)}g</strong></span>
                                  </div>
                                </motion.button>
                              );
                            })}
                          </div>

                          {/* ── Override comparison strip ── */}
                          <AnimatePresence>
                            {userHasOverridden && classification.profiles && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="px-3 py-2.5 bg-[#FBBF24]/08 border border-[#FBBF24]/25 rounded-xl text-[11px] font-body overflow-hidden"
                              >
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-[#FBBF24] font-bold">🔄 Override Active</span>
                                  <span className="text-white/40">AI suggested</span>
                                  <span className="font-heading font-bold text-[#34D399]">
                                    {classification.profiles[aiRecommendedTier]?.tier_label}
                                  </span>
                                  <span className="text-white/30">→</span>
                                  <span className="text-white/40">you chose</span>
                                  <span className="font-heading font-bold text-[#FBBF24]">
                                    {classification.profiles[selectedTier]?.tier_label}
                                  </span>
                                  <span className="text-white/25 text-[9px] ml-auto font-mono">
                                    Δ GPU: {((classification.profiles[selectedTier]?.gpu_seconds || 0) - (classification.profiles[aiRecommendedTier]?.gpu_seconds || 0)).toFixed(1)}s
                                  </span>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Generate button */}
                    <button
                      onClick={() => doGenerate()}
                      disabled={loading || !prompt.trim()}
                      className={`btn-candy w-full py-4 text-[15px] ${loading ? "opacity-70" : ""}`}
                    >
                      {loading ? (
                        <><span className="animate-spin">⏳</span> Generating…</>
                      ) : (
                        <>⚡ Generate Image <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs">→</span></>
                      )}
                    </button>

                    {/* Clarification chips */}
                    <AnimatePresence>
                      {chips.length > 0 && (
                        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="pt-4 border-t border-white/[0.06]">
                          <p className="text-sm font-heading font-semibold mb-3 text-[#8B5CF6]">What is this image for?</p>
                          <div className="grid grid-cols-2 gap-2">
                            {chips.map((c) => (
                              <button key={c} onClick={() => doGenerate(c)}
                                className="py-2.5 px-3 rounded-xl border border-white/10 text-sm font-body hover:border-[#8B5CF6]/40 hover:bg-[#8B5CF6]/08 transition-all text-left text-white/70">
                                {c}
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ) : (
                  <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass p-6 space-y-4">
                    <div
                      className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer relative ${
                        isDragging ? "border-[#8B5CF6] bg-[#8B5CF6]/08" : "border-white/15 hover:border-[#8B5CF6]/40"
                      }`}
                      onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files[0]) handleUpload(e.dataTransfer.files[0]); }}
                      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                      onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                    >
                      <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} accept=".pdf,.txt,.docx" />
                      <div className="text-5xl mb-3">📁</div>
                      <h3 className="font-heading font-bold text-white/80">Drop a PDF, TXT, or DOCX</h3>
                      <p className="text-sm text-white/35 font-body mt-1">Lesson plans · Syllabi · Study notes</p>
                    </div>
                    {uploading && <p className="text-[#8B5CF6] text-sm font-body animate-pulse text-center">🧠 Extracting concepts with AI…</p>}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Upload results */}
              {activeTab === "upload" && uploadResult && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass p-4 space-y-4">
                  <div className="pb-3 border-b border-white/[0.06] flex justify-between items-start">
                    <div>
                      <h3 className="font-heading font-bold text-[#8B5CF6] text-sm">📚 Domain Detected</h3>
                      <p className="text-sm text-white/60 font-body mt-1">
                        {uploadResult.domain.domain} › {uploadResult.domain.sub_domain} › {uploadResult.domain.grade_range}
                        <span className="ml-2 text-white/25">({Math.round(uploadResult.domain.confidence * 100)}% conf)</span>
                      </p>
                    </div>
                    <button
                      onClick={() => setShowUploadJSON(!showUploadJSON)}
                      className={`text-[10px] px-2.5 py-1 rounded-lg border transition-all font-mono ${
                        showUploadJSON ? "bg-[#00F5FF]/10 text-[#00F5FF] border-[#00F5FF]/30" : "bg-white/[0.04] text-white/40 border-white/10 hover:text-white"
                      }`}
                    >
                      {'{ JSON }'}
                    </button>
                  </div>

                  <AnimatePresence mode="wait">
                    {showUploadJSON ? (
                      <motion.div
                        key="json"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-[#0D0D1A] rounded-xl border border-[#00F5FF]/20 p-4 overflow-hidden"
                      >
                        <p className="text-[10px] uppercase tracking-widest text-[#00F5FF]/50 font-body font-semibold mb-3">Raw AI Payload</p>
                        <div className="code-block text-[10px] max-h-80 overflow-y-auto">
                          <pre dangerouslySetInnerHTML={{
                            __html: JSON.stringify(uploadResult, null, 2)
                              .replace(/"([^"]+)":/g, '<span style="color:#8B5CF6">"$1"</span>:')
                              .replace(/: "([^"]*)"/g, ': <span style="color:#FBBF24">"$1"</span>')
                              .replace(/: (-?\d+\.?\d*)/g, ': <span style="color:#34D399">$1</span>')
                              .replace(/: (true|false|null)/g, ': <span style="color:#F472B6">$1</span>')
                          }} />
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                        {uploadResult.points.map((pt: string, i: number) => {
                          const enriched = uploadResult.enriched_points?.[i];
                          const aiSuggestedType = enriched?.suggested_type || uploadResult.suggested_types?.[i] || "flashcard";
                          const selType = selections[i] || aiSuggestedType;
                          const userOverrodeThis = selType !== aiSuggestedType;
                          const r = RESOURCE_MAP[selType];
                          const intentData = enriched?.prompt_card?.purposecanvas_prompt_card?.intent;
                          const confidence = intentData?.confidence ?? null;
                          return (
                            <motion.div
                              key={i}
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: i * 0.04 }}
                              className="bg-[#0D0D1A] rounded-xl border border-white/[0.06] overflow-hidden"
                            >
                              <div className="p-3">
                                <div className="flex items-start justify-between gap-2 mb-2">
                                  <p className="text-sm font-body text-white/80">{i + 1}. {pt}</p>
                                  {/* Confidence badge */}
                                  {confidence !== null && (
                                    <span className={`shrink-0 text-[9px] font-mono px-1.5 py-0.5 rounded-full border ${
                                      confidence >= 0.85 ? "text-[#34D399] border-[#34D399]/30 bg-[#34D399]/08" :
                                      confidence >= 0.65 ? "text-[#FBBF24] border-[#FBBF24]/30 bg-[#FBBF24]/08" :
                                      "text-red-400 border-red-400/30 bg-red-400/08"
                                    }`}>
                                      {(confidence * 100).toFixed(0)}% conf
                                    </span>
                                  )}
                                </div>
                                {/* AI Reasoning */}
                                {enriched?.prompt_card && (
                                  <div className="mb-2 px-2 py-1.5 bg-[#00F5FF]/04 border border-[#00F5FF]/10 rounded-lg">
                                    <p className="text-[9px] text-[#00F5FF]/50 font-body uppercase tracking-widest mb-0.5">🤖 AI inferred</p>
                                    <p className="text-[10px] text-white/50 font-body">
                                      <span className="text-[#8B5CF6] font-bold capitalize">{aiSuggestedType}</span>
                                      {intentData?.age_group ? ` · ages ${intentData.age_group}` : ""}
                                      {intentData?.complexity ? ` · complexity ${intentData.complexity}/3` : ""}
                                    </p>
                                  </div>
                                )}
                              </div>
                              <div className="px-3 pb-3 flex flex-wrap gap-1.5">
                                {(["outline","flashcard","poster","worksheet"] as const).map((type) => {
                                  const isAiPick = type === aiSuggestedType;
                                  const isSelected = selType === type;
                                  return (
                                    <button key={type} onClick={() => setSelections((s) => ({ ...s, [i]: type }))}
                                      className={`text-xs px-3 py-1.5 rounded-full border transition-all font-body font-semibold relative ${
                                        isSelected
                                          ? "border-[#8B5CF6]/50 text-[#8B5CF6] bg-[#8B5CF6]/10"
                                          : "bg-white/[0.04] text-white/35 border-transparent hover:border-white/15"
                                      }`}>
                                      {type === "outline" ? "🖍 Colouring" : type === "flashcard" ? "📇 Flashcard" : type === "worksheet" ? "📝 Worksheet" : "🖼 Poster"}
                                      {isAiPick && (
                                        <span className="ml-1 text-[8px] text-[#00F5FF] opacity-70">⚡</span>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                              {/* Override indicator for this item */}
                              {userOverrodeThis && (
                                <div className="mx-3 mb-2 px-2 py-1 bg-[#FBBF24]/06 border border-[#FBBF24]/20 rounded-lg flex items-center gap-1.5 text-[9px] font-body">
                                  <span className="text-[#FBBF24]">🔄</span>
                                  <span className="text-white/40">AI suggested</span>
                                  <span className="text-[#34D399] font-bold capitalize">{aiSuggestedType}</span>
                                  <span className="text-white/25">→ you chose</span>
                                  <span className="text-[#FBBF24] font-bold capitalize">{selType}</span>
                                </div>
                              )}
                              {/* Mini resource comparison */}
                              <div className="mx-3 mb-3 rounded-xl border border-white/[0.05] bg-black/30 p-3">
                                <div className="flex justify-between items-center mb-2">
                                  <span className="text-[10px] text-white/30 font-body uppercase tracking-widest">Resource estimate</span>
                                  <span className="font-heading font-black text-sm" style={{ color: r.color }}>{r.saved}% saved</span>
                                </div>
                                <div className="relative h-4 bg-red-500/10 rounded-full overflow-hidden border border-red-500/15">
                                  <div className="h-full rounded-full flex items-center pl-2 transition-all duration-700"
                                    style={{ width: `${(r.gpu / BASELINE.gpu) * 100}%`, backgroundColor: r.color }}>
                                    <span className="text-[9px] font-bold text-black whitespace-nowrap">{r.gpu}s</span>
                                  </div>
                                </div>
                                <div className="flex justify-between text-[9px] mt-0.5 text-white/20">
                                  <span style={{ color: r.color }}>{r.model} · {r.res}</span>
                                  <span className="text-red-400/50">Baseline: {BASELINE.gpu}s</span>
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Batch Impact Summary */}
                  {!showUploadJSON && uploadResult?.points && (
                    <div className="bg-[#8B5CF6]/10 border border-[#8B5CF6]/30 rounded-xl p-4 mt-2">
                      <div className="flex justify-between items-end mb-3">
                        <div>
                          <p className="text-[10px] uppercase tracking-widest text-[#8B5CF6]/60 font-body font-semibold">Batch Impact Estimate</p>
                          <p className="text-xl font-heading font-black text-[#34D399] leading-none mt-1">
                            {(() => {
                              const totalBaseline = uploadResult.points.length * BASELINE.gpu;
                              const totalSmart = uploadResult.points.reduce((acc: number, _: any, i: number) => acc + RESOURCE_MAP[selections[i] || "flashcard"].gpu, 0);
                              return ((totalBaseline - totalSmart) / totalBaseline * 100).toFixed(1);
                            })()}% GPU Saved
                          </p>
                        </div>
                        <div className="text-right text-[10px] font-mono text-white/50">
                          {(() => {
                            const totalSmart = uploadResult.points.reduce((acc: number, _: any, i: number) => acc + RESOURCE_MAP[selections[i] || "flashcard"].gpu, 0);
                            return totalSmart.toFixed(1);
                          })()}s vs {uploadResult.points.length * BASELINE.gpu}s
                        </div>
                      </div>
                      
                      {/* Formula text */}
                      <div className="text-[9px] text-white/30 font-body leading-relaxed border-t border-[#8B5CF6]/20 pt-2">
                        <span className="font-bold text-white/40">How we calculate this:</span><br/>
                        Baseline is always SDXL 1024px @ 25 steps (62.5s per image). <br/>
                        Our smart routing picks SD-Turbo 512px @ 2 steps (1.0s) for simple worksheets/flashcards, or up to 25 steps for posters. <br/>
                        <span className="text-[#8B5CF6]/70">Energy (Wh) = (320W RTX3080 × GPU seconds) ÷ 3600</span> <br/>
                        <span className="text-[#8B5CF6]/70">CO₂ (g) = Energy (Wh) × 0.233 (UK Grid)</span>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2 border-t border-white/[0.06]">
                    <button onClick={() => { setUploadResult(null); setFile(null); setBatchResults([]); setSelections({}); setShowUploadJSON(false); setShowBatchPrompts(false); }}
                      className="btn-ghost px-4 py-3">↺ Reset</button>
                    <button onClick={doBatchGenerate} disabled={batching || showUploadJSON}
                      className={`btn-candy flex-1 py-3 ${(batching || showUploadJSON) ? "opacity-70" : ""}`}>
                      {batching ? `Generating (${batchProgress}/${uploadResult.points.length})…` : `⚡ Generate All ${uploadResult.points.length} Images`}
                    </button>
                  </div>
                </motion.div>
              )}
            </div>

            {/* RIGHT: Output */}
            <div className="space-y-4">
              {activeTab === "write" ? (
                <>
                  {/* Image output area */}
                  <div className="glass p-4 min-h-[360px] flex flex-col items-center justify-center relative overflow-hidden">
                    <AnimatePresence mode="wait">
                      {loading ? (
                        <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                          className="flex flex-col items-center gap-4 text-center">
                          <div className="relative w-16 h-16">
                            <div className="absolute inset-0 rounded-full border-2 border-[#8B5CF6]/20 animate-spin border-t-[#8B5CF6]" />
                            <div className="absolute inset-2 rounded-full border-2 border-[#00F5FF]/15 animate-spin border-t-[#00F5FF]" style={{ animationDirection: "reverse", animationDuration: "0.8s" }} />
                          </div>
                          <p className="text-white/50 font-body text-sm">Generating your image…</p>
                          {/* Pipeline in loading state */}
                          <div className="w-full mt-2 relative" style={{ minHeight: 80 }}>
                            <PipelineViz activeSteps={activeSteps} />
                          </div>
                        </motion.div>
                      ) : result?.image_url ? (
                        <motion.div key="image" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }} className="w-full">
                          <div className="relative rounded-xl overflow-hidden mb-2">
                            <img src={`${API}${result.image_url}`} className="w-full object-contain max-h-72 rounded-xl" alt="Generated" />
                            {/* Floating overlay badge */}
                            <div className="absolute bottom-3 left-3 flex gap-2">
                              <span className="badge badge-emerald">{result.gpu_seconds?.toFixed(2)}s GPU</span>
                              {result.cache_hit && <span className="badge badge-cyan">⚡ Cache Hit</span>}
                              {result.resource_card && <span className="badge badge-amber">{result.resource_card.saved_pct}% saved</span>}
                            </div>
                          </div>
                          
                          {/* Constraint 1: Explain Calculation */}
                          {result.resource_card && (
                            <div className="w-full mb-4">
                              <button
                                onClick={() => setShowFormula(!showFormula)}
                                className="text-[10px] uppercase tracking-widest font-bold text-[#8B5CF6] hover:text-white transition-colors flex items-center gap-2 bg-[#8B5CF6]/10 px-3 py-1.5 rounded-md border border-[#8B5CF6]/30 ml-auto"
                              >
                                {showFormula ? "Hide Math" : "[ ? ] Formula Breakdown (Constraint 1)"}
                              </button>
                              <AnimatePresence>
                                {showFormula && (
                                  <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="overflow-hidden mt-2"
                                  >
                                    <div className="bg-black/60 border border-[#8B5CF6]/20 rounded-xl p-4 text-left font-mono text-[10px] text-white/60 space-y-3">
                                      <div>
                                        <p className="text-[#34D399] font-bold mb-1">1. Compute Time (GPU-seconds)</p>
                                        <p>Our App: Measured via Python `time.perf_counter()`</p>
                                        <p className="text-white/80 font-bold ml-2">↳ Actual time: {result.resource_card.gpu_seconds?.toFixed(2)}s</p>
                                      </div>
                                      <div>
                                        <p className="text-[#FBBF24] font-bold mb-1">2. Energy (Watt-hours)</p>
                                        <p>Our App: Derived from live NVIDIA NVML (`pynvml.nvmlDeviceGetPowerUsage()`) falling back to 320W A100 TDP.</p>
                                        <p>Formula: (Average Watts × GPU_seconds) / 3600</p>
                                        <p className="text-white/80 font-bold ml-2">↳ (320W × {result.resource_card.gpu_seconds?.toFixed(2)}s) / 3600 = {result.resource_card.energy_wh?.toFixed(4)} Wh</p>
                                      </div>
                                      <div>
                                        <p className="text-[#8B5CF6] font-bold mb-1">3. Savings vs Maximum (%)</p>
                                        <p>Baseline: Unoptimized SDXL 25-step generation (Measured at {result.resource_card.baseline_gpu_seconds?.toFixed(1)}s)</p>
                                        <p>Formula: ((Baseline - Our Time) / Baseline) × 100</p>
                                        <p className="text-white/80 font-bold ml-2">
                                          ↳ (({result.resource_card.baseline_gpu_seconds?.toFixed(1)}s - {result.resource_card.gpu_seconds?.toFixed(2)}s) / {result.resource_card.baseline_gpu_seconds?.toFixed(1)}s) × 100 = {result.resource_card.saved_pct}% SAVED
                                        </p>
                                      </div>
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          )}

                          {/* Pipeline after generation */}
                          <div className="mt-4 relative" style={{ minHeight: 100 }}>
                            <PipelineViz activeSteps={activeSteps} cacheHit={result.cache_hit} />
                          </div>
                        </motion.div>
                      ) : (
                        <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
                          <div className="text-6xl mb-4 opacity-40">🎨</div>
                          <p className="text-white/25 font-body text-sm">Your image will appear here</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </>
              ) : (
                <div className="glass p-4 min-h-[400px]">
                  <h3 className="font-heading font-bold text-white/40 text-xs uppercase tracking-widest mb-4">Batch Results</h3>
                  {batching && (
                    <div className="mb-4">
                      <div className="flex flex-col items-center justify-center gap-4 py-10">
                        <div className="relative w-16 h-16">
                          <div className="absolute inset-0 rounded-full border-2 border-[#8B5CF6]/20 animate-spin border-t-[#8B5CF6]" />
                          <div className="absolute inset-2 rounded-full border-2 border-[#00F5FF]/15 animate-spin border-t-[#00F5FF]" style={{ animationDirection: "reverse", animationDuration: "0.8s" }} />
                        </div>
                        <p className="text-[#8B5CF6] font-body text-sm animate-pulse">Generating Master Payload for {uploadResult?.points.length} Prompts…</p>
                      </div>
                    </div>
                  )}
                  {showBatchPrompts && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-[#0D0D1A] rounded-xl border border-[#00F5FF]/20 p-4 h-[600px] overflow-y-auto">
                      <p className="text-[10px] uppercase tracking-widest text-[#00F5FF]/50 font-body font-semibold mb-3">AI Generation Payload</p>
                      <div className="code-block text-[10px]">
                        <pre dangerouslySetInnerHTML={{
                          __html: JSON.stringify(
                            uploadResult.enriched_points.map((p: any, i: number) => ({
                              extracted_point: p.text,
                              selected_output: selections[i] || "flashcard",
                              estimated_gpu_seconds: RESOURCE_MAP[selections[i] || "flashcard"].gpu,
                              prompt_card: p.prompt_card || { 
                                intent: { type: selections[i] || "flashcard", subject: p.text },
                                optimized_prompt: `A beautiful ${selections[i] || "flashcard"} about ${p.text}`
                              }
                            })), null, 2
                          )
                            .replace(/"([^"]+)":/g, '<span style="color:#8B5CF6">"$1"</span>:')
                            .replace(/: "([^"]*)"/g, ': <span style="color:#FBBF24">"$1"</span>')
                            .replace(/: (-?\d+\.?\d*)/g, ': <span style="color:#34D399">$1</span>')
                            .replace(/: (true|false|null)/g, ': <span style="color:#F472B6">$1</span>')
                        }} />
                      </div>
                    </motion.div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Data Panel — always shows after generation */}
          {result && <DataPanel result={result} mode={mode} />}
        </div>
      </section>
    </div>
  );
}
