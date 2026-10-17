import { describe, expect, test } from 'bun:test';
import { formatSummary, nameKey, parseSummary } from '../src/lib/amount';

describe('parseSummary', () => {
  test.each([
    ['Mælk', 'Mælk', 1],
    ['2 × Mælk', 'Mælk', 2],
    ['2x Mælk', 'Mælk', 2],
    ['3 * Æbler', 'Æbler', 3],
    ['Mælk ×2', 'Mælk', 2],
    ['Mælk x 4', 'Mælk', 4],
    ['Mælk (2)', 'Mælk', 2],
    ['2 Mælk', 'Mælk', 2],
    ['  12   ×  Æg  ', 'Æg', 12],
  ])('%p', (input, name, amount) => {
    expect(parseSummary(input)).toEqual({ name, amount });
  });

  test('leaves units and odd numbers in the name', () => {
    expect(parseSummary('500 g smør')).toEqual({ name: '500 g smør', amount: 1 });
    expect(parseSummary('2 kg kartofler')).toEqual({ name: '2 kg kartofler', amount: 1 });
    expect(parseSummary('Mel 2 kg')).toEqual({ name: 'Mel 2 kg', amount: 1 });
    expect(parseSummary('0 × Mælk')).toEqual({ name: '0 × Mælk', amount: 1 });
    expect(parseSummary('Mixer')).toEqual({ name: 'Mixer', amount: 1 });
  });
});

describe('formatSummary', () => {
  test('omits ×1 and round-trips', () => {
    expect(formatSummary('Mælk', 1)).toBe('Mælk');
    expect(formatSummary('Mælk', 2)).toBe('2 × Mælk');
    expect(parseSummary(formatSummary('Rugbrød', 3))).toEqual({ name: 'Rugbrød', amount: 3 });
  });
});

test('nameKey ignores case and spacing', () => {
  expect(nameKey('  Hakket   Oksekød ')).toBe('hakket oksekød');
  expect(nameKey('ÆBLER')).toBe('æbler');
});
