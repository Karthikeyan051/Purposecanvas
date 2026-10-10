"use client";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

interface MetricCounterProps {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  label: string;
  sublabel?: string;
  color?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

function useCountUp(target: number, duration = 1400) {
  const [current, setCurrent] = useState(0);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (target === 0) return;
    startRef.current = null;
    const animate = (ts: number) => {
      if (!startRef.current) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutQuart
      const eased = 1 - Math.pow(1 - progress, 4);
      setCurrent(eased * target);
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return current;
}

export function MetricCounter({
  value, decimals = 0, prefix = "", suffix = "",
  label, sublabel, color = "#34D399", size = "lg",
}: MetricCounterProps) {
  const count = useCountUp(value);
  const sizeClass = {
    sm: "text-2xl",
    md: "text-4xl",
    lg: "text-5xl",
    xl: "text-[clamp(40px,6vw,72px)]",
  }[size];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
      className="metric-card text-center"
    >
      <div
        className={`font-heading font-black ${sizeClass} leading-none`}
        style={{ color }}
      >
        {prefix}{count.toFixed(decimals)}{suffix}
      </div>
      <p className="text-sm font-heading font-semibold text-white/70 mt-2">{label}</p>
      {sublabel && <p className="text-xs text-white/35 font-body mt-0.5">{sublabel}</p>}
    </motion.div>
  );
}
