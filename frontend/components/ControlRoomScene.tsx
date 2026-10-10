// @ts-nocheck
"use client";
import { useRef, useEffect, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Text, Environment } from "@react-three/drei";
import * as THREE from "three";
import type { WSEvent } from "@/app/control-room/page";
import { ThreeElements } from '@react-three/fiber';
import { ThreeErrorBoundary } from "./ThreeErrorBoundary";

declare global {
  namespace JSX {
    interface IntrinsicElements extends ThreeElements {}
  }
}

// ── Types ────────────────────────────────────────────────────────────────────

type DeskConfig = {
  id: string;
  position: [number, number, number];
  label: string;
  color: string;
  role: "junior" | "senior" | "librarian";
};

const DESKS: DeskConfig[] = [
  { id: "j1", position: [-3, 0, 0],  label: "SD-Turbo #1", color: "#00f5ff", role: "junior" },
  { id: "j2", position: [0,  0, 0],  label: "SD-Turbo #2", color: "#00f5ff", role: "junior" },
  { id: "j3", position: [3,  0, 0],  label: "SD-Turbo #3", color: "#00f5ff", role: "junior" },
  { id: "s1", position: [-2, 0, -3], label: "SDXL Senior",  color: "#7c3aed", role: "senior" },
  { id: "l1", position: [2,  0, -3], label: "Cache Lib",    color: "#10b981", role: "librarian" },
];

// ── Worker character: capsule body + sphere head ──────────────────────────────

function Worker({
  position, color, active, escalated
}: {
  position: [number, number, number];
  color: string;
  active: boolean;
  escalated: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null!);
  const targetY = active ? 0.1 : 0;

  useFrame(({ clock }: any) => {
    if (!groupRef.current) return;
    // Gentle bob when active (typing animation)
    groupRef.current.position.y = active
      ? Math.sin(clock.getElapsedTime() * 4) * 0.05 + 0.1
      : THREE.MathUtils.lerp(groupRef.current.position.y, 0, 0.1);
    // Escalation flash: red tint
    const mesh = groupRef.current.children[0] as THREE.Mesh;
    if (mesh?.material) {
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.emissive.setStyle(escalated ? "#ff0000" : color);
      mat.emissiveIntensity = escalated ? 0.5 : (active ? 0.3 : 0.05);
    }
  });

  return (
    <group ref={groupRef} position={position}>
      {/* Body */}
      <mesh position={[0, 0.6, 0]}>
        <capsuleGeometry args={[0.18, 0.5, 8, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.1} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 1.25, 0]}>
        <sphereGeometry args={[0.16, 16, 16]} />
        <meshStandardMaterial color="#f5deb3" />
      </mesh>
    </group>
  );
}

// ── Desk ─────────────────────────────────────────────────────────────────────

function Desk({
  config, active, escalated
}: {
  config: DeskConfig;
  active: boolean;
  escalated: boolean;
}) {
  const deskRef = useRef<THREE.Mesh>(null!);

  useFrame(() => {
    if (deskRef.current) {
      const mat = deskRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = THREE.MathUtils.lerp(
        mat.emissiveIntensity,
        active ? 0.4 : 0.05,
        0.08
      );
    }
  });

  const [px, py, pz] = config.position;

  return (
    <group position={config.position}>
      {/* Desk surface */}
      <mesh ref={deskRef} position={[0, 0.4, 0]}>
        <boxGeometry args={[1.2, 0.08, 0.7]} />
        <meshStandardMaterial
          color={config.color}
          emissive={config.color}
          emissiveIntensity={0.05}
          roughness={0.3}
          metalness={0.6}
        />
      </mesh>
      {/* Desk legs */}
      {[[-0.5, 0.2, -0.3], [0.5, 0.2, -0.3], [-0.5, 0.2, 0.3], [0.5, 0.2, 0.3]].map(([lx, ly, lz], i) => (
        <mesh key={i} position={[lx, ly, lz]}>
          <boxGeometry args={[0.06, 0.4, 0.06]} />
          <meshStandardMaterial color="#334155" />
        </mesh>
      ))}
      {/* Worker */}
      <Worker position={[0, 0.45, 0.1]} color={config.color} active={active} escalated={escalated} />
      {/* Label */}
      <Text
        position={[0, 1.7, 0]}
        fontSize={0.18}
        color={config.color}
        anchorX="center"
        anchorY="middle"
      >
        {config.label}
      </Text>
    </group>
  );
}

// ── Floating card (request) ───────────────────────────────────────────────────

