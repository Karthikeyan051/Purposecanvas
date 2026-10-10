"use client";
import React from "react";

interface State { hasError: boolean; }

export class ThreeErrorBoundary extends React.Component<{ children: React.ReactNode; fallback?: React.ReactNode }, State> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: any) { console.warn("[3D] Canvas error caught by boundary:", error?.message); }
  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-center">
            <div className="text-5xl mb-3 opacity-30">🌐</div>
            <p className="text-white/25 text-sm font-body">3D view unavailable</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
