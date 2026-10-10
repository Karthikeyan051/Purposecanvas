"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function Footer() {
  const [stats, setStats] = useState<{ total_requests: number; total_gpu_seconds_saved: number; cache_hit_rate: number } | null>(null);

  useEffect(() => {
    fetch(`${API}/api/stats`)
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  return (
    <footer className="relative border-t border-white/[0.06] bg-[#0A0A14] mt-24">
      {/* Geometric decoration */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-1 rounded-full bg-gradient-to-r from-transparent via-[#8B5CF6] to-transparent" />

      <div className="max-w-6xl mx-auto px-6 py-14">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <div
                className="w-8 h-8 rounded-[9px] flex items-center justify-center"
                style={{ background: "#8B5CF6", boxShadow: "3px 3px 0px 0px rgba(139,92,246,0.35)" }}
              >
                <span className="text-white font-black text-xs font-heading">PC</span>
              </div>
              <span className="font-heading font-bold text-sm">
                Purpose<span className="text-[#8B5CF6]">Canvas</span>
              </span>
            </div>
            <p className="text-sm text-white/40 leading-relaxed max-w-[240px]">
              Purpose-aware AI image generation for schools. Right model. Right quality. Minimum compute.
            </p>
            <div className="mt-4 flex gap-2">
              <span className="badge badge-violet">Education AI</span>
              <span className="badge badge-emerald">Sustainable</span>
            </div>
          </div>

          {/* Navigation */}
          <div>
            <p className="text-[11px] uppercase tracking-widest text-white/30 font-body font-semibold mb-4">Navigate</p>
            <ul className="space-y-2">
              {[
                { href: "/", label: "Studio" },
                { href: "/dashboard", label: "Analytics Dashboard" },
                { href: "/benchmark", label: "Benchmark" },
                { href: "/control-room", label: "3D Control Room" },
              ].map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-white/50 hover:text-[#8B5CF6] transition-colors duration-150 font-body">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Live stats */}
          <div>
            <p className="text-[11px] uppercase tracking-widest text-white/30 font-body font-semibold mb-4">Live Savings</p>
            {stats ? (
              <div className="space-y-3">
                <div className="metric-card p-3">
                  <p className="text-[10px] text-white/40 uppercase tracking-widest font-body">GPU-seconds Saved</p>
                  <p className="text-2xl font-heading font-bold text-[#34D399] mt-0.5">
                    {(stats?.total_gpu_seconds_saved ?? 0).toFixed(1)}s
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="metric-card p-3">
                    <p className="text-[10px] text-white/40 font-body">Requests</p>
                    <p className="text-lg font-heading font-bold text-[#8B5CF6]">{stats?.total_requests ?? 0}</p>
                  </div>
                  <div className="metric-card p-3">
                    <p className="text-[10px] text-white/40 font-body">Cache Rate</p>
                    <p className="text-lg font-heading font-bold text-[#FBBF24]">{(stats.cache_hit_rate * 100).toFixed(0)}%</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3 animate-pulse">
                <div className="h-14 rounded-xl bg-white/5" />
                <div className="grid grid-cols-2 gap-2">
                  <div className="h-12 rounded-xl bg-white/5" />
                  <div className="h-12 rounded-xl bg-white/5" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-6 border-t border-white/[0.05] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <p className="text-xs text-white/25 font-body">
            🔬 Calculation: RTX 3080 @ 320W · Baseline = SDXL 25-step 1024px = 62.5s = 5.56Wh = 1.29g CO₂ · UK grid: 233g CO₂/kWh
          </p>
          <p className="text-xs text-white/20 font-body">PurposeCanvas · Hackathon Demo</p>
        </div>
      </div>
    </footer>
  );
}
