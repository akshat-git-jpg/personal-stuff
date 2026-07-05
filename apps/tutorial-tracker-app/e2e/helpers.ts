import type { Page } from "@playwright/test";

// Dev personas — must match scripts/seed-local.ts + DEV_PERSONAS in src/App.tsx.
export const PERSONAS = {
  sean: "seankerman25@gmail.com",     // Admin, Reviewer
  sam: "kushalbakliwal25@gmail.com",  // Scriptwriter, Recorder
  anusha: "khushibakliwal125@gmail.com", // Recorder
  john: "akshatpatidar17@gmail.com",  // Video Editor
  tara: "tara@dev.local",             // Thumbnail Maker
  uma: "uma@dev.local",               // Uploader
  riya: "riya@dev.local",             // Reviewer
} as const;

/** Sign in via the dev-login backdoor (no Google / password) and land on the board. */
export async function loginAs(page: Page, email: string) {
  await page.goto(`/dev-login?email=${encodeURIComponent(email)}`);
  await page.waitForURL("**/");
  await page.waitForLoadState("networkidle");
}
