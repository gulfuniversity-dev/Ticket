import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Gulf University graduation palette
        gu: {
          navy: "#0b2447",
          blue: "#19376d",
          accent: "#576cbc",
          gold: "#c9a227",
          light: "#a5d7e8",
        },
      },
      fontFamily: {
        sans: ["system-ui", "Segoe UI", "Roboto", "Helvetica", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
