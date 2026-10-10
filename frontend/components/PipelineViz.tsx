"use client";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface PipelineStep {
  id: string;
  icon: string;
  label: string;
  sublabel: string;
}

const STEPS: PipelineStep[] = [
  { id: "intent",   icon: "🧠", label: "Intent + RAG",    sublabel: "Groq LLM classify" },
  { id: "cache",    icon: "⚡", label: "Vector Cache",     sublabel: "Cosine similarity" },
  { id: "profile",  icon: "🎯", label: "Smart Routing",    sublabel: "Profile selection" },
  { id: "generate", icon: "🖼", label: "Generation",       sublabel: "SD-Turbo / SDXL" },
  { id: "quality",  icon: "✅", label: "Quality Gate",     sublabel: "OpenCV checks" },
];

interface PipelineVizProps {
  activeSteps: string[];
  cacheHit?: boolean;
  stepTimings?: Record<string, number>;
}

export function PipelineViz({ activeSteps, cacheHit, stepTimings }: PipelineVizProps) {
  const [svgWidth, setSvgWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const obs = new ResizeObserver((entries) => {
      setSvgWidth(entries[0].contentRect.width);
    });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const nodeCount = STEPS.length;
  const nodeSpacing = svgWidth / nodeCount;
  const nodeX = (i: number) => nodeSpacing * i + nodeSpacing / 2;
  const lineY = 40;

  const getState = (stepId: string) => {
    if (cacheHit && stepId === "cache") return "cache";
    if (activeSteps.includes(stepId)) return "done";
    if (activeSteps.length > 0 && STEPS.indexOf(STEPS.find(s => s.id === stepId)!) === activeSteps.length) return "active";
    return "idle";
  };

  return (
    <div ref={containerRef} className="w-full">
      {/* SVG connector lines */}
      {svgWidth > 0 && (
        <svg width={svgWidth} height={80} className="absolute pointer-events-none" style={{ top: 0, left: 0 }}>
          {STEPS.slice(0, -1).map((step, i) => {
            const isDone = activeSteps.includes(STEPS[i + 1].id);
            const isActive = getState(STEPS[i + 1].id) === "active";
            return (
              <line
                key={i}
                x1={nodeX(i)}
                y1={lineY}
                x2={nodeX(i + 1)}
                y2={lineY}
                className={`connector-line ${isDone ? "done" : isActive ? "active" : ""}`}
              />
            );
          })}
        </svg>
      )}

      {/* Nodes */}
      <div className="relative flex justify-between items-start" style={{ minHeight: 80 }}>
        {STEPS.map((step, i) => {
          const state = getState(step.id);
          return (
            <div key={step.id} className="pipeline-node flex-1" style={{ zIndex: 1 }}>
              <motion.div
                className={`pipeline-node-circle mx-auto ${state}`}
                animate={state === "active" ? { scale: [1, 1.15, 1] } : {}}
                transition={{ repeat: Infinity, duration: 1.2 }}
              >
                <span className="text-lg">{step.icon}</span>
              </motion.div>
              <div className="text-center mt-2 px-1">
                <p className={`text-[11px] font-heading font-bold leading-tight ${
                  state === "done" ? "text-[#34D399]" :
                  state === "cache" ? "text-[#34D399]" :
                  state === "active" ? "text-[#8B5CF6]" : "text-white/40"
                }`}>
                  {step.label}
                </p>
                <p className="text-[9px] text-white/30 mt-0.5 font-body">{step.sublabel}</p>
                {stepTimings?.[step.id] && (
                  <motion.p
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-[9px] text-[#FBBF24] font-mono mt-0.5"
                  >
                    {stepTimings[step.id]}ms
                  </motion.p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Cache hit banner */}
      <AnimatePresence>
        {cacheHit && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-3 flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#34D399]/25 bg-[#34D399]/08"
          >
            <span className="text-[#34D399] text-lg">⚡</span>
            <div>
              <p className="text-[#34D399] font-heading font-bold text-sm">Cache Hit — 100% Compute Saved</p>
              <p className="text-white/50 text-xs font-body">Image retrieved from vector store. 0 GPU seconds used.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
