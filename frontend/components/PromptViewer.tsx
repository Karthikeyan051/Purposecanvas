"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface PromptViewerProps {
  promptCard: any;
  intent?: any;
}

export function PromptViewer({ promptCard, intent }: PromptViewerProps) {
  const [tab, setTab] = useState<"sd" | "mj" | "dalle3" | "json">("sd");
  const [copied, setCopied] = useState(false);

  const pc = promptCard?.purposecanvas_prompt_card;
  const prompts = pc?.prompts || {};
  const meta = pc?.metadata || {};

  const content: Record<string, string> = {
    sd:     prompts.optimized || prompts.base || "No SD prompt",
    mj:     prompts.midjourney || "No MJ prompt",
    dalle3: prompts.dalle3 || "No DALL·E 3 prompt",
    json:   JSON.stringify(promptCard, null, 2),
  };

  const copy = async () => {
    await navigator.clipboard.writeText(content[tab]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const TABS = [
    { id: "sd",     label: "Stable Diffusion", color: "#8B5CF6" },
    { id: "mj",     label: "Midjourney",        color: "#F472B6" },
    { id: "dalle3", label: "DALL·E 3",          color: "#FBBF24" },
    { id: "json",   label: "{ JSON }",          color: "#00F5FF" },
  ] as const;

  return (
    <div className="space-y-3">
      {/* Intent meta strip */}
      {intent && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="badge badge-violet">🧠 {intent.type}</span>
          <span className="badge badge-ghost">{(intent.confidence * 100).toFixed(0)}% conf</span>
          {meta.age_group && <span className="badge badge-cyan">{meta.age_group}</span>}
          {meta.complexity && <span className="badge badge-amber">{meta.complexity}</span>}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-[#0D0D1A] rounded-xl border border-white/[0.06]">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`data-tab flex-1 text-center ${tab === t.id ? "active" : ""}`}
            style={tab === t.id ? { color: t.color, borderColor: `${t.color}30`, backgroundColor: `${t.color}10` } : {}}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
          >
            <div className="code-block text-white/75 max-h-48 overflow-y-auto text-[11px]">
              {tab === "json" ? (
                <pre dangerouslySetInnerHTML={{ __html: syntaxHighlight(content.json) }} />
              ) : (
                content[tab]
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Copy button */}
        <button
          onClick={copy}
          className="absolute top-2 right-2 text-xs px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-all font-body"
        >
          {copied ? "✓ Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

function syntaxHighlight(json: string) {
  return json
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"([^"]+)":/g, '<span style="color:#8B5CF6">"$1"</span>:')
    .replace(/: "([^"]*)"/g, ': <span style="color:#FBBF24">"$1"</span>')
    .replace(/: (\d+\.?\d*)/g, ': <span style="color:#34D399">$1</span>')
    .replace(/: (true|false|null)/g, ': <span style="color:#F472B6">$1</span>');
}
