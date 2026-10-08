import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/ui",
  timeout: 45000,
  workers: 2,
  fullyParallel: true,
  reporter: [["list"], ["json", { outputFile: "docs/ui-test-results.json" }]],
  use: {
    baseURL: "http://localhost:5173",
    viewport: { width: 1680, height: 1000 },
    launchOptions: {
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || "/usr/bin/chromium",
      args: ["--no-sandbox"],
    },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
});
