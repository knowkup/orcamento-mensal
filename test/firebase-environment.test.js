import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('firebase config keeps production and homolog projects isolated by URL', async () => {
  const source = await readFile('firebase-config.js', 'utf8');

  assert.match(source, /projectId:\s*"orcamento-mensal-fdc1a"/);
  assert.match(source, /projectId:\s*"orcamento-mensal-homolog"/);
  assert.match(source, /"orcamento-mensal-homolog\.web\.app"/);
  assert.match(source, /"orcamento-mensal-homolog\.firebaseapp\.com"/);
  assert.match(source, /"localhost"/);
  assert.match(source, /"127\.0\.0\.1"/);
  assert.match(source, /hostname === "kupka1988\.github\.io"/);
  assert.match(source, /githubHomologPath = "\/orcamento-mensal\/homolog"/);
  assert.match(source, /pathname === githubHomologPath/);
  assert.match(source, /homologHosts\.has\(hostname\) \|\| isGitHubHomolog/);
});

test('firebase is configured only as the database provider', async () => {
  const config = JSON.parse(await readFile('firebase.json', 'utf8'));
  assert.deepEqual(config, { firestore: { rules: 'firestore.rules' } });
});

test('GitHub Pages workflow publishes main and homolog separately', async () => {
  const source = await readFile('.github/workflows/pages.yml', 'utf8');

  assert.match(source, /ref: main/);
  assert.match(source, /ref: homolog/);
  assert.match(source, /_site\/homolog/);
  assert.match(source, /actions\/deploy-pages@v4/);
});
