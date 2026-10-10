"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { SectionReveal } from "../../components/SectionReveal";
import { FloatingShape } from "../../components/FloatingShape";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const PALETTE = ["#8B5CF6", "#00F5FF", "#FBBF24", "#34D399", "#F472B6"];

// ── Count-up hook ────────────────────────────────────────────────────────────
function useCountUp(target: number, duration = 1200) {
  const [v, setV] = useState(0);
  const ref = useRef<number>(0);
  const startRef = useRef<number | null>(null);
  useEffect(() => {
    if (!target) return;
    startRef.current = null;
    const anim = (ts: number) => {
      if (!startRef.current) startRef.current = ts;
      const p = Math.min((ts - startRef.current) / duration, 1);
      setV((1 - Math.pow(1 - p, 4)) * target);
      if (p < 1) ref.current = requestAnimationFrame(anim);
    };
    ref.current = requestAnimationFrame(anim);
    return () => cancelAnimationFrame(ref.current);
  }, [target, duration]);
  return v;
}

// ── Stat card ────────────────────────────────────────────────────────────────
function HeroStat({ value, decimals = 0, suffix = "", prefix = "", label, sublabel, color }: {
  value: number; decimals?: number; suffix?: string; prefix?: string;
  label: string; sublabel?: string; color: string;
}) {
  const count = useCountUp(value);
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
      className="metric-card text-center"
      style={{ borderColor: `${color}20`, boxShadow: `4px 4px 0px ${color}25` }}
    >
      <div className="metric-value" style={{ color }}>
        {prefix}{count.toFixed(decimals)}{suffix}
      </div>
      <p className="font-heading font-semibold text-white/65 text-sm mt-2">{label}</p>
      {sublabel && <p className="text-xs text-white/30 font-body mt-0.5">{sublabel}</p>}
    </motion.div>
  );
}

// ── Custom Tooltip ────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#111120] border border-white/10 rounded-xl px-4 py-3 shadow-xl">
      <p className="text-xs text-white/40 font-body mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-sm font-heading font-bold" style={{ color: p.color }}>
          {p.name}: {typeof p.value === "number" ? p.value.toFixed(2) : p.value}
        </p>
      ))}
    </div>
  );
};

