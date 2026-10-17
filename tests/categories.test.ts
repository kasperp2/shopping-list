import { describe, expect, test } from 'bun:test';
import { categorize, DEFAULT_CATEGORIES, dictionaryCategory, findCategory } from '../src/lib/categories';

describe('dictionaryCategory', () => {
  test.each([
    ['Mælk', 'mejeri'],
    ['Letmælk', 'mejeri'],
    ['Rugbrød', 'broed'],
    ['Hakket oksekød', 'koed'],
    ['Leverpostej', 'paalaeg'],
    ['Æbler', 'frugt'],
    ['Danskvand', 'drikke'],
    ['Toiletpapir', 'hushold'],
    ['Tandpasta', 'pleje'],
    ['Flødeost', 'mejeri'],
    ['Is', 'frost'],
    ['Ris', 'kolonial'],
    ['Kost', 'hushold'],
  ])('%p → %p', (name, id) => {
    expect(dictionaryCategory(name)).toBe(id);
  });

  test('unknown → null', () => {
    expect(dictionaryCategory('Gave til mor')).toBeNull();
  });
});

describe('categorize', () => {
  test('learned history wins over the dictionary', () => {
    const learned = new Map([['mælk', 'Drikkevarer']]);
    expect(categorize('mælk', learned, DEFAULT_CATEGORIES)).toBe('Drikkevarer');
  });

  test('falls back to Andet', () => {
    expect(categorize('Gave', new Map(), DEFAULT_CATEGORIES)).toBe('Andet');
  });

  test('renamed category is still found by alias', () => {
    const cats = DEFAULT_CATEGORIES.map((c) => (c.id === 'mejeri' ? { ...c, name: 'Køl', aliases: ['Mejeri & æg'] } : c));
    expect(findCategory(cats, 'Mejeri & æg')?.name).toBe('Køl');
    expect(categorize('Mælk', new Map(), cats)).toBe('Køl');
    expect(categorize('Ost', new Map([['ost', 'Mejeri & æg']]), cats)).toBe('Køl');
  });
});
