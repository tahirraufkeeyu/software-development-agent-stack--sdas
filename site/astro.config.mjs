// @ts-check
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://skillkit.dev",
  trailingSlash: "never",
  build: {
    format: "directory",
  },
  markdown: {
    syntaxHighlight: "shiki",
    shikiConfig: {
      themes: {
        light: "github-light",
        dark: "github-dark",
      },
      wrap: true,
    },
    gfm: true,
  },
  devToolbar: {
    enabled: false,
  },
  server: {
    port: 4321,
  },
});
