import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "./test-results",
  fullyParallel: true,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  /* Browser tests run against a production build with their own throwaway database,
     prisma/test.db, deleted, recreated and seeded on every run, so they never touch prisma/dev.db. */
  webServer: {
    command: `rm -f prisma/test.db prisma/test.db-journal && npx prisma db push --skip-generate && npm run db:seed && npm run build && npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 240_000,
    env: {
      DATABASE_URL: "file:./test.db",
      SESSION_SECRET: "playwright-only-session-secret-0123456789abcdef",
    },
  },
});
