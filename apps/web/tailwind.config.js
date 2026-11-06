/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        deep: "#24104A",
        purple: "#5B2FC0",
        mid: "#7C4DDB",
        soft: "#EFE9FB",
        pale: "#F7F4FD",
        line: "#E0D6F4",
        ink: "#1F1237",
        muted: "#6B6385",
        success: "#2E8B57",
        warning: "#B7791F",
        danger: "#C0392B",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 8px 24px rgba(36, 16, 74, 0.08)",
      },
      borderRadius: {
        card: "12px",
      },
    },
  },
  plugins: [],
};
