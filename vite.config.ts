import { defineConfig } from "vite";
// The same API handler is used by the production server.
// @ts-expect-error JS server is tested independently with Vitest.
import { createEnkaHandler } from "./server/enka.mjs";
// @ts-expect-error JS server tested with Vitest.
import { createAccounts } from "./server/accounts.mjs";
export default defineConfig({
  plugins: [
    {
      name: "public-showcase",
      configureServer(server) {
        const accounts = createAccounts();
        server.middlewares.use(accounts.handler);
        server.middlewares.use(createEnkaHandler());
        server.httpServer?.once("close", () => accounts.close());
      },
      configurePreviewServer(server) {
        const accounts = createAccounts();
        server.middlewares.use(accounts.handler);
        server.middlewares.use(createEnkaHandler());
        server.httpServer?.once("close", () => accounts.close());
      },
    },
  ],
});
