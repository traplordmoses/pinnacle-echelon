import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        aero: {
          sky: "#87CEEB",
          aqua: "#00BCD4",
          blue: "#4FC3F7",
          light: "#E0F7FA",
          glow: "#7EC8E3",
          deep: "#0288D1",
        },
      },
      borderRadius: {
        "4xl": "2rem",
      },
      boxShadow: {
        glass: "0 8px 32px rgba(31, 38, 135, 0.12)",
        glossy:
          "0 4px 16px rgba(0, 188, 212, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.5)",
        "glossy-hover":
          "0 6px 24px rgba(0, 188, 212, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.6)",
        bubble: "0 4px 24px rgba(125, 211, 252, 0.25)",
      },
      backgroundImage: {
        "aero-gradient":
          "linear-gradient(180deg, #c9e8f7 0%, #e4f3fc 30%, #f0f8ff 60%, #ffffff 100%)",
        "glossy-btn":
          "linear-gradient(180deg, #7dd3fc 0%, #38bdf8 40%, #0ea5e9 100%)",
        "glossy-btn-pink":
          "linear-gradient(180deg, #f0abfc 0%, #d946ef 40%, #a855f7 100%)",
        "glossy-btn-green":
          "linear-gradient(180deg, #6ee7b7 0%, #34d399 40%, #10b981 100%)",
        "glossy-btn-orange":
          "linear-gradient(180deg, #fdba74 0%, #fb923c 40%, #f97316 100%)",
      },
    },
  },
  plugins: [],
};
export default config;
