import { describe, expect, test } from 'bun:test';
import { DavError } from '../src/lib/dav/client';
import { createTodo, parseTodo } from '../src/lib/dav/vtodo';
import { buildHistory, suggest } from '../src/lib/suggest';
import { applyOps, enqueue, flush, itemHref, type DavLike, type Op } from '../src/lib/sync';
import type { Item } from '../src/lib/types';

const LIST = 'https://dav.test/u/list/';

/** In-memory CalDAV collection with real ETag semantics. */
class FakeDav implements DavLike {
  store = new Map<string, { ics: string; etag: string }>();
  n = 0;
  offline = false;
  async getItem(href: string) {
    if (this.offline) throw new TypeError('offline');
    const r = this.store.get(href);
    return r ? parseTodo(r.ics, href, r.etag) : null;
  }
  async put(href: string, ics: string, cond: { etag?: string; create?: boolean }) {
    if (this.offline) throw new TypeError('offline');
    const cur = this.store.get(href);
    if (cond.create && cur) throw new DavError(412, 'exists');
    if (cond.etag && cur?.etag !== cond.etag) throw new DavError(412, 'changed');
    const etag = `"${++this.n}"`;
    this.store.set(href, { ics, etag });
    return etag;
  }
  async remove(href: string, etag?: string) {
    if (this.offline) throw new TypeError('offline');
    const cur = this.store.get(href);
    if (cur && etag && cur.etag !== etag) throw new DavError(412, 'changed');
    this.store.delete(href);
  }
  items() {
    return [...this.store].map(([href, r]) => parseTodo(r.ics, href, r.etag)!);
  }
}

let id = 0;
const op = (o: Record<string, unknown>) => ({ id: String(++id), list: LIST, ...o }) as Op;

describe('enqueue', () => {
  test('folds amount taps into one update', () => {
    let q: Op[] = [];
    q = enqueue(q, op({ uid: 'a', kind: 'update', patch: { amountDelta: 1 } }));
    q = enqueue(q, op({ uid: 'a', kind: 'update', patch: { amountDelta: 1 } }));
    q = enqueue(q, op({ uid: 'a', kind: 'update', patch: { amountDelta: -1, note: 'x' } }));
    expect(q).toHaveLength(1);
    expect(q[0]).toMatchObject({ kind: 'update', patch: { amountDelta: 1, note: 'x' } });
  });

  test('folds edits into an unsent create; delete cancels it', () => {
    let q: Op[] = [op({ uid: 'b', kind: 'create', fields: { name: 'Æg', amount: 1, category: '', note: '' } })];
    q = enqueue(q, op({ uid: 'b', kind: 'update', patch: { amountDelta: 2 } }));
    expect(q).toHaveLength(1);
    expect(q[0]).toMatchObject({ fields: { amount: 3 } });
    expect(enqueue(q, op({ uid: 'b', kind: 'delete' }))).toHaveLength(0);
  });

  test('does not touch the op in flight', () => {
    const create = op({ uid: 'c', kind: 'create', fields: { name: 'Øl', amount: 1, category: '', note: '' } });
    const q = enqueue([create], op({ uid: 'c', kind: 'update', patch: { amountDelta: 1 } }), create.id);
    expect(q).toHaveLength(2);
  });
});

describe('flush', () => {
  test('creates, updates and deletes', async () => {
    const dav = new FakeDav();
    const known = new Map<string, Item>();
    const q = [
      op({ uid: 'm', kind: 'create', fields: { name: 'Mælk', amount: 1, category: 'Mejeri & æg', note: '' } }),
      op({ uid: 'm', kind: 'update', patch: { amountDelta: 1 } }),
      op({ uid: 'r', kind: 'create', fields: { name: 'Ris', amount: 1, category: '', note: '' } }),
      op({ uid: 'r', kind: 'delete' }),
    ];
    const res = await flush(dav, q, known);
    expect(res.done).toHaveLength(4);
    expect(dav.items().map((i) => [i.name, i.amount])).toEqual([['Mælk', 2]]);
  });

  test('re-applies the amount delta after a concurrent edit (412)', async () => {
    const dav = new FakeDav();
    const href = itemHref(LIST, 'm');
    await dav.put(href, createTodo({ uid: 'm', name: 'Mælk', amount: 1, category: '', note: '' }), { create: true });
    const stale = (await dav.getItem(href))!;
    // Someone else bumps it to 3 on another phone.
    await dav.put(href, createTodo({ uid: 'm', name: 'Mælk', amount: 3, category: '', note: '' }), { etag: stale.etag });

    const known = new Map([['m', stale]]);
    const res = await flush(dav, [op({ uid: 'm', kind: 'update', patch: { amountDelta: 1 } })], known);
    expect(res.errors).toEqual([]);
    expect(dav.items()[0].amount).toBe(4);
  });

  test('stops and keeps ops when offline', async () => {
    const dav = new FakeDav();
    dav.offline = true;
    const res = await flush(dav, [op({ uid: 'x', kind: 'create', fields: { name: 'Øl', amount: 1, category: '', note: '' } })], new Map());
    expect(res).toMatchObject({ offline: true, done: [] });
  });

  test('a create that already landed counts as done', async () => {
    const dav = new FakeDav();
    const o = op({ uid: 'y', kind: 'create', fields: { name: 'Øl', amount: 1, category: '', note: '' } });
    await flush(dav, [o], new Map());
    const res = await flush(dav, [o], new Map());
    expect(res).toMatchObject({ done: [o.id], errors: [] });
  });
});

test('applyOps overlays pending changes', () => {
  const base = [parseTodo(createTodo({ uid: 'a', name: 'Mælk', amount: 1, category: '', note: '' }), itemHref(LIST, 'a'))!];
  const view = applyOps(
    base,
    [
      op({ uid: 'a', kind: 'update', patch: { amountDelta: 2 } }),
      op({ uid: 'b', kind: 'create', fields: { name: 'Brød', amount: 1, category: '', note: '' } }),
      op({ uid: 'z', kind: 'delete', list: 'other' }),
    ],
    LIST,
  );
  expect(view.map((i) => [i.name, i.amount])).toEqual([
    ['Mælk', 3],
    ['Brød', 1],
  ]);
});

test('suggest ranks prefix, then frequency', () => {
  const mk = (uid: string, name: string, completedAt: string) =>
    ({ uid, href: uid, name, amount: 1, category: '', note: '', completed: true, completedAt, raw: '' }) as Item;
  const history = buildHistory([
    mk('1', 'Mælk', '2026-01-01'),
    mk('2', 'Mælk', '2026-02-01'),
    mk('3', 'Mel', '2026-03-01'),
    mk('4', 'Hakket mel', '2026-03-01'),
    mk('5', 'Ost', '2026-03-01'),
  ]);
  expect(suggest('m', history).map((h) => h.name)).toEqual(['Mælk', 'Mel', 'Hakket mel']);
  expect(history.find((h) => h.key === 'mælk')?.count).toBe(2);
});
