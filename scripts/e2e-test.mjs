#!/usr/bin/env node
// End-to-End-Test gegen die Live-App. Authentifiziert sich via Magic-Link:
// - feuert /api/auth/sign-in/magic-link
// - holt den verify-Token via SSH aus der Postgres `verifications`-Tabelle
// - navigiert zur verify-URL → Cookie wird gesetzt
// - testet danach: Landing, MyWeek, Wochenboard, Times, Admin, Releases,
//   ChatBubble, Mobile-Viewport
//
// Usage: node scripts/e2e-test.mjs

import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const SHOTS = '/tmp/btm-shots';
await mkdir(SHOTS, { recursive: true });

const URL = process.env.BTM_URL || 'https://btm.bethesna.org/';
const EMAIL = 'esref@bemany.de';
const SSH_KEY = process.env.HOME + '/.ssh/id_ed25519';
const VPS = '142.93.172.15';

function ssh(cmd) {
  return execFileSync('ssh', ['-i', SSH_KEY, '-o', 'StrictHostKeyChecking=no', `root@${VPS}`, cmd], {
    encoding: 'utf8',
  }).trim();
}

async function fetchVerifyToken() {
  // Alte verify-Einträge für diese Email löschen, sonst kann der Token
  // schon attempt-blocked sein (ATTEMPTS_EXCEEDED). Better-Auth lässt
  // pro Token nur 1 Verify zu.
  ssh(
    `docker exec btm-postgres psql -U btm -d btm -c "DELETE FROM verifications WHERE value LIKE '%${EMAIL}%';"`,
  );
  // Trigger Magic-Link
  const r = await fetch(`${URL.replace(/\/$/, '')}/api/auth/sign-in/magic-link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, callbackURL: URL }),
  });
  if (!r.ok) throw new Error(`sign-in/magic-link gab ${r.status}`);
  // Kurz warten — async Mail-Send + DB-Insert
  await new Promise((r) => setTimeout(r, 600));
  const out = ssh(
    `docker exec btm-postgres psql -U btm -d btm -t -A -c "SELECT identifier FROM verifications WHERE value LIKE '%${EMAIL}%' ORDER BY created_at DESC LIMIT 1;"`,
  );
  const token = out.trim();
  if (!token) throw new Error('Kein frischer verify-Token in DB gefunden');
  return token;
}

const errors = [];
function logErr(label, e) {
  errors.push(`${label}: ${e}`);
  console.log(`  ✗ ${label}: ${e}`);
}

console.log(`▶ E2E-Test gegen ${URL}`);

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  locale: 'de-DE',
  ignoreHTTPSErrors: true,
});
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console.error: ${m.text().slice(0, 200)}`);
});

// 1. Landing (anon) ---------------------------------------------------
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
await page.screenshot({ path: `${SHOTS}/01-landing.png`, fullPage: false });
console.log(`✓ 01-landing.png — title: "${await page.title()}"`);

// 2. Login-Screen (Click „Login" auf Landing oder direkt /login) ------
await page.goto(URL.replace(/\/$/, '') + '/login', { waitUntil: 'domcontentloaded' });
await page.screenshot({ path: `${SHOTS}/02-login.png`, fullPage: false });
const emailInput = page.locator('input[type=email]');
console.log(`✓ 02-login.png — email-input visible: ${await emailInput.isVisible()}`);

// 3. Magic-Link-Login durchspielen (kein UI-Klick, direkter Token-Verify)
console.log(`  Trigger magic-link + fetch token aus DB …`);
const verifyToken = await fetchVerifyToken();
console.log(`  Verify-Token: ${verifyToken.slice(0, 12)}…`);

const verifyUrl = `${URL.replace(/\/$/, '')}/api/auth/magic-link/verify?token=${verifyToken}&callbackURL=${encodeURIComponent(URL)}`;
await page.goto(verifyUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
console.log(`  Nach Verify-Redirect: ${page.url()}`);

// 4. Authenticated: Meine Woche -------------------------------------
// kurz warten damit Sync + Render durch sind (statt networkidle, da SSE läuft)
await page.waitForTimeout(1500);
// Onboarding-Tour ggf. schließen falls aktiv (Esref hat sie schon durch)
await page.keyboard.press('Escape').catch(() => {});
// Release-Modal ggf. schließen
const closeBtn = page.locator('.rm-close, .rm-btn.primary').first();
if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
  await closeBtn.click();
  await page.waitForTimeout(300);
}
await page.screenshot({ path: `${SHOTS}/03-week.png`, fullPage: false });
const userName = await page.evaluate(async () => {
  const r = await fetch('/api/me', { credentials: 'include' });
  const d = await r.json();
  return d?.user?.name ?? null;
});
console.log(`✓ 03-week.png — eingeloggt als: ${userName}`);

