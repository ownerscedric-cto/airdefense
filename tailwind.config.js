/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "media",
  theme: {
    extend: {
      colors: {
        cat: {
          prep: "#888780",
          measure: "#7F77DD",
          heat: "#D85A30",
          wet: "#1D9E75",
          wait: "#BA7517",
          vent: "#378ADD",
          finish: "#888780",
        },
      },
      fontFamily: {
        sans: [
          "system-ui",
          "-apple-system",
          "Apple SD Gothic Neo",
          "Pretendard",
          "Malgun Gothic",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
