import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { isScript } from '../src/lib/results.ts';
import { evaluate, execute } from '@elwood-lang/core';

const examples = JSON.parse(readFileSync(new URL('../src/data/examples.json', import.meta.url), 'utf8'));

test('gallery contains current language and non-JSON input examples', () => {
  for (const id of ['81-fromcsv-file', '85-fromxml-file', '91-root-binding', '112-array-spread']) {
    assert.ok(examples.some(example => example.id === id), `Missing ${id}`);
  }
});

for (const example of examples) {
  test(example.id, () => {
    const result = (isScript(example.script) ? execute : evaluate)(example.script, JSON.parse(example.input), example.bindings);
    // These methods use CommonJS require internally and are unavailable in
    // browsers and native ESM. Verify the documented diagnostic, not a shimmed
    // environment that would hide the portal's actual runtime limitation.
    if (example.id === '35-hash' || example.id === '36-rsa-sign') {
      assert.equal(result.success, false);
      assert.match(result.diagnostics[0].message, /Crypto functions .* require Node\.js/);
      return;
    }
    assert.equal(result.success, true, JSON.stringify(result.diagnostics));
    // Compare the JSON rendered by the playground. indexBy intentionally creates
    // dictionaries with a null prototype; that is not a JSON value difference.
    assert.deepEqual(JSON.parse(JSON.stringify(result.value)), JSON.parse(example.expected));
  });
}