function RequestCard({
  target, color, onDone
}: {
  target: [number, number, number];
  color: string;
  onDone: () => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const startY = 4;
  const progress = useRef(0);

  useFrame((_: any, delta: number) => {
    if (!meshRef.current) return;
    progress.current += delta * 0.8;
    const t = Math.min(progress.current, 1);
    meshRef.current.position.y = THREE.MathUtils.lerp(startY, target[1] + 1.5, t);
    meshRef.current.position.x = THREE.MathUtils.lerp(0, target[0], t);
    meshRef.current.position.z = THREE.MathUtils.lerp(0, target[2], t);
    meshRef.current.rotation.z += delta * 0.5;
    if (t >= 1) onDone();
  });

  return (
    <mesh ref={meshRef} position={[0, startY, 0]}>
      <boxGeometry args={[0.25, 0.35, 0.02]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
    </mesh>
  );
}

// ── Floor grid ────────────────────────────────────────────────────────────────

function FloorGrid() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
      <planeGeometry args={[20, 20, 20, 20]} />
      <meshStandardMaterial
        color="#0a0a1a"
        wireframe
        transparent
        opacity={0.3}
      />
    </mesh>
  );
}

// ── Main Scene ────────────────────────────────────────────────────────────────

function Scene({ lastEvent }: { lastEvent: WSEvent | null }) {
  const [activeDesks, setActiveDesks] = useState<Set<string>>(new Set());
  const [escalatedDesks, setEscalatedDesks] = useState<Set<string>>(new Set());
  const [cards, setCards] = useState<Array<{ id: string; target: [number,number,number]; color: string }>>([]);

  useEffect(() => {
    if (!lastEvent) return;
    const { event, tier, from_tier, to_tier } = lastEvent;
    const cardId = `card-${Date.now()}`;

    if (event === "generating_start") {
      // Activate matching desk
      if (tier === "sd_turbo") {
        // Pick first available junior desk
        const jDesks = DESKS.filter(d => d.role === "junior").map(d => d.id);
        const target = jDesks[Math.floor(Math.random() * jDesks.length)];
        const desk = DESKS.find(d => d.id === target)!;
        setActiveDesks((prev: any) => new Set([...Array.from(prev), target]));
        setCards((prev: any) => [...prev, { id: cardId, target: desk.position, color: "#00f5ff" }]);
      } else if (tier === "sdxl" || tier?.includes("sdxl")) {
        const desk = DESKS.find(d => d.role === "senior")!;
        setActiveDesks((prev: any) => new Set<string>([...Array.from(prev) as string[], desk.id]));
        setCards((prev: any) => [...prev, { id: cardId, target: desk.position, color: "#7c3aed" }]);
      }
    }

    if (event === "cache_hit") {
      const desk = DESKS.find(d => d.role === "librarian")!;
      setActiveDesks((prev: any) => new Set<string>([...Array.from(prev) as string[], desk.id]));
      setCards((prev: any) => [...prev, { id: cardId, target: desk.position, color: "#10b981" }]);
      // Auto-deactivate librarian quickly
      setTimeout(() => setActiveDesks((prev: any) => { const n = new Set<string>(prev); n.delete(desk.id); return n; }), 1500);
    }

    if (event === "escalated") {
      const juniors = DESKS.filter(d => d.role === "junior").map(d => d.id);
      juniors.forEach(id => setEscalatedDesks((prev: any) => new Set<string>([...Array.from(prev) as string[], id])));
      setTimeout(() => {
        juniors.forEach(id => setEscalatedDesks((prev: any) => { const n = new Set<string>(prev); n.delete(id); return n; }));
      }, 2000);
    }

    if (event === "complete" || event === "generating_end") {
      // Deactivate all desks gradually
      setTimeout(() => {
        setActiveDesks(new Set());
        setEscalatedDesks(new Set());
      }, 1500);
    }
  }, [lastEvent]);

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.3} />
      <directionalLight position={[5, 10, 5]} intensity={0.8} castShadow />
      {DESKS.map(d => (
        <pointLight key={d.id} position={[d.position[0], 3, d.position[2]]}
          intensity={activeDesks.has(d.id) ? 2 : 0.3} color={d.color} distance={4} />
      ))}

      {/* Floor */}
      <FloorGrid />

      {/* Desks */}
      {DESKS.map(d => (
        <Desk
          key={d.id}
          config={d}
          active={activeDesks.has(d.id)}
          escalated={escalatedDesks.has(d.id)}
        />
      ))}

      {/* Floating cards */}
      {cards.map((c: any) => (
        <RequestCard
          key={c.id}
          target={c.target}
          color={c.color}
          onDone={() => setCards((prev: any) => prev.filter((x: any) => x.id !== c.id))}
        />
      ))}

      {/* Title text */}
      <Text position={[0, 4, -2]} fontSize={0.4} color="#00f5ff" anchorX="center">
        PurposeCanvas Control Room
      </Text>

      <OrbitControls
        enablePan={false}
        minDistance={6}
        maxDistance={18}
        maxPolarAngle={Math.PI / 2.2}
      />
    </>
  );
}

// ── Export ───────────────────────────────────────────────────────────────────

export default function ControlRoomScene({ lastEvent }: { lastEvent: WSEvent | null }) {
  return (
    <ThreeErrorBoundary>
      <Canvas
        camera={{ position: [0, 8, 10], fov: 50 }}
        style={{ background: "linear-gradient(180deg, #0a0a1a 0%, #0d1117 100%)" }}
        shadows
      >
        <Scene lastEvent={lastEvent} />
      </Canvas>
    </ThreeErrorBoundary>
  );
}
