"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface FloatingShapeProps {
  shape: "circle" | "triangle" | "square" | "ring" | "dot-grid";
  color: string;
  size: number;
  top?: string; left?: string; right?: string; bottom?: string;
  rotate?: number;
  opacity?: number;
  animate?: boolean;
  delay?: number;
}

export function FloatingShape({
  shape, color, size, top, left, right, bottom,
  rotate = 0, opacity = 0.12, animate: doAnimate = true, delay = 0,
}: FloatingShapeProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const style: React.CSSProperties = {
    position: "absolute",
    top, left, right, bottom,
    width: size, height: size,
    transform: `rotate(${rotate}deg)`,
    pointerEvents: "none",
    zIndex: 0,
    opacity,
  };

  const ShapeEl = () => {
    switch (shape) {
      case "circle":
        return <div style={{ width: size, height: size, borderRadius: "50%", backgroundColor: color }} />;
      case "ring":
        return (
          <div style={{
            width: size, height: size, borderRadius: "50%",
            border: `${Math.max(2, size * 0.05)}px solid ${color}`,
          }} />
        );
      case "square":
        return <div style={{ width: size, height: size, backgroundColor: color, borderRadius: 4 }} />;
      case "triangle":
        return (
          <svg width={size} height={size} viewBox="0 0 100 100">
            <polygon points="50,10 90,90 10,90" fill={color} />
          </svg>
        );
      case "dot-grid":
        return (
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {Array.from({ length: 6 }, (_, row) =>
              Array.from({ length: 6 }, (_, col) => (
                <circle
                  key={`${row}-${col}`}
                  cx={col * (size / 5) + size / 10}
                  cy={row * (size / 5) + size / 10}
                  r="2"
                  fill={color}
                />
              ))
            )}
          </svg>
        );
    }
  };

  if (!doAnimate) return <div style={style}><ShapeEl /></div>;

  return (
    <motion.div
      style={style}
      animate={{ y: [0, -14, 0], rotate: [rotate, rotate + 4, rotate - 3, rotate] }}
      transition={{
        duration: 6 + delay,
        repeat: Infinity,
        ease: "easeInOut",
        delay,
      }}
    >
      <ShapeEl />
    </motion.div>
  );
}
