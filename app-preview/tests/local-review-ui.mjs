import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
const errors = [];
const external = [];
page.on('pageerror', (error) => errors.push(error.message));
await page.route('**/*', (route) => {
  const url = new URL(route.request().url());
  if (url.hostname !== '127.0.0.1') { external.push(url.origin); return route.abort(); }
  return route.continue();
});
await mkdir('local-review-evidence', { recursive: true });
const open = () => page.goto('http://127.0.0.1:5187/preview/');
const waitText = (text) => page.getByText(text, { exact: false }).first().waitFor();
try {
  await open();
  await page.getByRole('button', { name: 'Get feedback', exact: true }).first().click();
  await page.locator('#rootCause').fill('The electrical lead was absent from the coordination review.');
  await waitText('This feedback is based on an earlier version');
  console.log('PASS: an edit during the request marks the returned feedback as stale.');
  await page.getByRole('button', { name: 'Get new feedback', exact: true }).first().click();
  await waitText('Identify why the coordination check was missed');
  assert.equal(await page.getByText('This feedback is based on an earlier version', { exact: false }).count(), 0);
  await page.locator('#recommendation').fill('The electrical lead will sign off clearances before installation.');
  await waitText('This feedback is based on an earlier version');
  await page.screenshot({ path: 'local-review-evidence/01-feedback-version-warning.png', fullPage: true });
  console.log('PASS: refreshed feedback becomes current; changes to related fields invalidate it again.');

  await page.getByRole('button', { name: 'Generate keywords', exact: true }).click();
  await page.locator('#preview-keywords').fill('coordination, my manual addition');
  await waitText('Review suggested keywords');
  assert.equal(await page.locator('#preview-keywords').inputValue(), 'coordination, my manual addition');
  await page.screenshot({ path: 'local-review-evidence/02-review-keyword-suggestions.png', fullPage: true });
  await page.getByRole('checkbox', { name: 'BIM coordination', exact: true }).uncheck();
  await page.getByRole('button', { name: 'Add selected keywords' }).click();
  const added = await page.locator('#preview-keywords').inputValue();
  assert(added.includes('my manual addition'));
  assert(added.includes('ductwork clearance'));
  assert(!added.includes('BIM coordination'));
  console.log('PASS: explicit acceptance preserves manual edits and respects selected keywords.');

  await page.getByRole('button', { name: 'Generate keywords', exact: true }).click();
  await waitText('Review suggested keywords');
  await page.locator('#preview-title').fill('A revised lesson title');
  await waitText('Generate new keywords before accepting');
  assert.equal(await page.getByRole('button', { name: 'Add selected keywords' }).isDisabled(), true);
  console.log('PASS: stale keyword suggestions cannot be accepted.');

  await page.getByRole('button', { name: 'Dismiss', exact: true }).click();
  await page.locator('#response-mode').selectOption('error');
  await page.getByRole('button', { name: 'Generate keywords', exact: true }).click();
  await waitText('AI service did not return usable suggestions');
  assert.equal(await page.locator('#preview-keywords').inputValue(), added);
  console.log('PASS: a simulated HTTP-success/service-unavailable reply does not become keywords.');

  await page.locator('#response-mode').selectOption('success');
  await page.getByRole('button', { name: 'Generate keywords', exact: true }).click();
  await page.getByRole('button', { name: 'Stop waiting', exact: true }).click();
  await page.waitForTimeout(1100);
  assert.equal(await page.getByText('Review suggested keywords', { exact: true }).count(), 0);
  console.log('PASS: a cancelled request cannot restore late suggestions.');

  await page.setViewportSize({ width: 390, height: 844 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  console.log('PASS: preview has no horizontal overflow at 390px.');
  assert.deepEqual(errors, []);
  assert.deepEqual(external, []);
  console.log('7 UI checks passed; no page errors or external network requests.');
} finally { await browser.close(); }
