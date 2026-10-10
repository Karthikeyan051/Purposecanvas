"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

const links = [
  { href: "/", label: "Studio" },
  { href: "/benchmark", label: "Benchmark" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/control-room", label: "Control Room" },
];

export function NavBar() {
  const path = usePathname();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-16 flex items-center px-6 border-b border-white/[0.06] bg-[#0a0a0f]/80 backdrop-blur-xl">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2 mr-8">
        <div className="w-7 h-7 rounded-lg bg-[#00f5ff] flex items-center justify-center">
          <span className="text-[#0a0a0f] font-black text-xs">PC</span>
        </div>
        <span className="font-bold text-sm tracking-wide">
          Purpose<span className="text-[#00f5ff]">Canvas</span>
        </span>
      </Link>

      {/* Nav links */}
      <div className="flex gap-1">
        {links.map((l) => {
          const active = path === l.href;
          return (
            <Link key={l.href} href={l.href} className="relative px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:text-white text-white/60">
              {active && (
                <motion.span
                  layoutId="nav-pill"
                  className="absolute inset-0 rounded-lg bg-white/[0.06] border border-[#00f5ff]/20"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <span className={`relative z-10 ${active ? "text-[#00f5ff]" : ""}`}>{l.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Right: live indicator */}
      <div className="ml-auto flex items-center gap-2 text-xs text-white/40">
        <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
        PurposeCanvas API
      </div>
    </nav>
  );
}
