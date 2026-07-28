import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cardGeneralPurchaseAmount,
  cardGeneralPurchaseOccurrenceKey,
  cardGeneralPurchaseStorageKey
} from '../js/domain/card-general-purchases.js';

test('uses a separate monthly key for general card purchases', () => {
  assert.equal(cardGeneralPurchaseStorageKey('card-itau', '2026-08'), 'card-itau:2026-08');
  assert.equal(cardGeneralPurchaseOccurrenceKey('card-itau', '2026-08'), 'child-card-general|card-itau:2026-08');
});

test('returns the saved amount for general card purchases', () => {
  const values = { 'card-itau:2026-08': 250.75 };
  assert.equal(cardGeneralPurchaseAmount(values, 'card-itau', '2026-08'), 250.75);
  assert.equal(cardGeneralPurchaseAmount(values, 'card-itau', '2026-09'), 0);
});
