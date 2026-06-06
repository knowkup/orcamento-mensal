import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('firebase config keeps production and homolog projects isolated by hostname', async () => {
  const source = await readFile('firebase-config.js', 'utf8');

  assert.match(source, /projectId:\s*"orcamento-mensal-fdc1a"/);
  assert.match(source, /projectId:\s*"orcamento-mensal-homolog"/);
  assert.match(source, /"orcamento-mensal-homolog\.web\.app"/);
  assert.match(source, /"orcamento-mensal-homolog\.firebaseapp\.com"/);
  assert.match(source, /"localhost"/);
  assert.match(source, /"127\.0\.0\.1"/);
  assert.match(source, /homologHosts\.has\(hostname\)\s*\?\s*"homolog"\s*:\s*"production"/);
});

test('firebase hosting excludes local and documentation artifacts', async () => {
  const config = JSON.parse(await readFile('firebase.json', 'utf8'));
  const ignored = new Set(config.hosting.ignore);

  [
    'backups*/**',
    'design/**',
    'docs/**',
    'test/**',
    '_arquivo/**',
    'files-mentioned-by-the-user-or/**',
    'PASSAGEM_HOMOLOG.md',
    'firebase.md',
    'firestore.rules'
  ].forEach(pattern => assert.ok(ignored.has(pattern), `${pattern} must not be hosted`));
});
