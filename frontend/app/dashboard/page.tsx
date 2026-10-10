"use client";
import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const COLORS = ["#00f5ff", "#7c3aed", "#10b981", "#f59e0b", "#ef4444"];

function StatCard({ label, value, sub, color = "#00f5ff" }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass p-5"
    >
      <p className="text-xs text-white/40 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-3xl font-black" style={{ color }}>{value}</p>
      {sub && <p className="text-xs text-white/30 mt-1">{sub}</p>}
    </motion.div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/stats`);
      setStats(await res.json());
    } catch { /* backend not ready */ }
  }, []);

  useEffect(() => {
    fetchStats();
    const iv = setInterval(fetchStats, 10_000);
    return () => clearInterval(iv);
  }, [fetchStats]);

  if (!stats) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">📊</div>
          <p className="text-white/40">Loading dashboard...</p>
          <p className="text-xs text-white/20 mt-2">Waiting for backend on port 8000</p>
        </div>
      </div>
    );
  }

  const totals = stats.totals as Record<string, number>;
  const savings = stats.savings as Record<string, number>;
  const perSchool = (stats.per_school as unknown[]) ?? [];
  const perType = (stats.per_type as unknown[]) ?? [];
  const recent = (stats.recent as unknown[]) ?? [];

  // Time-series chart data
  const timeData = [...recent].reverse().map((r: unknown, i: number) => {
    const row = r as Record<string, unknown>;
    return {
      i,
      gpu_s: Number(row.gpu_seconds ?? 0).toFixed(2),
      cache: row.cache_hit ? 1 : 0,
    };
  });

  // Per-school bar data
  const schoolData = (perSchool as Array<Record<string, unknown>>).map((s) => ({
    name: String(s.school_name ?? "").split(" ")[0],
    saved: Number(s.saved_gpu_seconds ?? 0).toFixed(1),
    used: Number(s.gpu_seconds ?? 0).toFixed(1),
  }));

  // Per-type donut
  const typeData = (perType as Array<Record<string, unknown>>).map((t) => ({
    name: String(t.type ?? ""),
    value: Number(t.count ?? 0),
  }));

  return (
    <div className="min-h-screen p-6 max-w-7xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black tracking-tight">
            <span className="text-[#00f5ff]">Analytics</span> Dashboard
          </h1>
          <p className="text-white/50 mt-1">Live savings across 300 schools. Auto-refreshes every 10 seconds.</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-white/40">
          <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
          Live
        </div>
      </motion.div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <StatCard label="Total Requests" value={String(totals.requests ?? 0)} />
        <StatCard label="GPU-s Used" value={`${Number(totals.gpu_seconds ?? 0).toFixed(1)}s`} color="#f59e0b" />
        <StatCard label="GPU-s Saved" value={`${Number(savings.gpu_seconds_saved ?? 0).toFixed(1)}s`} color="#10b981" sub="vs baseline" />
        <StatCard label="Energy Saved" value={`${Number(totals.energy_wh ?? 0).toFixed(2)} Wh`} color="#10b981" />
        <StatCard label="Cost Saved*" value={`$${Number(savings.cost_saved_usd ?? 0).toFixed(3)}`} color="#10b981" sub="assumed cloud rate" />
        <StatCard label="Cache Hit Rate" value={`${(Number(totals.cache_hit_rate ?? 0) * 100).toFixed(1)}%`} color="#00f5ff" />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* Time series */}
        <div className="glass p-4 lg:col-span-2">
          <p className="text-xs text-white/40 uppercase tracking-widest mb-4">GPU-seconds per request (recent 50)</p>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={timeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="i" hide />
              <YAxis stroke="rgba(255,255,255,0.2)" tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }} />
              <Tooltip
                contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
                labelStyle={{ color: "rgba(255,255,255,0.5)" }}
              />
              <Line type="monotone" dataKey="gpu_s" stroke="#00f5ff" strokeWidth={2} dot={false} name="GPU-s" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Donut */}
        <div className="glass p-4">
          <p className="text-xs text-white/40 uppercase tracking-widest mb-4">Requests by type</p>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={typeData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value" nameKey="name">
                {typeData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
              />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Per-school bar chart */}
      <div className="glass p-4">
        <p className="text-xs text-white/40 uppercase tracking-widest mb-4">Per-school GPU-seconds (saved vs used)</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={schoolData} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }} />
            <YAxis stroke="rgba(255,255,255,0.2)" tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }} />
            <Tooltip
              contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
            />
            <Bar dataKey="used" name="GPU-s used" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            <Bar dataKey="saved" name="GPU-s saved" fill="#10b981" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <p className="text-[10px] text-white/20 mt-4 text-center">
        *Cost labelled "assumed cloud rate" ($0.0004/GPU-s). GPU-seconds and Wh are real hardware measurements.
      </p>
    </div>
  );
}
