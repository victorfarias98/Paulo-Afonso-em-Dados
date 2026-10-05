import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/**/src/**/*.test.ts", "apps/**/src/**/*.test.ts"],
    // Os testes de integração compartilham um banco e o esvaziam a cada teste.
    fileParallelism: false,
    coverage: {
      provider: "v8",
      include: ["packages/*/src/**/*.ts", "apps/worker/src/**/*.ts"],
      exclude: ["**/*.test.ts", "**/__fixtures__/**", "packages/database/src/schema/**"],
    },
  },
});
