import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';

const portal = process.env.ELWOOD_M6_PORTAL_URL;
test('Portal signs into Azure and creates, edits, validates, tests and deploys a draft',
  { skip: !portal, timeout: 180_000 }, async () => {
    const require = createRequire(import.meta.url);
    const { chromium } = require(process.env.ELWOOD_PLAYWRIGHT_MODULE ?? 'playwright');
    const host = new URL(process.env.ELWOOD_M6_HOST_URL);
    assert.match(host.hostname, /^elwood-m6-api-[a-z0-9]+(?:-[a-z0-9]+)?\.azurewebsites\.net$/);
    assert.equal(host.protocol, 'https:');
    const token = (await readFile(process.env.ELWOOD_M6_HOST_TOKEN_FILE, 'utf8')).trim();
    const browser = await chromium.launch({ headless: true, ...(process.env.ELWOOD_BROWSER_PATH ? { executablePath: process.env.ELWOOD_BROWSER_PATH } : {}) });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on('requestfailed', request => console.log('Browser request failed:', new URL(request.url()).pathname, request.failure()?.errorText));
    const id = 'portal-' + randomUUID(); let created = false;
    try {
      await page.goto(new URL('/pipelines', portal).href);
      await page.getByLabel('Management token', { exact: true }).fill(token);
      await page.getByRole('button', { name: 'Connect', exact: true }).click();
      await page.getByText(process.env.ELWOOD_M6_OPERATOR ?? 'operator', { exact: true }).waitFor();
      await page.getByRole('link', { name: 'New Pipeline', exact: true }).click();
      await page.getByLabel('Pipeline ID', { exact: true }).fill(id);
      const creation = page.waitForResponse(r => r.url() === `${host.origin}/api/pipelines/${id}` && r.request().method() === 'POST');
      await page.getByRole('button', { name: 'Create draft', exact: true }).click();
      assert.equal((await creation).status(), 201); created = true;
      await page.waitForURL(`**/pipelines/${id}`);
      await page.locator('.monaco-editor textarea').first().waitFor();
      await page.locator('.monaco-editor').first().click();
      await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(portal).origin });
      await page.evaluate(text => navigator.clipboard.writeText(text), `version: 2\nname: ${id}\nmode: sync\nttlSeconds: 30\nsources:\n  - { name: input, trigger: http, endpoint: /${id} }\noutputs:\n  - { name: result, response: true, map: '{ answer: 42 }' }\n`);
      await page.keyboard.press('ControlOrMeta+A');
      await page.keyboard.press('ControlOrMeta+V');
      await page.getByRole('button', { name: 'Validate', exact: true }).click();
      await page.getByText('Valid', { exact: true }).waitFor();
      const saved = page.waitForResponse(r => r.url() === `${host.origin}/api/pipelines/${id}` && r.request().method() === 'PUT');
      await page.getByRole('button', { name: 'Save draft', exact: true }).click();
      assert.equal((await saved).status(), 200);
      await page.getByRole('button', { name: 'Test draft', exact: true }).click();
      await page.getByRole('combobox', { name: 'Test connectors' }).selectOption('mock');
      const tested = page.waitForResponse(r => r.url() === `${host.origin}/api/executions` && r.request().method() === 'POST');
      await page.getByRole('button', { name: 'Run', exact: true }).click();
      const result = await (await tested).json(); assert.equal(result.success, true); assert.equal(result.outputs.result.answer, 42);
      await page.getByText(/Succeeded/).waitFor();
      const deployment = page.waitForResponse(r => r.url() === `${host.origin}/api/pipelines/${id}/deploy`);
      await page.getByRole('button', { name: 'Deploy', exact: true }).click();
      assert.equal((await deployment).status(), 200);
      if (process.env.ELWOOD_M6_PORTAL_SCREENSHOT) await page.screenshot({ path: process.env.ELWOOD_M6_PORTAL_SCREENSHOT, fullPage: true });
      console.log('Hosted portal verification:', JSON.stringify({ pipelineId: id, authenticated: true, save: true, validate: true, mockTest: true, deploy: true, answer: 42 }));
    } catch (error) {
      console.log('Portal state:', (await page.locator('body').innerText()).replaceAll(token, '[redacted]').slice(0, 3000));
      throw error;
    } finally {
      await browser.close();
      if (created) {
        const headers = { Authorization: `Bearer ${token}` };
        const draft = await (await fetch(`${host.origin}/api/pipelines/${id}`, { headers })).json();
        const removal = await fetch(`${host.origin}/api/pipelines/${id}`, { method: 'DELETE', headers: { ...headers, 'If-Match': `"${draft.draftRevisionId}"` } });
        assert.equal(removal.status, 204);
      }
    }
  });
