// Backend samples are canonical; the checked-in bundle also supports standalone portal clones.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const sources = ['public-http', 'connectors'].map(group => fileURLToPath(new URL(`../../elwood/docs/examples/${group}/`, import.meta.url)));
const output = new URL('../src/data/pipeline-samples.json', import.meta.url);
const readJson = path => JSON.parse(readFileSync(path, 'utf8'));
const samples = sources.flatMap(source => readdirSync(source, { withFileTypes: true }).filter(entry => entry.isDirectory())
  .map(entry => {
    const dir = join(source, entry.name);
    return {
      ...readJson(join(dir, 'sample.json')),
      content: { yaml: readFileSync(join(dir, 'pipeline.elwood.yaml'), 'utf8').replaceAll('\r\n', '\n'), scripts: Object.fromEntries(readdirSync(dir).filter(file => file.endsWith('.elwood')).map(file => [file, readFileSync(join(dir, file), 'utf8').replaceAll('\r\n', '\n')])) },
      input: readJson(join(dir, 'input.json')),
      mocks: readJson(join(dir, 'mocks.json')),
    };
  })).sort((a, b) => a.id.localeCompare(b.id));
writeFileSync(output, JSON.stringify(samples, null, 2) + '\n');
console.log(`Bundled ${samples.length} pipeline samples.`);
