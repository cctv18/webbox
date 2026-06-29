import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["packages/**/*.test.ts", "apps/**/*.test.tsx"],
    testTimeout: 20000
  },
  resolve: {
    alias: {
      "@webbox/shared": new URL("./packages/shared/src/index.ts", import.meta.url).pathname,
      "@webbox/plugin-compat": new URL("./packages/plugin-compat/src/index.ts", import.meta.url).pathname
    }
  }
});
