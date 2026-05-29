#!/usr/bin/env node
// Take an authenticated screenshot of BTM "Meine Woche" in dark glass mode.
// Uses request interception to inject Bearer token into /api/* calls so the
// React AuthContext sees an authenticated user.

import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const SHOTS = '/tmp';
await mkdir(SHOTS, { recursive: true });

const BASE = 'https://btm.bethesna.org';
const TOKEN = 'btm_IqtpL5p2OYA-LmTZ6wyO9dfIu0iA6nb3';

console.log('Launching browser...');
const browser = await chromium.launch({ headless: true });

const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  locale: 'de-DE',
});

const page = await ctx.newPage();

// Intercept /api/* requests to inject the bearer token
// This makes apiFetch('/me') return an authenticated user
await page.route('**/api/**', async (route) => {
  const req = route.request();
  // Don't intercept SSE or non-GET streaming
  const url = req.url();

  const headers = {
    ...req.headers(),
    'Authorization': `Bearer ${TOKEN}`,
  };

  try {
    await route.continue({ headers });
  } catch {
    // Route may have already been handled
  }
});

// Set dark glass theme BEFORE navigating (will be read by main.tsx on load)
// We set it via addInitScript so it runs before any JS
await ctx.addInitScript(() => {
  // main.tsx reads btm.tweaks.v1 to set initial body[data-theme]
  // App.tsx reads btm.theme.v1 for React state (which then sets body[data-theme])
  // Both keys must be set to 'glass-dark' for the dark glassmorphism look
  localStorage.setItem('btm.tweaks.v1', JSON.stringify({ theme: 'glass-dark' }));
  localStorage.setItem('btm.theme.v1', 'glass-dark');
});

// Navigate to the app
console.log('Navigating to', BASE);
await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });

// Wait for React to mount and auth to resolve
console.log('Waiting for app to initialize...');
await page.waitForTimeout(4000);

console.log('Title:', await page.title());

// Check auth status
const bodyTheme = await page.evaluate(() => document.body?.dataset?.theme);
const isLogin = await page.locator('input[type=email]').isVisible().catch(() => false);
const isLanding = await page.locator('text=/Bethesna Task Management|Plane deine Woche/i').first().isVisible().catch(() => false);
console.log('body[data-theme]:', bodyTheme);
console.log('Is login screen:', isLogin);
console.log('Is landing page:', isLanding);

// Check if sidebar is visible (authenticated state)
const hasSidebar = await page.locator('text=/Meine Woche/i').first().isVisible().catch(() => false);
console.log('Has Meine Woche in sidebar:', hasSidebar);

// Diagnostic screenshot
await page.screenshot({ path: '/tmp/btm-state-diag.png', fullPage: false });
console.log('Diagnostic screenshot saved');

if (hasSidebar) {
  // Navigate to Meine Woche — click the first occurrence (sidebar link)
  await page.locator('text=/Meine Woche/i').first().click();
  await page.waitForTimeout(2000);
  console.log('Clicked Meine Woche');
} else {
  console.log('Not authenticated — checking page state...');
  const pt = await page.evaluate(() => document.body?.innerText?.substring(0, 800));
  console.log('Page text:', pt);
}

// Ensure dark glass theme is active
await page.evaluate(() => {
  document.body.dataset.theme = 'glass-dark';
  localStorage.setItem('btm.tweaks.v1', JSON.stringify({ theme: 'glass-dark' }));
  localStorage.setItem('btm.theme.v1', 'glass-dark');
});

await page.waitForTimeout(1000);

// Final theme check
const finalTheme = await page.evaluate(() => document.body?.dataset?.theme);
console.log('Final theme:', finalTheme);

// Take final screenshot
await page.screenshot({ path: '/tmp/btm-myweek-dark.png', fullPage: false });
console.log('Screenshot saved: /tmp/btm-myweek-dark.png');

await browser.close();
console.log('Done.');
