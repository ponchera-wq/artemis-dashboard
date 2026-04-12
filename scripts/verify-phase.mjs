#!/usr/bin/env node
/**
 * verify-phase.mjs
 * Usage: node scripts/verify-phase.mjs <url-path> <phase-label>
 * Example: node scripts/verify-phase.mjs /index.html phase-1a-baseline
 *
 * Starts a local http-server, launches Playwright (desktop + mobile),
 * captures console errors and page errors, takes screenshots, and
 * exits 0 only if both viewports are clean.
 */

import { chromium } from '@playwright/test';
import { spawn } from 'child_process';
import { mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

// --- CLI args ---
const [, , urlPath, phaseLabel] = process.argv;
if (!urlPath || !phaseLabel) {
  console.error('Usage: node scripts/verify-phase.mjs <url-path> <phase-label>');
  process.exit(1);
}

const PORT = 8765;
const BASE_URL = `http://localhost:${PORT}`;
const SCREENSHOTS_DIR = resolve(repoRoot, 'automation', 'screenshots');

mkdirSync(SCREENSHOTS_DIR, { recursive: true });

// --- Start http-server ---
function startServer() {
  return new Promise((resolve, reject) => {
    const server = spawn(
      'npx',
      ['http-server', '.', '-p', String(PORT), '-s', '-c-1', '--cors'],
      { cwd: repoRoot, stdio: ['ignore', 'pipe', 'pipe'] }
    );

    let ready = false;

    const onData = (data) => {
      const text = data.toString();
      if (!ready && (text.includes(`${PORT}`) || text.includes('Available on'))) {
        ready = true;
        resolve(server);
      }
    };

    server.stdout.on('data', onData);
    server.stderr.on('data', onData);

    server.on('error', reject);

    // Fallback: give the server 3 seconds to start regardless
    setTimeout(() => {
      if (!ready) {
        ready = true;
        resolve(server);
      }
    }, 3000);
  });
}

// --- Wait for server to respond ---
async function waitForServer(url, timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const { default: http } = await import('http');
      await new Promise((res, rej) => {
        const req = http.get(url, (r) => { r.resume(); res(); });
        req.on('error', rej);
        req.setTimeout(1000, () => { req.destroy(); rej(new Error('timeout')); });
      });
      return; // success
    } catch {
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  throw new Error(`Server at ${url} did not become ready within ${timeoutMs}ms`);
}

// --- Run one viewport ---
async function runViewport(browser, label, viewportConfig, targetUrl, screenshotPath) {
  const context = await browser.newContext(viewportConfig);
  const page = await context.newPage();

  const consoleErrors = [];
  const pageErrors = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Skip browser-generated "Failed to load resource" messages — these are
      // network-level events auto-logged by the browser (e.g. 404 from /api/ship
      // on a static server). They are not application JS errors.
      if (text.startsWith('Failed to load resource')) return;
      consoleErrors.push(`[console.error] ${text}`);
    }
  });

  page.on('pageerror', (err) => {
    pageErrors.push(`[pageerror] ${err.message}`);
  });

  try {
    await page.goto(targetUrl, { timeout: 15000, waitUntil: 'domcontentloaded' });
    // Wait for networkidle or 3 seconds, whichever comes first
    await Promise.race([
      page.waitForLoadState('networkidle', { timeout: 3000 }),
      new Promise((r) => setTimeout(r, 3000)),
    ]).catch(() => {});
  } catch (err) {
    pageErrors.push(`[navigation] ${err.message}`);
  }

  await page.screenshot({ path: screenshotPath, fullPage: false });

  await context.close();

  const allErrors = [...consoleErrors, ...pageErrors];
  const passed = allErrors.length === 0;

  return { label, passed, consoleErrors, pageErrors, screenshotPath };
}

// --- Main ---
async function main() {
  const targetUrl = `${BASE_URL}${urlPath}`;
  console.log(`\nVerification harness — ${phaseLabel}`);
  console.log(`URL: ${targetUrl}`);
  console.log('─'.repeat(60));

  let server;
  let browser;
  let exitCode = 0;

  try {
    console.log('Starting http-server…');
    server = await startServer();
    await waitForServer(`${BASE_URL}/`);
    console.log(`Server ready on port ${PORT}`);

    browser = await chromium.launch({ headless: true });

    const desktopScreenshot = resolve(SCREENSHOTS_DIR, `${phaseLabel}-desktop.png`);
    const mobileScreenshot = resolve(SCREENSHOTS_DIR, `${phaseLabel}-mobile.png`);

    const [desktopResult, mobileResult] = await Promise.all([
      runViewport(
        browser,
        'desktop',
        { viewport: { width: 1440, height: 900 } },
        targetUrl,
        desktopScreenshot
      ),
      runViewport(
        browser,
        'mobile',
        {
          viewport: { width: 390, height: 844 },
          isMobile: true,
          hasTouch: true,
        },
        targetUrl,
        mobileScreenshot
      ),
    ]);

    // Print results
    for (const result of [desktopResult, mobileResult]) {
      const status = result.passed ? 'PASS' : 'FAIL';
      const errCount = result.consoleErrors.length + result.pageErrors.length;
      console.log(
        `\n${result.label.toUpperCase()}: ${status} | errors: ${errCount} | screenshot: ${result.screenshotPath}`
      );
      if (!result.passed) {
        exitCode = 1;
        for (const msg of [...result.consoleErrors, ...result.pageErrors]) {
          console.log(`  ${msg}`);
        }
      }
    }

    console.log('\n' + '─'.repeat(60));
    if (exitCode === 0) {
      console.log('Result: PASS — both viewports clean');
    } else {
      console.log('Result: FAIL — see errors above');
    }
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (server) {
      server.kill('SIGTERM');
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  process.exit(exitCode);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
