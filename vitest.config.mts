import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/unit/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/unit/setup.ts"],
    globalSetup: ["./tests/unit/global-setup.ts"],
    include: ["tests/unit/**/*.test.{ts,tsx}"],
    css: false,
    env: {
      DATABASE_URL: "file:./unit.db",
      SESSION_SECRET: "unit-test-secret-that-is-long-enough-123456",
      UPLOAD_DIR: "storage/unit-uploads",
    },
  },
});
