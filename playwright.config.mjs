import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
export default defineConfig({
  testDir: "tests/ui",
  timeout: 45000,
  workers: 2,
  fullyParallel: true,
  reporter: [["list"], ["json", { outputFile: "docs/ui-test-results.json" }]],
  webServer: { command: "npm run dev", url: "http://localhost:5173", reuseExistingServer: !process.env.CI, timeout: 30000 },
  use: {
    baseURL: "http://localhost:5173",
    viewport: { width: 1680, height: 1000 },
    launchOptions: {
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
      args: ["--no-sandbox"],
    },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
});
