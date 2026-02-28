import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ekko: {
          dark: "#050505",  
          card: "#121212",    
          highlight: "#2563EB",
          accent: "#7C3AED",  
          text: "#E5E5E5",  
          muted: "#A3A3A3",   
        },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "hero-gradient": "linear-gradient(to top, #050505 0%, transparent 100%)",
      },
    },
  },
  plugins: [],
};
export default config;