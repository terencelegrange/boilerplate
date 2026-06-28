import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    globalSetup: ["src/test/globalSetup.ts"],
    setupFiles: ["src/test/setup.ts"],
    fileParallelism: false,
    testTimeout: 15000,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/lib/**", "src/app/api/**", "src/middleware.ts"],
      exclude: ["src/lib/prisma.ts"],
    },
  },
});
