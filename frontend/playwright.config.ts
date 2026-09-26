import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  use: {
    baseURL: "http://127.0.0.1:8001",
    headless: true,
    channel: "chrome",
    viewport: { width: 1440, height: 1000 },
    screenshot: "only-on-failure",
  },
  reporter: "list",
  webServer: {
    command:
      '"../.venv/Scripts/python.exe" -m uvicorn backend.tests.e2e_server:app --app-dir .. --host 127.0.0.1 --port 8001',
    url: "http://127.0.0.1:8001/api/health",
    reuseExistingServer: true,
    env: {
      SPENDSHIELD_E2E: "1",
      SPENDSHIELD_DB: resolve("../data/e2e.sqlite3"),
      GEMINI_API_KEY: "",
    },
  },
});
