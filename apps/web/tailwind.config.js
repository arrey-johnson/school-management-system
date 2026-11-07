/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        deep: "#4A0066",
        purple: "#BF00FF",
        mid: "#D24AFF",
        soft: "#F6D9FF",
        pale: "#FBF4FF",
        line: "#E9C6FF",
        ink: "#2A003D",
        muted: "#7A5A8A",
        success: "#2E8B57",
        warning: "#B7791F",
        danger: "#C0392B",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 10px 28px rgba(191, 0, 255, 0.12)",
      },
      borderRadius: {
        card: "12px",
      },
    },
  },
  plugins: [],
};