// ── Live Request Feed ─────────────────────────────────────────────────────────
function RequestFeed({ requests }: { requests: any[] }) {
  if (!requests?.length) return (
    <div className="text-center py-8 text-white/25 font-body text-sm">No requests yet</div>
  );
  const typeColors: Record<string, string> = {
    outline: "#34D399", flashcard: "#8B5CF6", poster: "#FBBF24", worksheet: "#F472B6",
  };
  return (
    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
      {requests.slice(-10).reverse().map((r: any, i: number) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.03 }}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[#0D0D1A] border border-white/[0.05]"
        >
          <span className="badge" style={{
            color: typeColors[r.intent_type] || "#8B5CF6",
            borderColor: `${typeColors[r.intent_type] || "#8B5CF6"}40`,
            backgroundColor: `${typeColors[r.intent_type] || "#8B5CF6"}12`,
          }}>
            {r.intent_type || "—"}
          </span>
          <span className="text-xs text-white/45 font-body flex-1 truncate">{r.school_id || "—"}</span>
          {r.cache_hit ? (
            <span className="badge badge-cyan">⚡ cached</span>
          ) : (
            <span className="text-xs font-mono text-[#34D399]">{r.gpu_seconds?.toFixed(1)}s</span>
          )}
          <span className="text-xs text-white/20 font-body">{r.saved_pct ? `${r.saved_pct}% saved` : ""}</span>
        </motion.div>
      ))}
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [requests, setRequests] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const [sRes, rRes] = await Promise.all([
        fetch(`${API}/api/stats`),
        fetch(`${API}/api/requests?limit=50`),
      ]);
      setStats(await sRes.json());
      if (rRes.ok) setRequests(await rRes.json());
    } catch {}
  }, []);

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 10_000);
    return () => clearInterval(iv);
  }, [fetchData]);

  // Derived chart data
  const gpuTimeline = stats?.recent_requests?.map((r: any, i: number) => ({
    idx: i + 1,
    smart: r.gpu_seconds,
    baseline: 62.5,
  })) || [];

  const byType = stats?.by_type
    ? Object.entries(stats.by_type).map(([name, value]) => ({ name, value }))
    : [];

  const bySchool = stats?.by_school
    ? Object.entries(stats.by_school).map(([school, data]: any) => ({
        school: school.replace("Springfield ", "SF ").replace("Shelbyville ", "SB ").replace("Ogdenville ", "OG "),
        used: data.total_gpu_seconds,
        saved: data.saved_gpu_seconds,
      }))
    : [];

  const totalRequests = stats?.total_requests || 0;
  const gpuSaved = stats?.total_gpu_seconds_saved || 0;
  const cacheRate = (stats?.cache_hit_rate || 0) * 100;
  const co2Saved = gpuSaved * (320 / 3600) * 0.233; // from profiles.py formula

  return (
    <div className="min-h-screen relative">
      <FloatingShape shape="ring"   color="#8B5CF6" size={400} top="-80px"  right="-100px" opacity={0.05} animate={false} />
      <FloatingShape shape="circle" color="#FBBF24" size={160} bottom="20%" left="2%"     opacity={0.04} delay={2} />

      <div className="max-w-7xl mx-auto px-6 py-12 space-y-10">
        {/* Header */}
        <SectionReveal>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <span className="badge badge-violet mb-3">Live Analytics</span>
              <h1 className="text-display">
                Analytics <span className="text-[#8B5CF6]">Dashboard</span>
              </h1>
              <p className="text-white/45 font-body text-[16px] mt-2">
                Real-time GPU savings, cache performance, and school-level impact.
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm text-white/35 font-body">
              <span className="w-2 h-2 rounded-full bg-[#34D399] pulse-emerald" />
              Auto-refreshes every 10s
            </div>
          </div>
        </SectionReveal>

        {/* Hero Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <HeroStat value={totalRequests}  label="Total Requests"   sublabel="across all schools" color="#8B5CF6" />
          <HeroStat value={gpuSaved}       label="GPU-s Saved"      sublabel="vs always-SDXL" suffix="s" decimals={1} color="#34D399" />
          <HeroStat value={cacheRate}      label="Cache Hit Rate"   sublabel="0 GPU on cache" suffix="%" decimals={1} color="#FBBF24" />
          <HeroStat value={co2Saved}       label="CO₂ Saved"        sublabel="RTX 3080 · UK grid" suffix="g" decimals={2} color="#F472B6" />
        </div>

        {/* Impact callout */}
        {gpuSaved > 0 && (
          <SectionReveal>
            <div className="p-6 rounded-2xl border-2 border-[#34D399]/25 bg-[#34D399]/06"
              style={{ boxShadow: "4px 4px 0px rgba(52,211,153,0.2)" }}>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <span className="text-4xl">🌱</span>
                <div>
                  <h3 className="font-heading font-bold text-[#34D399] text-lg">
                    Your Impact: {co2Saved.toFixed(2)}g CO₂ Saved
                  </h3>
                  <p className="text-white/50 font-body text-sm mt-1">
                    That's equivalent to inflating ~{(co2Saved / 0.14).toFixed(0)} balloons with air.
                    Every image generated through PurposeCanvas instead of SDXL-25 saves compute and carbon.
                  </p>
                </div>
              </div>
            </div>
          </SectionReveal>
        )}

        {/* Charts grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* GPU timeline */}
          <SectionReveal>
            <div className="glass p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-heading font-bold text-white text-base">GPU-s Per Request</h2>
                <div className="flex gap-3 text-xs font-body">
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-[#8B5CF6]" />Smart</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-500/40" />Baseline</span>
                </div>
              </div>
              {gpuTimeline.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={gpuTimeline}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="idx" tick={{ fontSize: 10, fill: "#64748B" }} />
                    <YAxis tick={{ fontSize: 10, fill: "#64748B" }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="baseline" stroke="rgba(239,68,68,0.3)" strokeWidth={1.5} dot={false} strokeDasharray="4 4" name="Baseline" />
                    <Line type="monotone" dataKey="smart" stroke="#8B5CF6" strokeWidth={2.5} dot={{ fill: "#8B5CF6", r: 3 }} name="Smart" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-48 flex items-center justify-center text-white/20 text-sm font-body">Generate some images to see data</div>
              )}
            </div>
          </SectionReveal>

          {/* By type donut */}
          <SectionReveal delay={0.1}>
            <div className="glass p-6 space-y-4">
              <h2 className="font-heading font-bold text-white text-base">Requests by Type</h2>
              {byType.length > 0 ? (
                <div className="flex items-center gap-6">
                  <ResponsiveContainer width="50%" height={200}>
                    <PieChart>
                      <Pie data={byType} dataKey="value" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3}>
                        {byType.map((_: any, i: number) => (
                          <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2">
                    {byType.map((item: any, i: number) => (
                      <div key={item.name} className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: PALETTE[i % PALETTE.length] }} />
                        <span className="text-xs font-body text-white/60 capitalize">{item.name}</span>
                        <span className="text-xs font-heading font-bold text-white ml-1">{item.value as number}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-48 flex items-center justify-center text-white/20 text-sm font-body">No data yet</div>
              )}
            </div>
          </SectionReveal>

          {/* By school bar chart */}
          <SectionReveal delay={0.15}>
            <div className="glass p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-heading font-bold text-white text-base">Per-School GPU Usage</h2>
                <div className="flex gap-3 text-xs font-body">
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-[#8B5CF6]" />Used</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-[#34D399]" />Saved</span>
                </div>
              </div>
              {bySchool.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={bySchool} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="school" tick={{ fontSize: 10, fill: "#64748B" }} />
                    <YAxis tick={{ fontSize: 10, fill: "#64748B" }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="used" fill="#8B5CF6" radius={[4, 4, 0, 0]} name="GPU used (s)" />
                    <Bar dataKey="saved" fill="#34D399" radius={[4, 4, 0, 0]} name="GPU saved (s)" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-48 flex items-center justify-center text-white/20 text-sm font-body">No school data yet</div>
              )}
            </div>
          </SectionReveal>

          {/* Live request feed */}
          <SectionReveal delay={0.2}>
            <div className="glass p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-heading font-bold text-white text-base">Live Request Feed</h2>
                <span className="w-1.5 h-1.5 rounded-full bg-[#34D399] pulse-emerald" />
              </div>
              <RequestFeed requests={stats?.recent_requests || requests} />
            </div>
          </SectionReveal>
        </div>

        {/* Calculation note */}
        <SectionReveal delay={0.25}>
          <div className="p-4 rounded-xl border border-white/[0.05] bg-[#0D0D1A]">
            <p className="text-[11px] text-white/30 font-body leading-relaxed">
              🔬 <strong className="text-white/45">Calculation methodology:</strong> GPU = NVIDIA RTX 3080 @ 320W TDP.
              SD-Turbo 512px: 0.5s/step · SD-Turbo 768px: 1.0s/step · SDXL 1024px: 2.5s/step.
              Energy (Wh) = (320W × GPU-s) ÷ 3600. CO₂ (g) = Energy × 0.233 (UK grid average: 233g CO₂/kWh).
              Baseline MAX = SDXL 1024px 25 steps = 62.5s = 5.556Wh = 1.294g CO₂.
            </p>
          </div>
        </SectionReveal>
      </div>
    </div>
  );
}
