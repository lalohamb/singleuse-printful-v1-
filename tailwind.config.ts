import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#f6f1ec", 100: "#e8dccf", 200: "#d1b99e", 300: "#bb966d",
          400: "#a4733c", 500: "#8d5a1e", 600: "#714818", 700: "#563612",
          800: "#3a240c", 900: "#1f1206",
        },
        secondary: {
          50: "#f5f5f5", 100: "#e0e0e0", 200: "#c7c7c7", 300: "#aeaeae",
          400: "#959595", 500: "#7c7c7c", 600: "#636363", 700: "#4a4a4a",
          800: "#313131", 900: "#1a1a1a",
        },
        accent: {
          50: "#fdf3f0", 100: "#fae0d8", 200: "#f4c1b0", 300: "#eea288",
          400: "#e88360", 500: "#d9633a", 600: "#b54e2c", 700: "#913e22",
          800: "#6d2f19", 900: "#491f10",
        },
        success: { 50: "#f0fdf4", 100: "#dcfce7", 500: "#22c55e", 600: "#16a34a", 700: "#15803d" },
        warning: { 50: "#fffbeb", 100: "#fef3c7", 500: "#f59e0b", 600: "#d97706" },
        error: { 50: "#fef2f2", 100: "#fee2e2", 500: "#ef4444", 600: "#dc2626", 700: "#b91c1c" },
        gold: { 400: "#d4af37", 500: "#c49b2c", 600: "#a47f1e" },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Playfair Display", "Georgia", "serif"],
      },
      animation: {
        "fade-in": "fadeIn 0.4s ease-out",
        "slide-up": "slideUp 0.5s ease-out",
        "slide-in-right": "slideInRight 0.3s ease-out",
        "marquee": "marquee 30s linear infinite",
      },
      keyframes: {
        fadeIn: { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        slideUp: { "0%": { opacity: "0", transform: "translateY(20px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        slideInRight: { "0%": { transform: "translateX(100%)" }, "100%": { transform: "translateX(0)" } },
        marquee: { "0%": { transform: "translateX(0)" }, "100%": { transform: "translateX(-50%)" } },
      },
    },
  },
  plugins: [],
};

export default config;
