// Reads all spec/test-cases from the Elwood repo and bundles them into
// src/data/examples.json for the portal playground.
//
// Usage: node scripts/bundle-examples.mjs
// Run manually after adding new test cases to the Elwood repo.

import { readdirSync, readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SPEC_DIR = join(__dirname, '..', '..', 'Elwood', 'spec', 'test-cases');
const OUT_FILE = join(__dirname, '..', 'src', 'data', 'examples.json');

if (!existsSync(SPEC_DIR)) {
  console.error(`Test cases not found at ${SPEC_DIR}`);
  console.error('Make sure the Elwood repo is cloned alongside elwood-portal.');
  process.exit(1);
}

const dirs = readdirSync(SPEC_DIR, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name)
  .sort();

const examples = [];

for (const dir of dirs) {
  const base = join(SPEC_DIR, dir);
  const scriptPath = join(base, 'script.elwood');
  const inputPath = join(base, 'input.json');
  const expectedPath = join(base, 'expected.json');
  const explanationPath = join(base, 'explanation.md');

  if (!existsSync(scriptPath)) continue;

  const script = readFileSync(scriptPath, 'utf-8');
  const input = existsSync(inputPath) ? readFileSync(inputPath, 'utf-8') : '{}';
  const expected = existsSync(expectedPath) ? readFileSync(expectedPath, 'utf-8') : null;
  const explanation = existsSync(explanationPath) ? readFileSync(explanationPath, 'utf-8') : null;

  // Extract title from explanation.md (first # heading) or from dir name
  let title = dir.replace(/^\d+-/, '').replace(/-/g, ' ');
  if (explanation) {
    const match = explanation.match(/^#\s+(.+)/m);
    if (match) title = match[1].replace(/^\d+\s*[—–-]\s*/, '');
  }

  // Extract category from the number prefix
  const num = parseInt(dir.split('-')[0], 10);
  let category = 'General';
  if (num <= 9) category = 'Basics';
  else if (num <= 20) category = 'Core Features';
  else if (num <= 40) category = 'Pipe Operators';
  else if (num <= 55) category = 'Methods';
  else if (num <= 70) category = 'Advanced';
  else category = 'Format & I/O';

  examples.push({
    id: dir,
    title,
    category,
    script: script.trim(),
    input: input.trim(),
    expected: expected ? expected.trim() : null,
    explanation: explanation ? explanation.trim() : null,
  });
}

// Write output
const outDir = join(__dirname, '..', 'src', 'data');
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
writeFileSync(OUT_FILE, JSON.stringify(examples, null, 2));

console.log(`Bundled ${examples.length} examples → ${OUT_FILE}`);
