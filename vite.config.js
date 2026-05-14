import { defineConfig } from "vite";

const repoBase = "/HexaMountains/";

export default defineConfig({
  base: repoBase,
  server: {
    host: "0.0.0.0",
    port: 5174,
  },
});
