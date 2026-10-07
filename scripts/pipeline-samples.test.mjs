import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { test } from 'node:test';
import { sampleContent, findPipelineSample } from '../src/lib/pipeline-samples.ts';

const samples = JSON.parse(readFileSync(new URL('../src/data/pipeline-samples.json', import.meta.url), 'utf8'));

test('public HTTP samples create independent drafts and retain their test presets', () => {
  assert.deepEqual(samples.map(s => s.id).sort(), ['sample-cart-chain', 'sample-echo-order', 'sample-http-error', 'sample-http-timeout', 'sample-deldo-stock', 'sample-order-auth', 'sample-product-sql'].sort());
  for (const sample of samples) {
    const before = JSON.stringify(sample);
    const content = sampleContent(sample, 'my-test');
    assert.match(content.yaml, /^name: my-test$/m);
    if (sample.content.yaml.includes('endpoint:')) assert.match(content.yaml, /endpoint: \/samples\/my-test\n/);
    assert.equal(findPipelineSample(samples, content)?.id, sample.id);
    assert.equal(JSON.stringify(sample), before);
    assert.throws(() => sampleContent(sample, 'bad\nname: injected'));
  }
  assert.equal(findPipelineSample(samples, { yaml: '# sample: unknown', scripts: {} }), undefined);
  assert.equal(findPipelineSample(samples, { yaml: 'name: ordinary', scripts: {} }), undefined);
});

// Standalone portal CI uses the checked-in bundle. In the paired workspace also
// check the source files so edits cannot quietly leave the portal samples stale.
const source = new URL('../../elwood/docs/examples/public-http/', import.meta.url);
test('pipeline sample bundle matches backend YAML, inputs and mocks', { skip: !existsSync(source) }, () => {
  for (const sample of samples) {
    const base = existsSync(new URL(`${sample.id}/`, source)) ? new URL(`${sample.id}/`, source) : new URL(`../../elwood/docs/examples/connectors/${sample.id}/`, import.meta.url);
    assert.equal(sample.content.yaml, readFileSync(new URL('pipeline.elwood.yaml', base), 'utf8').replaceAll('\r\n', '\n'));
    for (const [field, file] of [['input', 'input.json'], ['mocks', 'mocks.json']]) {
      assert.deepEqual(sample[field], JSON.parse(readFileSync(new URL(file, base), 'utf8')));
    }
    for (const [name, script] of Object.entries(sample.content.scripts ?? {})) {
      assert.equal(script, readFileSync(new URL(name, base), 'utf8').replaceAll('\r\n', '\n'));
    }
    const metadata = JSON.parse(readFileSync(new URL('sample.json', base), 'utf8'));
    for (const [key, value] of Object.entries(metadata)) assert.deepEqual(sample[key], value);
  }
});
