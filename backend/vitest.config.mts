import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    fileParallelism: false, // test files share one database, so run them one by one
    env: {
      DATABASE_URL: "postgresql://sharma@localhost:5432/event_platform_test",
      JWT_SECRET: "test-secret-test-secret-test-secret",
      NODE_ENV: "test",
    },
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      reporter: ["text"],
    },
  },
});