export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        line: {
          verde: "#07AC56",
          amarela: "#FFB83B",
          azul: "#467DED",
          vermelha: "#E7343F",
        },
      },
    },
  },
  darkMode: ["class", '[data-theme="dark"]'],
};
