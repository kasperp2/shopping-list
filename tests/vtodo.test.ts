import { describe, expect, test } from 'bun:test';
import { applyPatch, createTodo, parseTodo, serializeItem } from '../src/lib/dav/vtodo';

// What Apple Reminders / Tasks.org style clients write.
const FOREIGN = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//Apple Inc.//iOS 18//EN',
  'BEGIN:VTODO',
  'UID:abc-123',
  'DTSTAMP:20260101T120000Z',
  'CREATED:20260101T120000Z',
  'SUMMARY:Mælk (2)',
  'CATEGORIES:Mejeri & æg,Vigtigt',
  'X-APPLE-SORT-ORDER:42',
  'PRIORITY:1',
  'STATUS:NEEDS-ACTION',
  'END:VTODO',
  'END:VCALENDAR',
].join('\r\n');

describe('parseTodo', () => {
  test('reads foreign items', () => {
    const item = parseTodo(FOREIGN, '/l/abc.ics', '"e1"')!;
    expect(item).toMatchObject({
      uid: 'abc-123',
      name: 'Mælk',
      amount: 2,
      category: 'Mejeri & æg',
      completed: false,
      etag: '"e1"',
    });
  });

  test('null for non-VTODO', () => {
    expect(parseTodo('BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:x\r\nEND:VEVENT\r\nEND:VCALENDAR', '/x')).toBeNull();
    expect(parseTodo('garbage', '/x')).toBeNull();
  });
});

describe('serializeItem', () => {
  test('keeps properties other apps set', () => {
    const item = parseTodo(FOREIGN, '/l/abc.ics')!;
    const ics = serializeItem(applyPatch(item, { amountDelta: 1, completed: true, note: 'Den økologiske' }));
    expect(ics).toContain('X-APPLE-SORT-ORDER:42');
    expect(ics).toContain('PRIORITY:1');
    expect(ics).toContain('SUMMARY:3 × Mælk');
    expect(ics).toContain('STATUS:COMPLETED');
    expect(ics).toContain('PERCENT-COMPLETE:100');
    expect(ics).toContain('CATEGORIES:Mejeri & æg,Vigtigt');
    const back = parseTodo(ics, '/l/abc.ics')!;
    expect(back).toMatchObject({ amount: 3, completed: true, note: 'Den økologiske' });
    expect(back.completedAt).toBeString();
  });

  test('un-completing clears completion props', () => {
    const done = parseTodo(serializeItem(applyPatch(parseTodo(FOREIGN, '/x')!, { completed: true })), '/x')!;
    const ics = serializeItem(applyPatch(done, { completed: false }));
    expect(ics).toContain('STATUS:NEEDS-ACTION');
    expect(ics).not.toContain('COMPLETED:');
    expect(ics).not.toContain('PERCENT-COMPLETE');
  });

  test('changing category replaces only the first', () => {
    const ics = serializeItem({ ...parseTodo(FOREIGN, '/x')!, category: 'Drikkevarer' });
    expect(ics).toContain('CATEGORIES:Drikkevarer,Vigtigt');
  });
});

test('createTodo round-trips', () => {
  const ics = createTodo({ uid: 'u1', name: 'Rugbrød', amount: 2, category: 'Brød & bagværk', note: '' });
  expect(ics).toContain('SUMMARY:2 × Rugbrød');
  expect(parseTodo(ics, '/u1.ics')).toMatchObject({ uid: 'u1', name: 'Rugbrød', amount: 2, category: 'Brød & bagværk' });
});
