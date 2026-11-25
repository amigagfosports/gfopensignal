// AC-265: the npm lockfiles keep the fixed versions of what the security
// scanner (Trivy) found. Each floor is the lowest release that fixes every
// critical/high finding counted for that package on 25 Nov 2026; a lockfile
// that falls back below one (a revert, an old lock merged in) fails here.
// Run: node --test tests/security/lock_floors.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const FLOORS = {
  'functions/package-lock.json': {
    axios: '1.12.0', protobufjs: '7.5.5', 'proxy-addr': '2.0.8', 'websocket-driver': '0.7.5',
    'fast-xml-parser': '4.5.4', '@grpc/grpc-js': '1.13.6', '@fastify/busboy': '3.2.1',
    'node-forge': '1.3.2', 'js-yaml': '4.3.0', 'tar-fs': '3.0.9', 'basic-ftp': '5.2.0',
    // form-data: each line has its own fix
    'form-data': { 2: '2.5.4', 3: '3.0.4', 4: '4.0.4' },
  },
  'scripts/perf/package-lock.json': { 'basic-ftp': '5.2.0', 'js-yaml': '4.3.0', 'tar-fs': '3.0.9' },
  'electron/package-lock.json': { 'cross-spawn': { 6: '6.0.6', 7: '7.0.5' }, glob: { 10: '10.5.0' } },
};

export function cmp(a, b) {
  const pa = a.split(/[.+-]/).map(Number), pb = b.split(/[.+-]/).map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  return 0;
}

export function below(lock, floors) {
  const bad = [];
  for (const [path, info] of Object.entries(lock.packages || {})) {
    const name = path.split('node_modules/').pop();
    const floor = floors[name];
    if (!floor || !info.version) continue;
    const want = typeof floor === 'string' ? floor : floor[info.version.split('.')[0]];
    if (want && cmp(info.version, want) < 0) bad.push(`${name}@${info.version} (needs ${want}) at ${path}`);
  }
  return bad;
}

test('cmp orders versions', () => {
  assert.ok(cmp('1.21.1', '1.12.0') > 0);
  assert.ok(cmp('7.5.4', '7.5.5') < 0);
  assert.equal(cmp('2.0.8', '2.0.8'), 0);
});

test('below finds an old version, per major line too', () => {
  const lock = { packages: { 'node_modules/axios': { version: '1.9.0' }, 'node_modules/x/node_modules/form-data': { version: '2.5.3' },
    'node_modules/form-data': { version: '4.0.6' } } };
  assert.deepEqual(below(lock, FLOORS['functions/package-lock.json']).map((s) => s.split('@')[0]), ['axios', 'form-data']);
});

for (const [file, floors] of Object.entries(FLOORS)) {
  test(`${file} keeps its fixed versions`, () => {
    const lock = JSON.parse(readFileSync(new URL(`../../${file}`, import.meta.url)));
    assert.deepEqual(below(lock, floors), []);
  });
}
