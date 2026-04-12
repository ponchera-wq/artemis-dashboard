#!/usr/bin/env node
/**
 * verify-phase.mjs
 * Usage: node scripts/verify-phase.mjs <url-path> <phase-label>
 * Example: node scripts/verify-phase.mjs /index.html phase-1a-baseline
 *
 * Starts a local http-server, launches Playwright (desktop + mobile),
 * captures console errors and page errors, takes screenshots, and
 * exits 0 only if both viewports are clean.
 *
 * Also runs element-position assertions from scripts/verify-assertions.json.
 */

import { chromium } from '@playwright/test';
import { spawn } from 'child_process';
import { mkdirSync, readFileSync, existsSync } from 'fs';
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

// --- Load assertions for the current URL path ---
function loadAssertions(path) {
  const assertionsFile = resolve(__dirname, 'verify-assertions.json');
  if (!existsSync(assertionsFile)) return [];
  try {
    const all = JSON.parse(readFileSync(assertionsFile, 'utf8'));
    return all[path] || [];
  } catch (e) {
    console.warn(`Warning: could not parse verify-assertions.json: ${e.message}`);
    return [];
  }
}

// --- Run a single assertion in the browser ---
// Returns { passed: bool, message: string }
async function runAssertion(page, selector, rule) {
  const result = await page.evaluate(
    ({ selector, rule }) => {
      const el = document.querySelector(selector);

      // Parse rule
      const topLtMatch = rule.match(/^top<(\d+)$/);
      const topGtMatch = rule.match(/^top>(\d+)$/);

      if (rule === 'visible') {
        if (!el) return { passed: false, message: `selector "${selector}" not found in DOM` };
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        if (rect.width === 0 || rect.height === 0)
          return { passed: false, message: `selector "${selector}" has zero dimensions (w:${rect.width} h:${rect.height})` };
        if (style.display === 'none')
          return { passed: false, message: `selector "${selector}" has display:none` };
        if (style.visibility === 'hidden')
          return { passed: false, message: `selector "${selector}" has visibility:hidden` };
        return { passed: true, message: `"${selector}" visible (${rect.width}x${rect.height} at top:${rect.top})` };

      } else if (rule === 'hidden') {
        if (!el) return { passed: true, message: `"${selector}" not in DOM (hidden ✓)` };
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        if (rect.width === 0 || rect.height === 0)
          return { passed: true, message: `"${selector}" has zero dimensions (hidden ✓)` };
        if (style.display === 'none')
          return { passed: true, message: `"${selector}" has display:none (hidden ✓)` };
        if (style.visibility === 'hidden')
          return { passed: true, message: `"${selector}" has visibility:hidden (hidden ✓)` };
        return { passed: false, message: `selector "${selector}" is visible but expected hidden (${rect.width}x${rect.height} at top:${rect.top})` };

      } else if (topLtMatch) {
        const threshold = parseInt(topLtMatch[1], 10);
        if (!el) return { passed: false, message: `selector "${selector}" not found in DOM` };
        const rect = el.getBoundingClientRect();
        if (rect.top < threshold)
          return { passed: true, message: `"${selector}" top:${rect.top} < ${threshold} ✓` };
        return { passed: false, message: `"${selector}" top:${rect.top} is NOT < ${threshold}` };

      } else if (topGtMatch) {
        const threshold = parseInt(topGtMatch[1], 10);
        if (!el) return { passed: false, message: `selector "${selector}" not found in DOM` };
        const rect = el.getBoundingClientRect();
        if (rect.top > threshold)
          return { passed: true, message: `"${selector}" top:${rect.top} > ${threshold} ✓` };
        return { passed: false, message: `"${selector}" top:${rect.top} is NOT > ${threshold}` };

      } else {
        return { passed: false, message: `unknown rule "${rule}"` };
      }
    },
    { selector, rule }
  );
  return result;
}

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
async function runViewport(browser, label, viewportConfig, targetUrl, screenshotPath, assertions) {
  const context = await browser.newContext(viewportConfig);
  const page = await context.newPage();

  const consoleErrors = [];
  const pageErrors = [];
  const assertionResults = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Skip browser-generated noise that is not application JS errors:
      // - "Failed to load resource" — network-level 404s from static server
      // - "Permissions policy violation" — browser security policy enforcement
      if (text.startsWith('Failed to load resource')) return;
      if (text.startsWith('Permissions policy violation')) return;
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

  // Run element-position assertions
  for (const { selector, rule } of assertions) {
    const result = await runAssertion(page, selector, rule);
    assertionResults.push({ selector, rule, ...result });
  }

  await page.screenshot({ path: screenshotPath, fullPage: false });

  await context.close();

  const assertionFailures = assertionResults.filter((r) => !r.passed);
  const allErrors = [...consoleErrors, ...pageErrors];
  const passed = allErrors.length === 0 && assertionFailures.length === 0;

  return { label, passed, consoleErrors, pageErrors, assertionResults, screenshotPath };
}

// --- Main ---
async function main() {
  const targetUrl = `${BASE_URL}${urlPath}`;
  const assertions = loadAssertions(urlPath);

  console.log(`\nVerification harness — ${phaseLabel}`);
  console.log(`URL: ${targetUrl}`);
  if (assertions.length > 0) {
    console.log(`Assertions: ${assertions.length} loaded for ${urlPath}`);
  }
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
        desktopScreenshot,
        assertions
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
        mobileScreenshot,
        assertions
      ),
    ]);

    // Print results
    for (const result of [desktopResult, mobileResult]) {
      const errCount = result.consoleErrors.length + result.pageErrors.length;
      const assertFails = result.assertionResults.filter((r) => !r.passed);
      const status = result.passed ? 'PASS' : 'FAIL';

      console.log(
        `\n${result.label.toUpperCase()}: ${status} | errors: ${errCount} | assertions: ${result.assertionResults.length} | screenshot: ${result.screenshotPath}`
      );

      if (!result.passed) {
        exitCode = 1;
        for (const msg of [...result.consoleErrors, ...result.pageErrors]) {
          console.log(`  ${msg}`);
        }
        for (const a of assertFails) {
          console.log(`  ASSERT FAIL [${a.selector}] rule="${a.rule}": ${a.message}`);
        }
      } else {
        // Print passing assertions too so we can confirm them in the log
        for (const a of result.assertionResults) {
          console.log(`  ASSERT PASS [${a.selector}] rule="${a.rule}": ${a.message}`);
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
