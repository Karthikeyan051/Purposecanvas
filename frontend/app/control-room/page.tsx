"use client";
import dynamic from "next/dynamic";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

// Load 3D scene client-side only (no SSR)
const ControlRoomScene = dynamic(() => import("@/components/ControlRoomScene"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[600px] text-white/30">
      <div className="text-center">
        <div className="text-4xl mb-3 animate-pulse">🏢</div>
        <p>Loading 3D Control Room...</p>
      </div>
    </div>
  ),
});

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";

export type WSEvent = {
  event: string;
  request_id?: string;
  gpu_seconds?: number;
  similarity?: number;
  tier?: string;
  from_tier?: number;
  to_tier?: number;
  image_url?: string;
  completed?: number;
  total?: number;
  ts?: number;
};

export default function ControlRoomPage() {
  const [events, setEvents] = useState<WSEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [totalSaved, setTotalSaved] = useState(0);
  const [cacheHits, setCacheHits] = useState(0);
  const [requests, setRequests] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const lastEventRef = useRef<WSEvent | null>(null);

  useEffect(() => {
    const connect = () => {
      const ws = new WebSocket(`${WS_URL}/ws/events`);
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        setTimeout(connect, 3000); // auto-reconnect
      };

      ws.onmessage = (e) => {
        const data: WSEvent = JSON.parse(e.data);
        lastEventRef.current = data;
        setEvents((prev) => [data, ...prev].slice(0, 30));

        if (data.event === "complete") {
          setRequests((r) => r + 1);
          if (data.gpu_seconds != null) {
            const saved = Math.max(0, 22 - data.gpu_seconds);
            setTotalSaved((s) => s + saved);
          }
        }
        if (data.event === "cache_hit") {
          setCacheHits((c) => c + 1);
          setRequests((r) => r + 1);
          setTotalSaved((s) => s + 22); // full baseline saved
        }
      };
    };

    connect();
    return () => wsRef.current?.close();
  }, []);

  // Demo traffic — fires synthetic events
  const fireDemoTraffic = () => {
    const synthetic: WSEvent[] = [
      { event: "request_received", request_id: "demo-1", ts: Date.now() },
      { event: "generating_start", request_id: "demo-1", tier: "sd_turbo" },
      { event: "generating_end", request_id: "demo-1", gpu_seconds: 1.8 },
      { event: "complete", request_id: "demo-1", gpu_seconds: 1.8 },
      { event: "request_received", request_id: "demo-2", ts: Date.now() },
      { event: "cache_hit", request_id: "demo-2", similarity: 0.94 },
      { event: "request_received", request_id: "demo-3", ts: Date.now() },
      { event: "generating_start", request_id: "demo-3", tier: "sdxl" },
      { event: "generating_end", request_id: "demo-3", gpu_seconds: 22.1 },
      { event: "complete", request_id: "demo-3", gpu_seconds: 22.1 },
      { event: "request_received", request_id: "demo-4", ts: Date.now() },
      { event: "generating_start", request_id: "demo-4", tier: "sd_turbo" },
      { event: "escalated", request_id: "demo-4", from_tier: 0, to_tier: 1 },
      { event: "generating_end", request_id: "demo-4", gpu_seconds: 3.2 },
      { event: "complete", request_id: "demo-4", gpu_seconds: 3.2 },
    ];

    synthetic.forEach((evt, i) => {
      setTimeout(() => {
        setEvents((prev) => [evt, ...prev].slice(0, 30));
        if (evt.event === "complete" && evt.gpu_seconds != null) {
          setRequests((r) => r + 1);
          setTotalSaved((s) => s + Math.max(0, 22 - evt.gpu_seconds!));
        }
        if (evt.event === "cache_hit") {
          setCacheHits((c) => c + 1);
          setRequests((r) => r + 1);
          setTotalSaved((s) => s + 22);
        }
      }, i * 600);
    });
  };

  const lastEvent = events[0];

  return (
    <div className="min-h-screen p-6 max-w-7xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black tracking-tight">
            3D <span className="text-[#00f5ff]">Control Room</span>
          </h1>
          <p className="text-white/50 mt-1">Live visualization of every image request being routed through the pipeline.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 text-sm ${connected ? "text-[#10b981]" : "text-red-400"}`}>
            <span className={`w-2 h-2 rounded-full ${connected ? "bg-[#10b981] animate-pulse" : "bg-red-400"}`} />
            {connected ? "Live" : "Disconnected"}
          </div>
          <button
            id="demo-traffic-btn"
            onClick={fireDemoTraffic}
            className="px-4 py-2 rounded-lg border border-[#00f5ff]/30 text-[#00f5ff] text-sm hover:bg-[#00f5ff]/10 transition-all"
          >
            ▶ Demo Traffic
          </button>
        </div>
      </motion.div>

      {/* Live counters */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: "Total Requests", value: requests, color: "#00f5ff" },
          { label: "Cache Hits", value: cacheHits, color: "#10b981" },
          { label: "GPU-s Saved", value: `${totalSaved.toFixed(1)}s`, color: "#10b981" },
        ].map((s) => (
          <motion.div key={s.label} className="glass p-3 text-center">
            <motion.p
              key={s.value}
              initial={{ scale: 1.3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-2xl font-black"
              style={{ color: s.color }}
            >
              {s.value}
            </motion.p>
            <p className="text-xs text-white/40">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* 3D Scene */}
      <div className="glass p-2 mb-4 rounded-2xl overflow-hidden" style={{ height: 520 }}>
        <ControlRoomScene lastEvent={lastEvent ?? null} />
      </div>

      {/* Event log */}
      <div className="glass p-4">
        <p className="text-xs text-white/40 uppercase tracking-widest mb-3">Live Event Log</p>
        <div className="space-y-1 max-h-40 overflow-y-auto">
          <AnimatePresence initial={false}>
            {events.map((e, i) => (
              <motion.div
                key={`${e.event}-${e.request_id}-${i}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-3 text-xs py-1 border-b border-white/5"
              >
                <span className={`font-mono w-2 h-2 rounded-full flex-shrink-0 ${
                  e.event === "cache_hit" ? "bg-[#10b981]" :
                  e.event === "escalated" ? "bg-[#7c3aed]" :
                  e.event === "complete" ? "bg-[#00f5ff]" :
                  "bg-white/20"
                }`} />
                <span className="text-white/60 font-mono">{e.event}</span>
                {e.request_id && <span className="text-white/30 font-mono">{e.request_id.slice(0, 8)}</span>}
                {e.gpu_seconds != null && <span className="text-[#f59e0b]">{e.gpu_seconds.toFixed(2)}s</span>}
                {e.similarity != null && <span className="text-[#10b981]">sim={e.similarity.toFixed(2)}</span>}
                {e.tier && <span className="text-white/40">{e.tier}</span>}
              </motion.div>
            ))}
          </AnimatePresence>
          {events.length === 0 && (
            <p className="text-white/20 text-xs py-2">No events yet. Generate an image in Studio or click Demo Traffic.</p>
          )}
        </div>
      </div>
    </div>
  );
}
