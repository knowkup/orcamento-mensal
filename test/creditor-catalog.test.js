import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeCreditorCatalog, normalizeCreditorKey } from '../js/domain/creditor-catalog.js';

test('normalizes creditor names for safe matching', () => {
  assert.equal(normalizeCreditorKey('  Banco Itaú  '), 'banco itau');
});

test('maps a legacy creditor to an existing primary creditor by name', () => {
  const result = mergeCreditorCatalog(
    [{ id: 'primary-1', name: 'Nubank', paymentForms: ['Cartão de crédito'] }],
    [{ id: 'legacy-1', name: 'nubank', type: 'Banco' }],
    () => 'generated'
  );

  assert.equal(result.creditors.length, 1);
  assert.equal(result.idMap.get('legacy-1'), 'primary-1');
  assert.deepEqual(result.creditors[0].paymentForms, ['Cartão de crédito', 'Banco']);
});

test('moves a missing legacy creditor into the primary catalog preserving its id', () => {
  const result = mergeCreditorCatalog(
    [],
    [{ id: 'legacy-1', name: 'Banco Teste', type: 'Banco', logoUrl: 'logo' }],
    () => 'generated'
  );

  assert.deepEqual(result.creditors, [{
    id: 'legacy-1',
    name: 'Banco Teste',
    paymentForms: ['Banco'],
    logoUrl: 'logo',
    notes: ''
  }]);
  assert.equal(result.idMap.get('legacy-1'), 'legacy-1');
  assert.equal(result.changed, true);
});

test('migration remains stable when run more than once', () => {
  const first = mergeCreditorCatalog(
    [{ id: 'main-1', name: 'Banco Teste', paymentForms: [] }],
    [{ id: 'legacy-1', name: ' banco teste ', type: 'Banco' }],
    () => 'generated'
  );
  const second = mergeCreditorCatalog(first.creditors, [], () => 'other');

  assert.equal(first.idMap.get('legacy-1'), 'main-1');
  assert.equal(first.creditors.length, 1);
  assert.equal(second.creditors.length, 1);
  assert.equal(second.changed, false);
});
