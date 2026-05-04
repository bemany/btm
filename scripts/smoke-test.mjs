#!/usr/bin/env node
// Playwright-Smoke-Test gegen die Live-App auf btm.bethesna.org.
// Macht Screenshots in /tmp/btm-shots/ damit ich sie als Bilder lesen kann.

import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const SHOTS = '/tmp/btm-shots';
await mkdir(SHOTS, { recursive: true });

const URL = process.env.BTM_URL || 'https://btm.bethesna.org/';

console.log(`▶ Smoke-Test gegen ${URL}`);
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  locale: 'de-DE',
});
const page = await ctx.newPage();

const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
});

// 1. Initial-Load → sollte Login-Screen zeigen (anon)
await page.goto(URL, { waitUntil: 'networkidle', timeout: 20000 });
await page.screenshot({ path: `${SHOTS}/01-login.png`, fullPage: true });
console.log(`✓ 01-login.png`);

// 2. App-Title check
const title = await page.title();
console.log(`  title: "${title}"`);

// 3. Login-Screen rendert?
const heading = await page.locator('h1').first().textContent({ timeout: 5000 }).catch(() => null);
console.log(`  H1: "${heading}"`);

// 4. Email-Input vorhanden?
const emailInput = page.locator('input[type=email]');
const emailVisible = await emailInput.isVisible().catch(() => false);
console.log(`  email input visible: ${emailVisible}`);

// 5. Glass-Theme: data-theme attribute
const theme = await page.evaluate(() => document.body.dataset.theme);
console.log(`  body[data-theme]: ${theme}`);

// 6. Manifest + Service-Worker
const manifestStatus = await page.evaluate(async () => {
  const r = await fetch('/manifest.webmanifest');
  return { ok: r.ok, ct: r.headers.get('content-type') };
});
console.log(`  manifest.webmanifest: ${JSON.stringify(manifestStatus)}`);

const swStatus = await page.evaluate(async () => {
  const r = await fetch('/sw.js');
  return { ok: r.ok };
});
console.log(`  sw.js: ${JSON.stringify(swStatus)}`);

const apiHealth = await page.evaluate(async () => {
  const r = await fetch('/api/healthz');
  return { ok: r.ok, body: await r.json() };
});
console.log(`  /api/healthz: ${JSON.stringify(apiHealth)}`);

const apiMe = await page.evaluate(async () => {
  const r = await fetch('/api/me', { credentials: 'include' });
  return { ok: r.ok, body: await r.json() };
});
console.log(`  /api/me (anon): ${JSON.stringify(apiMe)}`);

// 7. Magic-Link-Anfrage durchspielen (versendet eine echte Mail!)
//    Nur wenn explizit angefordert via env BTM_SEND_MAIL=1
if (process.env.BTM_SEND_MAIL === '1') {
  await emailInput.fill('esref@bemany.de');
  await page.locator('button[type=submit]').click();
  await page.waitForSelector('text=/Mail unterwegs|wir haben dir/i', { timeout: 8000 });
  await page.screenshot({ path: `${SHOTS}/02-mail-sent.png`, fullPage: true });
  console.log(`✓ 02-mail-sent.png`);
}

// 8. Studio-Theme via direktem localStorage-Toggle (Glass ist Default)
await page.evaluate(() => {
  const cur = JSON.parse(localStorage.getItem('btm.tweaks.v1') || '{}');
  localStorage.setItem('btm.tweaks.v1', JSON.stringify({ ...cur, theme: 'default' }));
});
await page.reload({ waitUntil: 'networkidle' });
await page.screenshot({ path: `${SHOTS}/03-login-studio.png`, fullPage: true });
console.log(`✓ 03-login-studio.png`);
const themeAfter = await page.evaluate(() => document.body.dataset.theme);
console.log(`  theme after toggle: ${themeAfter}`);

// 9. Zurück auf Glass für letzten Shot
await page.evaluate(() => {
  const cur = JSON.parse(localStorage.getItem('btm.tweaks.v1') || '{}');
  localStorage.setItem('btm.tweaks.v1', JSON.stringify({ ...cur, theme: 'glass' }));
});

console.log('\n— Errors / Warnings —');
if (errors.length === 0) console.log('  (keine)');
else errors.forEach((e) => console.log(`  ${e}`));

await browser.close();
console.log(`\nFertig. Screenshots: ${SHOTS}/`);
