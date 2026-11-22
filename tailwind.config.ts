import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { primary: "#1B2A6B", secondary: "#3474B8", accent: "#88BCE3" },
        page: "var(--page)",
        card: "var(--card)",
        ink: "var(--ink)",
        head: "var(--head)",
        line: "var(--line)",
        soft: "var(--soft)",
      },
      fontFamily: {
        sans: ['"SST Arabic"', "system-ui", "Segoe UI", "Tahoma", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