// 5. Wochenboard -----------------------------------------------------
await page.goto(URL.replace(/\/$/, '') + '/board', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(800);
await page.screenshot({ path: `${SHOTS}/04-board.png`, fullPage: false });
const colCount = await page.locator('.k-col').count();
console.log(`✓ 04-board.png — Kanban-Spalten: ${colCount} (erwartet: 5 für todo/planned/doing/review/done)`);

// 6. Liste-Ansicht ---------------------------------------------------
await page.locator('button:has-text("Liste")').click().catch(() => null);
await page.waitForTimeout(400);
await page.screenshot({ path: `${SHOTS}/05-list.png`, fullPage: false });
console.log(`✓ 05-list.png`);

// 7. Timeline-Ansicht ------------------------------------------------
await page.locator('button:has-text("Timeline")').click().catch(() => null);
await page.waitForTimeout(400);
await page.screenshot({ path: `${SHOTS}/06-timeline.png`, fullPage: false });
console.log(`✓ 06-timeline.png`);

// 8. Gear-Popover öffnen ---------------------------------------------
const gear = page.locator('.board-gear-btn');
if (await gear.isVisible().catch(() => false)) {
  await gear.click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/07-gear.png`, fullPage: false });
  console.log(`✓ 07-gear.png — Gear-Popover sichtbar: ${await page.locator('.board-gear-pop').isVisible()}`);
  // schließen
  await page.keyboard.press('Escape').catch(() => {});
  await page.locator('body').click({ position: { x: 100, y: 100 } });
} else {
  logErr('07-gear', 'Gear-Button nicht sichtbar');
}

// 9. Zeiten-Screen ---------------------------------------------------
await page.goto(URL.replace(/\/$/, '') + '/times', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(800);
await page.screenshot({ path: `${SHOTS}/08-times.png`, fullPage: false });
console.log(`✓ 08-times.png`);

// 10. Releases-Seite -------------------------------------------------
await page.goto(URL.replace(/\/$/, '') + '/releases', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(500);
await page.screenshot({ path: `${SHOTS}/09-releases.png`, fullPage: false });
const relCount = await page.locator('.rel-release').count();
console.log(`✓ 09-releases.png — ${relCount} Release-Einträge`);

// 11. Admin (nur wenn admin) ----------------------------------------
await page.goto(URL.replace(/\/$/, '') + '/admin', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(500);
await page.screenshot({ path: `${SHOTS}/10-admin.png`, fullPage: false });
const adminCards = await page.locator('.admin-user-card').count();
console.log(`✓ 10-admin.png — ${adminCards} User-Karten`);

// 12. ChatBubble öffnen + simple Anfrage ----------------------------
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(500);
const chatFab = page.locator('.cb-fab');
if (await chatFab.isVisible().catch(() => false)) {
  await chatFab.click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/11-chat-open.png`, fullPage: false });
  console.log(`✓ 11-chat-open.png`);
} else {
  logErr('chat-bubble', 'FAB nicht sichtbar');
}

// 13. Mobile-Viewport -----------------------------------------------
await ctx.close();
const mobCtx = await browser.newContext({
  viewport: { width: 375, height: 812 }, // iPhone 12/13
  locale: 'de-DE',
  ignoreHTTPSErrors: true,
});
// Cookies neu setzen via verify
const mobPage = await mobCtx.newPage();
mobPage.on('pageerror', (e) => errors.push(`mobile pageerror: ${e.message}`));
const mobToken = await fetchVerifyToken();
const mobVerify = `${URL.replace(/\/$/, '')}/api/auth/magic-link/verify?token=${mobToken}&callbackURL=${encodeURIComponent(URL)}`;
await mobPage.goto(mobVerify, { waitUntil: 'domcontentloaded', timeout: 15000 });
await mobPage.waitForTimeout(800);
await mobPage.keyboard.press('Escape').catch(() => {});
await mobPage.screenshot({ path: `${SHOTS}/12-mobile-week.png`, fullPage: false });
console.log(`✓ 12-mobile-week.png (375x812)`);

// Mobile-App nutzt 3-Tab-Bottom-Nav statt Hamburger. Prüfen dass die
// 3 Tabs (Heute/Timer/KI) sichtbar sind und durchklickbar.
const tabCount = await mobPage.locator('.ma-tab').count();
console.log(`  Mobile-Tabs gefunden: ${tabCount} (erwartet: 3)`);
if (tabCount !== 3) logErr('mobile-tabs', `Tab-Count ${tabCount} statt 3`);

// 13. Mobile-Tab „Timer"
await mobPage.locator('.ma-tab').nth(1).click().catch(() => null);
await mobPage.waitForTimeout(400);
await mobPage.screenshot({ path: `${SHOTS}/13-mobile-timer.png`, fullPage: false });
console.log(`✓ 13-mobile-timer.png`);

// 14. Mobile-Tab „KI"
await mobPage.locator('.ma-tab').nth(2).click().catch(() => null);
await mobPage.waitForTimeout(400);
await mobPage.screenshot({ path: `${SHOTS}/14-mobile-ki.png`, fullPage: false });
console.log(`✓ 14-mobile-ki.png`);

console.log('\n— Errors / Warnings —');
if (errors.length === 0) console.log('  (keine)');
else errors.forEach((e) => console.log(`  • ${e}`));

await browser.close();
console.log(`\nFertig. Screenshots: ${SHOTS}/`);
console.log(`Errors: ${errors.length}`);
process.exit(errors.length === 0 ? 0 : 1);
