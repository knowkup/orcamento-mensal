import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const debtModules = [
  'js/dividas/debt-components.js',
  'js/dividas/dashboard.js',
  'js/dividas/data.js',
  'js/dividas/debt-form.js',
  'js/dividas/debts.js',
  'js/dividas/payment.js',
  'js/dividas/renegotiation.js',
  'js/dividas/trail.js',
  'js/dividas/ui-events.js'
];

test('debt UI does not use inline event handlers', async () => {
  const sources = await Promise.all(
    ['index.html', ...debtModules].map(async file => [file, await readFile(file, 'utf8')])
  );
  const inlineHandler = /\son(?:click|change|input|dragstart|dragover|drop|dragend)\s*=/i;

  sources.forEach(([file, source]) => {
    assert.doesNotMatch(source, inlineHandler, `${file} contains an inline event handler`);
  });
});

test('shared debt details are not duplicated in trail renderer', async () => {
  const debts = await readFile('js/dividas/debts.js', 'utf8');
  const trail = await readFile('js/dividas/trail.js', 'utf8');

  assert.match(debts, /export function debtExpandedDetail/);
  assert.match(debts, /export function debtActionMenu/);
  assert.match(debts, /export function installmentRowsForDebt/);
  assert.doesNotMatch(trail, /function debtExpandedDetail/);
  assert.doesNotMatch(trail, /function debtActionMenu/);
  assert.doesNotMatch(trail, /function installmentRowsForDebt/);
  assert.match(trail, /renderDebtRouteItem/);
});

test('debt modules expose navigation only through the intentional bridge', async () => {
  const sources = await Promise.all(
    debtModules.map(async file => [file, await readFile(file, 'utf8')])
  );

  sources.forEach(([file, source]) => {
    assert.doesNotMatch(source, /window\.[A-Za-z0-9_]+\s*=/, `${file} assigns a global API`);
  });
});

test('migrated static controls have event bindings', async () => {
  const html = await readFile('index.html', 'utf8');
  const events = await readFile('js/dividas/ui-events.js', 'utf8');
  const ids = [
    'waitingDebtSort',
    'hiddenDebtSort',
    'closeDebtFormButton',
    'saveDebtButton',
    'debtIsConsignado'
  ];

  ids.forEach(id => {
    assert.match(html, new RegExp(`id=["']${id}["']`), `${id} is missing from index.html`);
    assert.match(events, new RegExp(`getElementById\\(['"]${id}['"]\\)`), `${id} is not bound`);
  });
});
