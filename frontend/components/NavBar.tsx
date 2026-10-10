"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";

const links = [
  { href: "/", label: "Studio" },
  { href: "/benchmark", label: "Benchmark" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/control-room", label: "Control Room" },
];

export function NavBar() {
  const path = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 h-16 flex items-center px-6 transition-all duration-300 ${
        scrolled
          ? "bg-[#0A0A14]/90 backdrop-blur-xl border-b border-white/[0.06] shadow-[0_1px_0_rgba(255,255,255,0.04)]"
          : "bg-transparent"
      }`}
    >
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2.5 mr-8 group">
        <motion.div
          className="w-8 h-8 rounded-[9px] flex items-center justify-center relative"
          style={{
            background: "#8B5CF6",
            boxShadow: "3px 3px 0px 0px rgba(139,92,246,0.4)",
            border: "1.5px solid rgba(255,255,255,0.15)",
          }}
          whileHover={{ y: -1, boxShadow: "4px 4px 0px 0px #8B5CF6" }}
          whileTap={{ scale: 0.95 }}
        >
          <span className="text-white font-black text-xs font-heading">PC</span>
        </motion.div>
        <span className="font-heading font-bold text-sm tracking-[-0.02em] text-[#F0F0FF]">
          Purpose<span className="text-[#8B5CF6]">Canvas</span>
        </span>
      </Link>

      {/* Nav links — desktop */}
      <div className="hidden md:flex gap-0.5">
        {links.map((l) => {
          const active = path === l.href;
          return (
            <Link
              key={l.href}
              href={l.href}
              className="relative px-4 py-2 rounded-full text-sm font-medium transition-colors duration-150 hover:text-white text-white/60"
            >
              {active && (
                <motion.span
                  layoutId="nav-pill"
                  className="absolute inset-0 rounded-full bg-white/[0.06] border border-[#8B5CF6]/25"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              )}
              <span className={`relative z-10 font-body transition-colors ${active ? "text-[#8B5CF6] font-semibold" : ""}`}>
                {l.label}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Right: live indicator */}
      <div className="ml-auto flex items-center gap-3">
        <div className="hidden md:flex items-center gap-2 text-xs text-white/40">
          <span className="w-1.5 h-1.5 rounded-full bg-[#34D399] pulse-emerald" />
          <span className="font-body">Live</span>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden flex flex-col gap-1.5 p-2"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          <motion.span
            className="w-5 h-0.5 bg-white/70 block rounded-full"
            animate={menuOpen ? { rotate: 45, y: 6 } : { rotate: 0, y: 0 }}
            transition={{ duration: 0.2 }}
          />
          <motion.span
            className="w-5 h-0.5 bg-white/70 block rounded-full"
            animate={menuOpen ? { opacity: 0 } : { opacity: 1 }}
            transition={{ duration: 0.2 }}
          />
          <motion.span
            className="w-5 h-0.5 bg-white/70 block rounded-full"
            animate={menuOpen ? { rotate: -45, y: -6 } : { rotate: 0, y: 0 }}
            transition={{ duration: 0.2 }}
          />
        </button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute top-[calc(100%+8px)] right-4 left-4 bg-[#111120] border border-white/10 rounded-2xl overflow-hidden shadow-[0_24px_48px_-12px_rgba(0,0,0,0.6)] p-2"
          >
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                className={`flex items-center h-11 px-4 rounded-xl text-sm font-medium transition-colors ${
                  path === l.href ? "bg-[#8B5CF6]/10 text-[#8B5CF6]" : "text-white/70 hover:text-white hover:bg-white/[0.05]"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
