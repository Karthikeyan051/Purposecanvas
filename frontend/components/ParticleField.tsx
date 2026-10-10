"use client";
import { useEffect, useRef, useCallback } from "react";

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  size: number;
  opacity: number;
  shape: "triangle" | "square" | "circle" | "diamond";
  rotation: number;
  rotationSpeed: number;
  color: string;
}

const COLORS = [
  "rgba(139,92,246,", // violet
  "rgba(0,245,255,",  // cyan
  "rgba(251,191,36,", // amber
  "rgba(52,211,153,", // emerald
  "rgba(244,114,182,",// pink
];

function drawShape(ctx: CanvasRenderingContext2D, p: Particle) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rotation);
  ctx.globalAlpha = p.opacity;
  ctx.fillStyle = `${p.color}${p.opacity})`;
  ctx.strokeStyle = `${p.color}${p.opacity * 1.5})`;
  ctx.lineWidth = 1;

  switch (p.shape) {
    case "triangle":
      ctx.beginPath();
      ctx.moveTo(0, -p.size);
      ctx.lineTo(p.size * 0.866, p.size * 0.5);
      ctx.lineTo(-p.size * 0.866, p.size * 0.5);
      ctx.closePath();
      ctx.stroke();
      break;
    case "square":
      ctx.strokeRect(-p.size / 2, -p.size / 2, p.size, p.size);
      break;
    case "circle":
      ctx.beginPath();
      ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case "diamond":
      ctx.beginPath();
      ctx.moveTo(0, -p.size);
      ctx.lineTo(p.size * 0.6, 0);
      ctx.lineTo(0, p.size);
      ctx.lineTo(-p.size * 0.6, 0);
      ctx.closePath();
      ctx.stroke();
      break;
  }
  ctx.restore();
}

export function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animRef = useRef<number>(0);

  const initParticles = useCallback((w: number, h: number) => {
    const count = Math.floor((w * h) / 28000);
    particlesRef.current = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h + h * 0.1,
      vx: (Math.random() - 0.5) * 0.15,
      vy: -(Math.random() * 0.3 + 0.1),
      size: Math.random() * 10 + 5,
      opacity: Math.random() * 0.04 + 0.02,
      shape: (["triangle", "square", "circle", "diamond"] as const)[Math.floor(Math.random() * 4)],
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.005,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    }));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initParticles(canvas.width, canvas.height);
    };
    resize();
    window.addEventListener("resize", resize);

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particlesRef.current.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;
        if (p.y < -50) {
          p.y = canvas.height + 50;
          p.x = Math.random() * canvas.width;
        }
        drawShape(ctx, p);
      });
      animRef.current = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animRef.current);
    };
  }, [initParticles]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ opacity: 1 }}
    />
  );
}
