#!/usr/bin/env node
// Navigate to BTM, authenticate via API token cookie injection, go to Meine Woche, screenshot.

import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const SHOTS = '/tmp';
await mkdir(SHOTS, { recursive: true });

const URL = 'https://btm.bethesna.org';
const TOKEN = 'btm_IqtpL5p2OYA-LmTZ6wyO9dfIu0iA6nb3';

console.log('Launching browser...');
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  locale: 'de-DE',
});
const page = await ctx.newPage();

// Navigate first to get the domain context
await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
console.log('Initial load done, title:', await page.title());

// Check if we're on login screen
const isLogin = await page.locator('input[type=email]').isVisible().catch(() => false);
console.log('Is login screen:', isLogin);

if (isLogin) {
  // Try to authenticate via localStorage with the bearer token
  // The app checks for cookie sessions, but we can try setting auth state
  console.log('On login screen, attempting to authenticate via API...');

  // Use the API token to fetch a valid session by calling /api/me with the bearer token
  // and inject any cookies returned
  const result = await page.evaluate(async (token) => {
    const r = await fetch('/api/me', {
      headers: { 'Authorization': `Bearer ${token}` },
      credentials: 'include'
    });
    return { ok: r.ok, status: r.status, body: await r.json() };
  }, TOKEN);
  console.log('/api/me with bearer:', JSON.stringify(result));

  if (result.ok) {
    // Store token in localStorage so app might pick it up
    await page.evaluate((token) => {
      localStorage.setItem('btm.apiToken', token);
      // Try setting dark glass theme while we're here
      const cur = JSON.parse(localStorage.getItem('btm.tweaks.v1') || '{}');
      localStorage.setItem('btm.tweaks.v1', JSON.stringify({ ...cur, theme: 'glass' }));
    }, TOKEN);

    // Reload to see if app picks up the token
    await page.reload({ waitUntil: 'networkidle', timeout: 20000 });
    console.log('After reload, title:', await page.title());
  }
}

// Take a screenshot to see current state
await page.screenshot({ path: '/tmp/btm-state-1.png', fullPage: false });
console.log('State screenshot saved');

// Check state again
const isLoginAgain = await page.locator('input[type=email]').isVisible().catch(() => false);
const bodyDataTheme = await page.evaluate(() => document.body?.dataset?.theme);
console.log('Is login after reload:', isLoginAgain, 'theme:', bodyDataTheme);

// Look for sidebar navigation items
const sidebarText = await page.evaluate(() => {
  const sidebar = document.querySelector('nav, aside, [class*="sidebar"], [class*="nav"]');
  return sidebar ? sidebar.innerText?.substring(0, 500) : 'no sidebar found';
});
console.log('Sidebar content:', sidebarText);

// Try to find "Meine Woche" link
const meineWocheLink = page.locator('text=/Meine Woche/i').first();
const meineWocheVisible = await meineWocheLink.isVisible().catch(() => false);
console.log('Meine Woche link visible:', meineWocheVisible);

if (meineWocheVisible) {
  await meineWocheLink.click();
  await page.waitForTimeout(2000);
  console.log('Clicked Meine Woche');
}

// Ensure dark glass mode
await page.evaluate(() => {
  const cur = JSON.parse(localStorage.getItem('btm.tweaks.v1') || '{}');
  localStorage.setItem('btm.tweaks.v1', JSON.stringify({ ...cur, theme: 'glass' }));
});

// Wait for any animations
await page.waitForTimeout(1500);

// Final screenshot
await page.screenshot({ path: '/tmp/btm-myweek-dark.png', fullPage: false });
console.log('Final screenshot saved: /tmp/btm-myweek-dark.png');

// Log page structure for debugging
const pageText = await page.evaluate(() => document.body?.innerText?.substring(0, 1000));
console.log('Page content preview:', pageText);

await browser.close();
console.log('Done.');
