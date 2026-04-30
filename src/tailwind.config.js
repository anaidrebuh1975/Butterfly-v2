/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        natural: {
          50: "#FCFDFF",
          100: "#F3F6F9",
          200: "#E9EDF2",
          600: "#64748B",
          700: "#475569",
          800: "#1E293B",
          900: "#0F172A",
        },
      },
    },
  },
  plugins: [],
};