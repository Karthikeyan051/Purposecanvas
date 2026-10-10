"use client";
import dynamic from "next/dynamic";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FloatingShape } from "../../components/FloatingShape";

const ControlRoomScene = dynamic(() => import("@/components/ControlRoomScene"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <div className="relative w-16 h-16 mx-auto mb-4">
          <div className="absolute inset-0 rounded-full border-2 border-[#8B5CF6]/20 animate-spin border-t-[#8B5CF6]" />
          <div className="absolute inset-2 rounded-full border-2 border-[#00F5FF]/15 animate-spin border-t-[#00F5FF]" style={{ animationDirection: "reverse", animationDuration: "0.8s" }} />
        </div>
        <p className="text-white/40 font-body text-sm">Loading 3D Control Room…</p>
      </div>
    </div>
  ),
});

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";

export type WSEvent = {
  event: string; request_id?: string; gpu_seconds?: number;
  similarity?: number; tier?: string; from_tier?: number; to_tier?: number;
  image_url?: string; completed?: number; total?: number; ts?: number;
};

const EVENT_CONFIG: Record<string, { color: string; icon: string; label: string }> = {
  request_received: { color: "#8B5CF6", icon: "📨", label: "Request In" },
  generating_start: { color: "#FBBF24", icon: "🖼", label: "Generating" },
  cache_hit:        { color: "#34D399", icon: "⚡", label: "Cache Hit" },
  escalated:        { color: "#F472B6", icon: "⬆", label: "Escalated" },
  generating_end:   { color: "#00F5FF", icon: "✓", label: "Gen Done" },
  complete:         { color: "#34D399", icon: "✅", label: "Complete" },
  benchmark_progress:{ color: "#8B5CF6", icon: "📊", label: "Benchmark" },
};

