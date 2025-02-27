/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,svelte}",
  ],
  safelist: [
    "w-4",
    "h-4",
  ],
  theme: {
    extend: {},
    colors: {
      transparent: "transparent",
      black: "#0f0f0e",
      white: "#FFFCF2",
      accent: "#EB5E28",
      light: "#CCC5B9",
      shimmer: "#544e46",
      medium: "#403D39",
      dark: "#252422",
      danger: "#ff0000",
      warning: "#ebd112",
      success: "#37ab51",
      placeholder: "#a19989",
    },
  },
  plugins: [],
}
