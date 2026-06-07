import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addMonthsToIsoDate,
  escapeHtmlValue,
  formatIsoDateBR,
  initialsFromText,
  normalizeSearchText,
  parseBrazilianMoney
} from '../js/domain/value-utils.js';

test('parses Brazilian money consistently', () => {
  assert.equal(parseBrazilianMoney('R$ 1.234,56'), 1234.56);
  assert.equal(parseBrazilianMoney('1234.56'), 1234.56);
  assert.equal(parseBrazilianMoney(''), 0);
});

test('formats dates and handles end-of-month additions', () => {
  assert.equal(formatIsoDateBR('2026-06-08'), '08/06/2026');
  assert.equal(addMonthsToIsoDate('2026-01-31', 1), '2026-02-28');
});

test('normalizes display text helpers', () => {
  assert.equal(normalizeSearchText('  Dívida Máxima '), '  divida maxima ');
  assert.equal(initialsFromText('Banco do Brasil'), 'BD');
  assert.equal(escapeHtmlValue('<b>"x"</b>'), '&lt;b&gt;&quot;x&quot;&lt;/b&gt;');
});
