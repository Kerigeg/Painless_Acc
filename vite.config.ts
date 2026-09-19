import { defineConfig } from "vite";
// The same API handler is used by the production server.
// @ts-expect-error JS server is tested independently with Vitest.
import { createEnkaHandler } from "./server/enka.mjs";
export default defineConfig({
  plugins: [
    {
      name: "public-showcase",
      configureServer(server) {
        server.middlewares.use(createEnkaHandler());
      },
      configurePreviewServer(server) {
        server.middlewares.use(createEnkaHandler());
      },
    },
  ],
});
