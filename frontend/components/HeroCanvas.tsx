// @ts-nocheck
"use client";
import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, MeshDistortMaterial } from "@react-three/drei";
import { ThreeErrorBoundary } from "./ThreeErrorBoundary";

function DistortOrb() {
  const meshRef = useRef(null);
  useFrame(({ clock }) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = clock.getElapsedTime() * 0.18;
      meshRef.current.rotation.x = Math.sin(clock.getElapsedTime() * 0.12) * 0.15;
    }
  });
  return (
    <mesh ref={meshRef}>
      <icosahedronGeometry args={[1.6, 4]} />
      <MeshDistortMaterial
        color="#8B5CF6"
        distort={0.38}
        speed={1.8}
        roughness={0.08}
        metalness={0.9}
      />
    </mesh>
  );
}

function FloatingRing() {
  const meshRef = useRef(null);
  useFrame(({ clock }) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = clock.getElapsedTime() * 0.12;
      meshRef.current.rotation.z = clock.getElapsedTime() * 0.08;
    }
  });
  return (
    <mesh ref={meshRef}>
      <torusGeometry args={[2.4, 0.025, 8, 80]} />
      <meshBasicMaterial color="#8B5CF6" opacity={0.25} transparent />
    </mesh>
  );
}

function FloatingRing2() {
  const meshRef = useRef(null);
  useFrame(({ clock }) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = clock.getElapsedTime() * 0.09;
      meshRef.current.rotation.x = Math.PI / 3 + Math.sin(clock.getElapsedTime() * 0.06) * 0.2;
    }
  });
  return (
    <mesh ref={meshRef}>
      <torusGeometry args={[3.0, 0.015, 6, 80]} />
      <meshBasicMaterial color="#00F5FF" opacity={0.12} transparent />
    </mesh>
  );
}

export default function HeroCanvas() {
  return (
    <ThreeErrorBoundary>
      <Canvas camera={{ position: [0, 0, 5.5], fov: 45 }} style={{ width: "100%", height: "100%" }}>
        <ambientLight intensity={0.3} />
        <pointLight position={[4, 4, 4]}   color="#8B5CF6" intensity={4} />
        <pointLight position={[-4, -2, -4]} color="#00F5FF" intensity={2} />
        <pointLight position={[0, -4, 2]}  color="#F472B6" intensity={1.5} />
        <pointLight position={[2, 2, -4]}  color="#FBBF24" intensity={0.8} />
        <DistortOrb />
        <FloatingRing />
        <FloatingRing2 />
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          autoRotate
          autoRotateSpeed={0.4}
          maxPolarAngle={Math.PI * 0.65}
          minPolarAngle={Math.PI * 0.35}
        />
      </Canvas>
    </ThreeErrorBoundary>
  );
}
