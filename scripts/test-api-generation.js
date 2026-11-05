'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const cp = require('child_process');
const crypto = require('crypto');
const assert = require('assert');
const root = path.resolve(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'inatrace-api-test-'));
function copy(src, dst) {
  const stat = fs.lstatSync(src);
  if (stat.isSymbolicLink()) throw new Error('Unexpected symlink: ' + src);
  if (stat.isDirectory()) { fs.mkdirSync(dst, { recursive: true }); fs.readdirSync(src).forEach(f => copy(path.join(src, f), path.join(dst, f))); }
  else { fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(src, dst); }
}
function run(args, env = process.env) {
  return cp.spawnSync(process.execPath, [path.join(tmp, 'generate-api.js')].concat(args), { cwd: tmp, env, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
}
try {
  for (const f of ['generate-api.js', 'package-lock.json', 'api-contract', 'src/api']) copy(path.join(root, f), path.join(tmp, f));
  fs.symlinkSync(path.join(root, 'node_modules'), path.join(tmp, 'node_modules'), 'dir');
  let r = run(['--check']); assert.strictEqual(r.status, 0, r.stderr);
  assert(fs.readFileSync(path.join(tmp, 'src/api/model/apiBeycoCoffee.ts'), 'utf8').includes('999999999999999999'), 'Large integer precision lost');
  r = run(['--audit']);
  assert.strictEqual(r.status, 0, r.stderr);
  const audit = JSON.parse(r.stdout);
  assert(audit.identical.includes('model/apiUserCustomer.ts'));
  assert(audit.absentFromGenerator.includes('model/apiKnowledgeBlogPart.ts'));
  for (const file of ['model/apiUserCustomer.ts', 'model/apiKnowledgeBlogPart.ts']) {
    const target = path.join(tmp, 'src/api', file);
    const original = fs.readFileSync(target);
    fs.appendFileSync(target, '\n// unexpected edit\n');
    assert.notStrictEqual(run(['--check']).status, 0, 'Unexpected client edit was accepted');
    fs.writeFileSync(target, original);
  }
  const hintsFile = path.join(tmp, 'api-contract/generator-order.json');
  const originalHints = fs.readFileSync(hintsFile);
  fs.appendFileSync(hintsFile, '\n');
  assert.notStrictEqual(run(['--check']).status, 0, 'Changed order hints were accepted');
  fs.writeFileSync(hintsFile, originalHints);
  r = run(['--update']); assert.strictEqual(r.status, 0, r.stderr);
  r = run(['--check']); assert.strictEqual(r.status, 0, r.stderr);
  const m = JSON.parse(fs.readFileSync(path.join(tmp, 'api-contract/manifest.json')));
  const other = path.join(tmp, 'bad-manifest.json');
  const args = ['--spec', path.join(tmp, 'api-contract/openapi.json'), '--manifest', other,
    '--repository', m.repository, '--revision', m.source_revision];
  for (const fields of [{ spec_sha256: '0'.repeat(64) }, { schema_version: 2 },
    { normalization_version: 'unknown' }, { source_revision: '0'.repeat(40) }]) {
    fs.writeFileSync(other, JSON.stringify(Object.assign({}, m, fields)));
    r = run(['--update'].concat(args)); assert.notStrictEqual(r.status, 0, 'Invalid manifest accepted');
    assert.strictEqual(run(['--check']).status, 0, 'Failed generation changed client');
  }
  r = run(['--check'], Object.assign({}, process.env, { PATH: '/nonexistent' }));
  assert.notStrictEqual(r.status, 0, 'Missing Java was accepted');
  assert.strictEqual(run(['--check']).status, 0, 'Missing Java changed client');
  const fakeBin = path.join(tmp, 'fake-bin');
  fs.mkdirSync(fakeBin);
  const fakeJava = path.join(fakeBin, 'java');
  fs.writeFileSync(fakeJava, '#!/bin/sh\nexit 19\n', { mode: 0o755 });
  r = run(['--update'], Object.assign({}, process.env, { PATH: fakeBin }));
  assert.notStrictEqual(r.status, 0, 'Failed generator was accepted');
  fs.writeFileSync(fakeJava, '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  r = run(['--update'], Object.assign({}, process.env, { PATH: fakeBin }));
  assert.notStrictEqual(r.status, 0, 'Missing generator output was accepted');
  assert.strictEqual(run(['--check']).status, 0, 'Failed generator changed client');
  const smallSpec = path.join(tmp, 'small.json');
  const smallBody = JSON.stringify({ openapi: '3.0.1', info: { title: 'Fixture', version: '1' },
    paths: { '/fixture': { get: { tags: ['company-controller'], operationId: 'fixture',
      responses: { '200': { description: 'OK' } } } } } });
  fs.writeFileSync(smallSpec, smallBody);
  fs.writeFileSync(other, JSON.stringify(Object.assign({}, m, {
    spec_sha256: crypto.createHash('sha256').update(smallBody).digest('hex')
  })));
  r = run(['--check', '--spec', smallSpec, '--manifest', other, '--repository', m.repository,
    '--revision', m.source_revision]);
  assert.notStrictEqual(r.status, 0, 'Changed contract should show client drift');
  assert(r.stderr.includes('Generated client differs'), r.stderr);
  assert.strictEqual(run(['--check']).status, 0, 'Fixture check changed client');
  const stale = path.join(tmp, 'src/api/model/staleGenerated.ts');
  fs.writeFileSync(stale, 'export interface Stale {}\n');
  r = run(['--check']); assert.notStrictEqual(r.status, 0); assert(r.stderr.includes('staleGenerated.ts'));
  r = run(['--update']); assert.notStrictEqual(r.status, 0, 'Unowned source should require review'); assert(fs.existsSync(stale));
  const meta = path.join(tmp, 'src/api/contract-source.json');
  const inventory = JSON.parse(fs.readFileSync(meta)); inventory.files.push('model/staleGenerated.ts');
  fs.writeFileSync(meta, JSON.stringify(inventory, null, 2) + '\n');
  r = run(['--update']); assert.strictEqual(r.status, 0, r.stderr); assert(!fs.existsSync(stale));
  assert.strictEqual(run(['--check']).status, 0, 'Repeated generation differs');
  console.log('API generation checks passed');
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }
