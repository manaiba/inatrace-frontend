'use strict';

// Generate from a verified, pinned producer artifact. Node 14 is required by this project.
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const cp = require('child_process');
const root = __dirname;
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
// JSON.parse converts numbers to IEEE-754 doubles and can round integer limits.
// Protect numeric tokens while reordering JSON so the generator sees exact values.
const numberMarker = '__INATRACE_JSON_NUMBER_';
function parseLosslessJson(text) {
  if (text.includes(numberMarker)) throw new Error('Reserved JSON marker present in spec');
  let result = '';
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length;) {
    const ch = text[i];
    if (inString) {
      result += ch; i++;
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
    } else if (ch === '"') {
      inString = true; result += ch; i++;
    } else if (ch === '-' || (ch >= '0' && ch <= '9')) {
      const match = text.slice(i).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/);
      if (!match) throw new Error('Invalid JSON number');
      result += JSON.stringify(numberMarker + match[0] + '__');
      i += match[0].length;
    } else { result += ch; i++; }
  }
  return JSON.parse(result);
}
function stringifyLosslessJson(value) {
  return JSON.stringify(value).replace(/"__INATRACE_JSON_NUMBER_(-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)__"/g, '$1');
}
const walk = (dir, base = dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
  const name = path.join(dir, entry.name);
  if (entry.isSymbolicLink()) throw new Error('Symbolic links are not allowed: ' + name);
  return entry.isDirectory() ? walk(name, base) : [path.relative(base, name).split(path.sep).join('/')];
});
function main() {
  let check = false;
  let audit = false;
  let update = false;
  const opts = {};
  const args = process.argv.slice(2);
  while (args.length) {
    const key = args.shift();
    if (key === '--check') { check = true; continue; }
    if (key === '--audit') { audit = true; continue; }
    if (key === '--update') { update = true; continue; }
    if (!['--spec', '--manifest', '--repository', '--revision'].includes(key) || !args.length) {
      throw new Error('Usage: node generate-api.js <--check|--audit|--update> [--spec FILE --manifest FILE --repository OWNER/REPO --revision SHA]');
    }
    opts[key.slice(2)] = args.shift();
  }
  if ([check, audit, update].filter(Boolean).length !== 1) {
    throw new Error('Choose exactly one of --check, --audit or --update');
  }
  const override = Object.keys(opts).length > 0;
  if (override && ['spec', 'manifest', 'repository', 'revision'].some(k => !opts[k])) {
    throw new Error('Explicit input requires --spec, --manifest, --repository and --revision');
  }
  const specFile = path.resolve(root, opts.spec || 'api-contract/openapi.json');
  const manifestFile = path.resolve(root, opts.manifest || 'api-contract/manifest.json');
  const pinned = readJson(path.join(root, 'api-contract/manifest.json'));
  const m = readJson(manifestFile);
  const bytes = fs.readFileSync(specFile);
  const spec = parseLosslessJson(bytes.toString('utf8'));
  const expectedRepo = opts.repository || pinned.repository;
  const expectedRevision = opts.revision || pinned.source_revision;
  if (m.schema_version !== 1 || m.normalization_version !== 'inatrace-openapi-v1' ||
      m.spec_file !== 'openapi.json' || m.repository !== expectedRepo || m.source_revision !== expectedRevision ||
      !/^[a-f0-9]{40}$/.test(m.source_revision || '') || m.source_state !== 'clean' ||
      !/^[a-f0-9]{64}$/.test(m.spec_sha256 || '') || sha256(bytes) !== m.spec_sha256 ||
      !spec.openapi || spec.openapi !== m.openapi_version || !spec.paths || !Object.keys(spec.paths).length) {
    throw new Error('Invalid OpenAPI manifest, producer identity, spec or SHA-256');
  }
  const generatorRoot = path.join(root, 'node_modules/openapi-typescript-angular-generator');
  const jar = path.join(generatorRoot, 'bin/openapi-generator-cli.jar');
  const templates = path.join(generatorRoot, 'src/mustache');
  const lock = readJson(path.join(root, 'package-lock.json')).dependencies['openapi-typescript-angular-generator'];
  if (!lock || !lock.version) throw new Error('Generator identity missing from lockfile');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'inatrace-api-'));
  try {
    const input = path.join(tmp, 'openapi.json');
    const output = path.join(tmp, 'generated');
    // Preserve the previously published ordering of form metadata. The producer
    // sorts properties and removes deployment-specific servers from its baseline.
    // Hints affect generation only; the validated producer artifact stays intact.
    const orderFile = path.join(root, 'api-contract/generator-order.json');
    const orderBytes = fs.readFileSync(orderFile);
    const order = JSON.parse(orderBytes);
    if (!order || Array.isArray(order) || typeof order !== 'object') throw new Error('Invalid generator order hints');
    const schemas = spec.components && spec.components.schemas || {};
    for (const name of Object.keys(order)) {
      const hints = order[name];
      if (!Array.isArray(hints) || hints.some(x => typeof x !== 'string') || new Set(hints).size !== hints.length) {
        throw new Error('Invalid property order for ' + name);
      }
      if (!schemas[name] || !schemas[name].properties) continue;
      const original = schemas[name].properties;
      const sorted = Object.create(null);
      for (const key of hints) if (Object.prototype.hasOwnProperty.call(original, key)) sorted[key] = original[key];
      for (const key of Object.keys(original)) if (!Object.prototype.hasOwnProperty.call(sorted, key)) sorted[key] = original[key];
      schemas[name].properties = sorted;
    }
    spec.servers = [{ url: 'http://localhost:8080/' }];
    fs.writeFileSync(input, stringifyLosslessJson(spec));
    const run = cp.spawnSync('java', ['-jar', jar, 'generate', '-i', input, '-o', output,
      '-g=typescript-angular', '-t=' + templates, '--additional-properties=supportsES6=true',
      '--additional-properties=ngVersion=7.0.0', '--additional-properties=modelPropertyNaming=original'],
      { encoding: 'utf8', maxBuffer: 25 * 1024 * 1024, timeout: 120000 });
    if (run.error || run.status !== 0 || run.signal) throw new Error('Generator failed: ' + (run.error || run.stderr || run.signal || run.status));
    for (const f of ['index.ts', 'api/api.ts', 'model/models.ts']) {
      const file = path.join(output, f); if (fs.existsSync(file)) fs.unlinkSync(file);
    }
    for (const f of ['api.module.ts', 'configuration.ts', 'api/companyController.service.ts']) {
      if (!fs.existsSync(path.join(output, f))) throw new Error('Required generator output missing: ' + f);
    }
    const files = walk(output).filter(f => f.endsWith('.ts')).sort();
    // Keep the generator's formatting, except for whitespace on three new comment lines.
    const commentFixes = {
      'api/companyController.service.ts': [
        ['* @param InlineObject2 \n', '* @param InlineObject2\n']
      ],
      'api/productController.service.ts': [
        ['* Deletes a product label batch\n     * \n', '* Deletes a product label batch\n     *\n'],
        ['* Deletes a product label feedback by map.\n   * \n', '* Deletes a product label feedback by map.\n   *\n']
      ]
    };
    for (const [relative, replacements] of Object.entries(commentFixes)) {
      const file = path.join(output, relative);
      if (!fs.existsSync(file)) continue;
      let source = fs.readFileSync(file, 'utf8');
      for (const [before, after] of replacements) source = source.split(before).join(after);
      fs.writeFileSync(file, source);
    }
    const legacy = readJson(path.join(root, 'api-contract/legacy-files.json'));
    if (!Array.isArray(legacy) || legacy.some(f => typeof f !== 'string' || f.startsWith('/') || f.split('/').includes('..'))) throw new Error('Invalid legacy file inventory');
    const legacyHashes = readJson(path.join(root, 'api-contract/legacy-hashes.json'));
    if (Object.keys(legacyHashes).length !== legacy.length || legacy.some(f =>
      !fs.existsSync(path.join(root, 'src/api', f)) ||
      sha256(fs.readFileSync(path.join(root, 'src/api', f))) !== legacyHashes[f])) {
      throw new Error('Legacy client files differ from the reviewed inventory');
    }
    const provenance = { schema_version: 1, normalization_version: m.normalization_version, repository: m.repository,
      source_revision: m.source_revision, spec_sha256: m.spec_sha256, generator: lock.version,
      order_sha256: sha256(orderBytes), files };
    const expected = JSON.stringify(provenance, null, 2) + '\n';
    const dest = path.join(root, 'src/api');
    if (audit) {
      const ts = require('typescript');
      const signatures = (file) => {
        const parsed = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
        if (parsed.parseDiagnostics.length) throw new Error('Cannot parse TypeScript: ' + file);
        const entries = [];
        const visit = (node) => {
          if (ts.isInterfaceDeclaration(node)) {
            for (const member of node.members) {
              entries.push(node.name.text + ':' + member.getText(parsed).replace(/\s+/g, ' ').trim());
            }
          }
          ts.forEachChild(node, visit);
        };
        visit(parsed);
        return entries.sort().join('\n');
      };
      const current = walk(dest).filter(f => f.startsWith('model/') && f.endsWith('.ts'));
      const report = { identical: [], sameInterfacesRuntimeNotChecked: [], changedInterfaces: [], absentFromGenerator: [] };
      for (const file of current.sort()) {
        const before = path.join(dest, file);
        const after = path.join(output, file);
        if (!fs.existsSync(after)) report.absentFromGenerator.push(file);
        else if (fs.readFileSync(before).equals(fs.readFileSync(after))) report.identical.push(file);
        else if (signatures(before) === signatures(after)) report.sameInterfacesRuntimeNotChecked.push(file);
        else report.changedInterfaces.push(file);
      }
      console.log(JSON.stringify(report, null, 2));
      return;
    }
    const meta = path.join(dest, 'contract-source.json');
    const previous = fs.existsSync(meta) ? readJson(meta).files : files;
    if (!Array.isArray(previous) || previous.some(f => typeof f !== 'string' || !f.endsWith('.ts') || f.startsWith('/') || f.split('/').includes('..'))) {
      throw new Error('Invalid generated file inventory');
    }
    const owned = previous;
    const unknown = walk(dest).filter(f => f.endsWith('.ts') && !owned.includes(f) && !legacy.includes(f));
    const diffs = Array.from(new Set(files.concat(owned, unknown))).filter(f => !files.includes(f) || !owned.includes(f) ||
      !fs.existsSync(path.join(dest, f)) || !fs.readFileSync(path.join(output, f)).equals(fs.readFileSync(path.join(dest, f))));
    if (!fs.existsSync(meta) || fs.readFileSync(meta, 'utf8') !== expected) diffs.push('contract-source.json');
    if (check) {
      if (diffs.length) throw new Error('Generated client differs:\n' + diffs.join('\n'));
      console.log('Generated files match ' + m.repository + '@' + m.source_revision +
        '; ' + legacy.length + ' legacy files are verified separately.'); return;
    }
    if (unknown.length) throw new Error('Unowned TypeScript files need review before updating:\n' + unknown.join('\n'));
    // Stage a full copy to preserve legacy and local non-generated files; only swap after success.
    const staged = path.join(root, 'src/.api-staged-' + process.pid);
    const backup = path.join(root, 'src/.api-backup-' + process.pid);
    if (fs.existsSync(staged) || fs.existsSync(backup)) throw new Error('Temporary API path already exists');
    fs.mkdirSync(staged);
    try {
      for (const f of walk(dest)) {
        if (owned.includes(f) || f === 'contract-source.json') continue;
        const target = path.join(staged, f); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.copyFileSync(path.join(dest, f), target);
      }
      for (const f of files) {
        if (legacy.includes(f)) throw new Error('Generated output conflicts with legacy inventory: ' + f);
        const target = path.join(staged, f); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.copyFileSync(path.join(output, f), target);
      }
      fs.writeFileSync(path.join(staged, 'contract-source.json'), expected);
      fs.renameSync(dest, backup);
      try { fs.renameSync(staged, dest); } catch (e) { fs.renameSync(backup, dest); throw e; }
      fs.rmSync(backup, { recursive: true, force: true });
    } finally { if (fs.existsSync(staged)) fs.rmSync(staged, { recursive: true, force: true }); }
    console.log('Updated API client from ' + m.repository + '@' + m.source_revision);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}
try { main(); } catch (err) { console.error('API generation: ' + err.message); process.exitCode = 1; }
