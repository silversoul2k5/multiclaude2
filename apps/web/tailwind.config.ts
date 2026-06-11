import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        body: ["var(--font-body)", "ui-sans-serif", "system-ui"]
      },
      colors: {
        ink: "#d8d2c4",
        ember: "#f06a3d",
        moss: "#8ea86a",
        midnight: "#101411",
        slateGlass: "rgba(18, 24, 21, 0.72)"
      },
      boxShadow: {
        glow: "0 0 80px rgba(240, 106, 61, 0.15)"
      }
    }
  },
  plugins: [typography]
};

export default config;