export default function ControlRoomPage() {
  const [events, setEvents] = useState<WSEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [totalSaved, setTotalSaved] = useState(0);
  const [cacheHits, setCacheHits] = useState(0);
  const [requests, setRequests] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const connect = () => {
      const ws = new WebSocket(`${WS_URL}/ws/events`);
      wsRef.current = ws;
      ws.onopen = () => setConnected(true);
      ws.onclose = () => { setConnected(false); setTimeout(connect, 3000); };
      ws.onmessage = (e) => {
        const data: WSEvent = JSON.parse(e.data);
        setEvents((prev) => [data, ...prev].slice(0, 50));
        if (data.event === "complete") {
          setRequests((r) => r + 1);
          if (data.gpu_seconds != null) setTotalSaved((s) => s + Math.max(0, 62.5 - data.gpu_seconds!));
        }
        if (data.event === "cache_hit") {
          setCacheHits((c) => c + 1);
          setRequests((r) => r + 1);
          setTotalSaved((s) => s + 62.5);
        }
      };
    };
    connect();
    return () => wsRef.current?.close();
  }, []);

  const fireDemoTraffic = () => {
    const synthetic: WSEvent[] = [
      { event: "request_received", request_id: "demo-A", ts: Date.now() },
      { event: "generating_start", request_id: "demo-A", tier: "sd_turbo" },
      { event: "generating_end",   request_id: "demo-A", gpu_seconds: 1.8 },
      { event: "complete",         request_id: "demo-A", gpu_seconds: 1.8 },
      { event: "request_received", request_id: "demo-B", ts: Date.now() },
      { event: "cache_hit",        request_id: "demo-B", similarity: 0.96 },
      { event: "request_received", request_id: "demo-C", ts: Date.now() },
      { event: "generating_start", request_id: "demo-C", tier: "sdxl" },
      { event: "escalated",        request_id: "demo-C", from_tier: 0, to_tier: 1 },
      { event: "generating_end",   request_id: "demo-C", gpu_seconds: 14.5 },
      { event: "complete",         request_id: "demo-C", gpu_seconds: 14.5 },
      { event: "request_received", request_id: "demo-D", ts: Date.now() },
      { event: "generating_start", request_id: "demo-D", tier: "sd_turbo_hd" },
      { event: "generating_end",   request_id: "demo-D", gpu_seconds: 2.5 },
      { event: "complete",         request_id: "demo-D", gpu_seconds: 2.5 },
    ];
    synthetic.forEach((evt, i) => {
      setTimeout(() => {
        setEvents((prev) => [evt, ...prev].slice(0, 50));
        if (evt.event === "complete" && evt.gpu_seconds != null) {
          setRequests((r) => r + 1);
          setTotalSaved((s) => s + Math.max(0, 62.5 - evt.gpu_seconds!));
        }
        if (evt.event === "cache_hit") {
          setCacheHits((c) => c + 1);
          setRequests((r) => r + 1);
          setTotalSaved((s) => s + 62.5);
        }
      }, i * 600);
    });
  };

  const lastEvent = events[0];

  return (
    <div className="min-h-screen relative">
      <FloatingShape shape="ring"   color="#8B5CF6" size={350} top="-60px"   left="-80px"  opacity={0.05} animate={false} />
      <FloatingShape shape="circle" color="#00F5FF" size={200} bottom="10%"  right="-40px" opacity={0.04} delay={2} />

      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <span className="badge badge-cyan mb-3">3D Live View</span>
            <h1 className="text-display">
              3D <span className="text-[#00F5FF]">Control Room</span>
            </h1>
            <p className="text-white/45 font-body text-[16px] mt-2">
              Live visualization of every request being routed through the pipeline.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 text-sm font-body ${connected ? "text-[#34D399]" : "text-red-400"}`}>
              <span className={`w-2 h-2 rounded-full ${connected ? "bg-[#34D399] pulse-emerald" : "bg-red-400"}`} />
              {connected ? "Live" : "Reconnecting…"}
            </div>
            <button id="demo-traffic-btn" onClick={fireDemoTraffic}
              className="btn-candy text-sm px-5 py-2.5"
              style={{ boxShadow: "3px 3px 0px #00F5FF", background: "#0D0D2A", border: "1.5px solid #00F5FF30", color: "#00F5FF" }}>
              ▶ Demo Traffic
            </button>
          </div>
        </motion.div>

        {/* Live counters */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: "Total Requests", value: requests,               color: "#8B5CF6", suffix: "" },
            { label: "Cache Hits",     value: cacheHits,              color: "#34D399", suffix: "" },
            { label: "GPU-s Saved",    value: totalSaved,             color: "#FBBF24", suffix: "s", dec: 1 },
          ].map((s) => (
            <div key={s.label} className="metric-card text-center"
              style={{ borderColor: `${s.color}20`, boxShadow: `3px 3px 0px ${s.color}25` }}>
              <AnimatePresence mode="wait">
                <motion.p key={s.value} initial={{ scale: 1.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  className="metric-value" style={{ color: s.color }}>
                  {"dec" in s ? (s.value as number).toFixed(s.dec as number) : s.value}{s.suffix}
                </motion.p>
              </AnimatePresence>
              <p className="text-xs text-white/40 font-body mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Main layout: 3D canvas + event log */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
          {/* 3D Scene */}
          <div className="glass rounded-2xl overflow-hidden" style={{ height: 560 }}>
            <ControlRoomScene lastEvent={lastEvent ?? null} />
          </div>

          {/* Event log panel */}
          <div className="glass p-5 flex flex-col" style={{ maxHeight: 560 }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading font-bold text-white/60 text-xs uppercase tracking-widest">Live Events</h3>
              <div className="flex items-center gap-1.5 text-xs text-white/30 font-body">
                {events.length} events
              </div>
            </div>

            <div className="space-y-1.5 overflow-y-auto flex-1 pr-1">
              <AnimatePresence initial={false}>
                {events.map((e, i) => {
                  const cfg = EVENT_CONFIG[e.event] || { color: "#ffffff", icon: "●", label: e.event };
                  return (
                    <motion.div
                      key={`${e.event}-${e.request_id}-${i}`}
                      initial={{ opacity: 0, x: 12, scale: 0.96 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      exit={{ opacity: 0, x: -8 }}
                      transition={{ duration: 0.2 }}
                      className="flex items-start gap-2.5 px-3 py-2 rounded-xl text-xs"
                      style={{ background: `${cfg.color}08`, border: `1px solid ${cfg.color}18` }}
                    >
                      <span className="text-base mt-0.5 shrink-0">{cfg.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-heading font-bold text-[11px]" style={{ color: cfg.color }}>{cfg.label}</span>
                          {e.request_id && <span className="text-white/25 font-mono truncate">{e.request_id.slice(0, 8)}</span>}
                        </div>
                        <div className="flex flex-wrap gap-2 mt-0.5">
                          {e.gpu_seconds != null && <span className="text-[#FBBF24] font-mono">{e.gpu_seconds.toFixed(2)}s</span>}
                          {e.similarity  != null && <span className="text-[#34D399] font-mono">sim {e.similarity.toFixed(2)}</span>}
                          {e.tier        != null && <span className="text-white/35 font-mono">{e.tier}</span>}
                          {e.from_tier   != null && <span className="text-[#F472B6] font-mono">T{e.from_tier}→T{e.to_tier}</span>}
                          {e.completed   != null && <span className="text-[#8B5CF6] font-mono">{e.completed}/{e.total}</span>}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {events.length === 0 && (
                <div className="text-center py-8 text-white/20 text-sm font-body">
                  <div className="text-3xl mb-2 opacity-50">📡</div>
                  No events yet.<br />Generate an image or click Demo Traffic.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-6 glass p-4">
          <p className="text-[10px] uppercase tracking-widest text-white/30 font-body font-semibold mb-3">Event Legend</p>
          <div className="flex flex-wrap gap-3">
            {Object.entries(EVENT_CONFIG).map(([key, cfg]) => (
              <div key={key} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: cfg.color }} />
                <span className="text-xs font-body text-white/40">{cfg.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
