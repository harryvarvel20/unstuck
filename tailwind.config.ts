import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Surfaces + text are driven by CSS variables so the same class names
        // work in both themes. See globals.css.
        bg: "rgb(var(--bg) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        "surface-2": "rgb(var(--surface-2) / <alpha-value>)",
        border: "rgb(var(--border) / <alpha-value>)",
        text: "rgb(var(--text) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        // Signature sage -> deep olive (Ink & Sage).
        accent: {
          DEFAULT: "rgb(var(--accent) / <alpha-value>)",
          2: "rgb(var(--accent-2) / <alpha-value>)",
          soft: "rgb(var(--accent-soft) / <alpha-value>)",
          ink: "rgb(var(--accent-ink) / <alpha-value>)",
        },
      },
      boxShadow: {
        soft: "var(--shadow-soft)",
        float: "var(--shadow-float)",
      },
      borderRadius: {
        // Restrained, classic radii (Old Money) — crisp, not bubbly.
        "2xl": "0.625rem",
        "3xl": "0.875rem",
      },
      fontFamily: {
        // Editorial serif display, humanist sans body — driven by the CSS
        // vars set in globals.css (self-hosted via next/font).
        display: ["var(--font-fraunces)", "Georgia", "serif"],
        sans: [
          "var(--font-inter)",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      backdropBlur: {
        xs: "2px",
      },
      keyframes: {
        "tick-pop": {
          "0%": { transform: "scale(0.4)", opacity: "0" },
          "60%": { transform: "scale(1.15)", opacity: "1" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "card-in": {
          "0%": { transform: "translateY(8px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "page-in": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        breath: {
          "0%, 100%": { transform: "scale(0.8)", opacity: "0.5" },
          "50%": { transform: "scale(1.05)", opacity: "1" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-400px 0" },
          "100%": { backgroundPosition: "400px 0" },
        },
        "door-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "door-out": {
          "0%": { opacity: "1", transform: "scale(1)" },
          "100%": { opacity: "0", transform: "scale(1.04)" },
        },
      },
      animation: {
        "tick-pop": "tick-pop 0.32s cubic-bezier(0.34, 1.56, 0.64, 1)",
        // NOTE: entrance animations that animate `transform` MUST use
        // `backwards`, never `both`. `both` retains the final keyframe, and a
        // retained transform — even the identity `translateY(0)` — makes the
        // element a CONTAINING BLOCK for `position: fixed` descendants. That
        // traps every modal rendered inside an animated wrapper into that
        // wrapper's box instead of the viewport (it renders as a tiny
        // scrollable sliver). `backwards` still applies the first keyframe
        // before the animation starts, so there is no flash-in, but nothing
        // is retained afterwards. `fade-in` is opacity-only, so it is safe.
        "card-in": "card-in 0.35s ease-out backwards",
        "fade-in": "fade-in 0.4s ease-out both",
        "page-in": "page-in 0.26s cubic-bezier(0.16, 1, 0.3, 1) backwards",
        breath: "breath 7s ease-in-out infinite",
        shimmer: "shimmer 1.4s linear infinite",
        "door-in": "door-in 0.5s ease-out both",
        "door-out": "door-out 0.46s cubic-bezier(0.4, 0, 1, 1) both",
      },
    },
  },
  plugins: [],
};

export default config;
