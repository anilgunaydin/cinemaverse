import { test as setup, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

const AUTH_FILE = "tests/e2e/.auth/user.json";

setup("authenticate as Anıl", async ({ browser }) => {
  // Ensure auth directory exists
  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });

  const context = await browser.newContext();
  const page = await context.newPage();

  // Use the API directly to login (passwordless for anil@cinemaverse.local)
  const response = await page.request.post("http://localhost:3000/api/auth/login", {
    data: {
      email: "anil@cinemaverse.local",
      password: "admin",
    },
  });

  expect(response.ok()).toBeTruthy();
  const data = await response.json();
  expect(data.user).toBeTruthy();

  // Save storage state
  await context.storageState({ path: AUTH_FILE });
  await context.close();
});