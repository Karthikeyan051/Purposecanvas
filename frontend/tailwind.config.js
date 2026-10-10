/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        accent: "#00f5ff",
        "accent-dim": "rgba(0,245,255,0.6)",
        "bg-deep": "#0a0a0f",
        "bg-card": "rgba(255,255,255,0.04)",
        escalated: "#7c3aed",
        "cache-hit": "#10b981",
        cost: "#f59e0b",
      },
      backdropBlur: {
        glass: "20px",
      },
      animation: {
        "pulse-cyan": "pulse-cyan 1.5s ease-in-out infinite",
        "fade-in": "fade-in 0.4s ease forwards",
        "slide-up": "slide-up 0.4s ease forwards",
      },
      keyframes: {
        "pulse-cyan": {
          "0%,100%": { boxShadow: "0 0 20px rgba(0,245,255,0.15)" },
          "50%": { boxShadow: "0 0 40px rgba(0,245,255,0.5)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
