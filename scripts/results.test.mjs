import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execute, setScanWarningThreshold } from '@elwood-lang/core';
import { isScript, evaluationWarnings, executionError, readWarnings } from '../src/lib/results.ts';

test('script detection ignores keywords in literals and comments', () => {
  assert.equal(isScript('{ message: "return shipment" }'), false);
  assert.equal(isScript('// return something\n{ message: "let x" }'), false);
  assert.equal(isScript('/* comment */\nlet\tx = 42\nreturn x'), true);
});

test('a successful engine result exposes warnings without an error', () => {
  const restore = setScanWarningThreshold(2000);
  try {
    const result = execute('let n = $.rows[*] | where r => !($.list[*] | any x => x == r) | count\nreturn n', {
      rows: Array.from({ length: 50 }, (_, i) => `r${i}`),
      list: Array.from({ length: 50 }, (_, i) => `l${i}`),
    });
    assert.equal(result.success, true);
    assert.equal(result.value, 50);
    assert.equal(evaluationWarnings(result.diagnostics).length, 1);
    assert.match(evaluationWarnings(result.diagnostics)[0], /2,500/);
  } finally {
    setScanWarningThreshold(restore);
  }
});

test('warnings header is a JSON string array, independent of the result body', () => {
  assert.deepEqual(readWarnings('["Repeated scan", "Use indexBy"]'), ['Repeated scan', 'Use indexBy']);
  assert.deepEqual(readWarnings(undefined), []);
  assert.ok(readWarnings('invalid')[0].includes('unreadable'));
});

test('execution envelope failure is an error even with HTTP 200', () => {
  assert.equal(executionError({ success: false, errors: ['Output result failed'] }), 'Output result failed');
  assert.equal(executionError({ success: true }), undefined);
});

// Use the real API client with intercepted HTTP, including its error-envelope handling.
test('portal API consumes execution failures and script warnings', async () => {
  const http = await import('node:http');
  const requests = [];
  const server = http.createServer(async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk;
    requests.push({ path: req.url, method: req.method, authorization: req.headers.authorization, expected: req.headers['if-match'], body: body ? JSON.parse(body) : null });
    res.setHeader('Content-Type', 'application/json');
    if (req.url.endsWith('/test')) {
      res.setHeader('X-Elwood-Revision', 'snapshot-1');
      res.setHeader('X-Elwood-Warnings', '["Repeated scan"]');
      res.end('{"count":50}');
    } else res.end('{"success":false,"errors":["Source input failed"]}');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const previousUrl = process.env.NEXT_PUBLIC_API_URL;
  process.env.NEXT_PUBLIC_API_URL = `http://127.0.0.1:${server.address().port}`;
  try {
    const { executePipeline, testScript, savePipeline, validatePipeline, deployPipeline, migratePipeline, resumeExecution, replayExecution, setManagementToken, canManage } = await import('../src/lib/api.ts');
    setManagementToken('test-token');
    const execution = await executePipeline('example', '{}', { testMode: 'real' });
    assert.equal(execution.statusCode, 200);
    assert.equal(execution.error, 'Source input failed');
    const script = await testScript('example', 'map.elwood', '{}');
    assert.equal(script.statusCode, 200);
    assert.equal(script.error, undefined);
    assert.deepEqual(script.warnings, ['Repeated scan']);
    assert.deepEqual(JSON.parse(script.body), { count: 50 });
    assert.equal(script.revisionId, 'snapshot-1');
    const content = { yaml: 'name: test', scripts: { 'map.elwood': 'return 42' } };
    await savePipeline('example', content, 'draft-hash');
    await validatePipeline('example', content);
    await deployPipeline('example', 'draft-hash');
    await migratePipeline('example', 'draft-hash');
    await executePipeline('example', '{}', { testMode: 'mock', mocks: { sources: {}, outputs: {} } }, content, 'draft-hash');
    await testScript('example', 'map.elwood', '{}', 'draft-hash');
    assert.ok(requests.every(request => request.authorization === 'Bearer test-token'));
    assert.equal(requests[2].method, 'PUT');
    assert.equal(requests[2].expected, '"draft-hash"');
    assert.equal(requests[3].path, '/api/pipelines/example/validate');
    assert.deepEqual(requests[3].body, { content });
    assert.equal(requests[4].path, '/api/pipelines/example/deploy');
    assert.deepEqual(requests[4].body, { expectedRevisionId: 'draft-hash' });
    assert.equal(requests[5].path, '/api/pipelines/example/migrate');
    assert.deepEqual(requests[6].body.content, content);
    assert.equal(requests[7].expected, '"draft-hash"');
    assert.equal(requests[0].body.testMode, 'real');
    assert.equal(requests[0].body.mocks, undefined);
    assert.equal(requests[6].body.testMode, 'mock');
    assert.deepEqual(requests[6].body.mocks, { sources: {}, outputs: {} });
    const countBefore = requests.length;
    for (const options of [undefined, { testMode: 'mixed' }, { testMode: 'mock' }, { testMode: 'real', mocks: {} }]) {
      const invalid = await executePipeline('example', '{}', options);
      assert.ok(invalid.error);
      assert.equal(invalid.statusCode, 0);
    }
    assert.equal(requests.length, countBefore, 'invalid or unselected test modes must not send a request');
    await resumeExecution('execution-1');
    await resumeExecution('execution-1', true);
    await replayExecution('execution-1');
    await replayExecution('execution-1', 'published-revision', true);
    assert.deepEqual(requests.slice(-4).map(({ path, method, body, authorization }) => ({ path, method, body, authorization })), [
      { path: '/api/executions/execution-1/resume', method: 'POST', body: { acknowledgeUncertain: false }, authorization: 'Bearer test-token' },
      { path: '/api/executions/execution-1/resume', method: 'POST', body: { acknowledgeUncertain: true }, authorization: 'Bearer test-token' },
      { path: '/api/executions/execution-1/replay', method: 'POST', body: { acknowledgeUncertain: false, forceProcessing: false }, authorization: 'Bearer test-token' },
      { path: '/api/executions/execution-1/replay', method: 'POST', body: { revisionId: 'published-revision', acknowledgeUncertain: true, forceProcessing: false }, authorization: 'Bearer test-token' },
    ]);
    const reader = { name: 'reader', permissions: ['read'], pipelines: ['example'] };
    assert.equal(canManage(reader, 'read', 'example'), true);
    assert.equal(canManage(reader, 'read', 'elsewhere'), false);
    assert.equal(canManage(reader, 'deploy', 'example'), false);
    assert.equal(canManage(reader, 'recover', 'example'), false);
    assert.equal(canManage({ ...reader, permissions: ['read', 'recover'] }, 'recover', 'example'), true);
    assert.equal(canManage({ ...reader, permissions: ['read', 'recover'] }, 'recover', 'elsewhere'), false);
    assert.equal(canManage(null, 'read', 'example'), false);
    setManagementToken('');
  } finally {
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_API_URL;
    else process.env.NEXT_PUBLIC_API_URL = previousUrl;
    await new Promise(resolve => server.close(resolve));
  }
});
