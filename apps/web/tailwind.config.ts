import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";

const config: Config = {
  content: [
    "./src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  // Hover styles apply only where hovering exists, so they never stick after a tap.
  future: {
    hoverOnlyWhenSupported: true,
  },
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-golos)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [
    plugin(({ addVariant }) => {
      // Touch and stylus: size targets by input method, not screen width.
      addVariant("coarse", "@media (pointer: coarse)");
      // Landscape phones: too little height to spend on pinned bars.
      addVariant("short", "@media (max-height: 480px)");
    }),
  ],
};

export default config;
