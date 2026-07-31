import { defineConfig, devices } from "@playwright/test";

const e2ePort = Number.parseInt(process.env.ASM_E2E_PORT ?? "4173", 10);
const baseURL = `http://127.0.0.1:${e2ePort}/asm/`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "node tests/serve-static.mjs",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 20_000,
  },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 5"] },
    },
  ],
});
