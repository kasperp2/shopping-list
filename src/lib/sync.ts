// Offline-first sync. The UI shows `applyOps(serverItems, queue)`: the last
// server snapshot with every pending change replayed on top. `flush` pushes
// the queue to the server in order, re-reading and re-applying a change when
// someone else edited the same item (ETag mismatch → 412).

import { DavError, isNetworkError } from './dav/client';
import { applyPatch, createTodo, serializeItem } from './dav/vtodo';
import type { Item, ItemPatch } from './types';

export type NewItemFields = Pick<Item, 'name' | 'amount' | 'category' | 'note'>;

export type Op =
  | { id: string; list: string; uid: string; kind: 'create'; fields: NewItemFields }
  | { id: string; list: string; uid: string; kind: 'update'; patch: ItemPatch }
  | { id: string; list: string; uid: string; kind: 'delete' };

/** Minimal server surface flush needs (DavClient satisfies it). */
export interface DavLike {
  getItem(href: string): Promise<Item | null>;
  put(href: string, ics: string, cond: { etag?: string; create?: boolean }): Promise<string | undefined>;
  remove(href: string, etag?: string): Promise<void>;
}

export function itemHref(listUrl: string, uid: string): string {
  return `${listUrl.replace(/\/?$/, '/')}${encodeURIComponent(uid)}.ics`;
}

export function applyOps(items: Item[], ops: Op[], listUrl: string, now = new Date()): Item[] {
  const byUid = new Map(items.map((i) => [i.uid, i]));
  for (const op of ops) {
    if (op.list !== listUrl) continue;
    if (op.kind === 'create') {
      if (byUid.has(op.uid)) continue;
      byUid.set(op.uid, {
        uid: op.uid,
        href: itemHref(listUrl, op.uid),
        ...op.fields,
        completed: false,
        createdAt: now.toISOString(),
        modifiedAt: now.toISOString(),
        raw: '',
      });
    } else if (op.kind === 'update') {
      const item = byUid.get(op.uid);
      if (item) byUid.set(op.uid, applyPatch(item, op.patch, now));
    } else {
      byUid.delete(op.uid);
    }
  }
  return [...byUid.values()];
}

function mergePatch(a: ItemPatch, b: ItemPatch): ItemPatch {
  const merged: ItemPatch = { ...a, ...b };
  const delta = (a.amountDelta ?? 0) + (b.amountDelta ?? 0);
  if (delta) merged.amountDelta = delta;
  else delete merged.amountDelta;
  return merged;
}

/**
 * Add an op to the queue, folding it into a not-yet-sent op for the same item
 * where possible so a burst of +/− taps becomes one request.
 * `locked` is the op currently in flight, which must not change.
 */
export function enqueue(queue: Op[], op: Op, locked?: string): Op[] {
  const idx = queue.findLastIndex((o) => o.uid === op.uid && o.list === op.list);
  const prev = idx >= 0 && queue[idx].id !== locked ? queue[idx] : undefined;
  if (prev && op.kind === 'update') {
    if (prev.kind === 'update') {
      const next = [...queue];
      next[idx] = { ...prev, patch: mergePatch(prev.patch, op.patch) };
      return next;
    }
    if (prev.kind === 'create') {
      const base: Item = { uid: op.uid, href: '', ...prev.fields, completed: false, raw: '' };
      const after = applyPatch(base, op.patch);
      // Completing something never sent: keep it as an update so it lands in history.
      if (!after.completed) {
        const next = [...queue];
        next[idx] = { ...prev, fields: { name: after.name, amount: after.amount, category: after.category, note: after.note } };
        return next;
      }
    }
  }
  if (prev && op.kind === 'delete' && prev.kind === 'create' && !queue.some((o) => o.uid === op.uid && o.id === locked)) {
    return queue.filter((o) => !(o.uid === op.uid && o.list === op.list));
  }
  return [...queue, op];
}

export interface FlushResult {
  /** Ops that were sent (or dropped because they can't succeed). */
  done: string[];
  /** Human-readable problems with dropped ops */
  errors: string[];
  /** Stopped early because the server is unreachable */
  offline: boolean;
}

const MAX_CONFLICT_RETRIES = 3;

async function sendOp(dav: DavLike, op: Op, known: Map<string, Item>): Promise<void> {
  const href = known.get(op.uid)?.href ?? itemHref(op.list, op.uid);

  if (op.kind === 'create') {
    const ics = createTodo({ uid: op.uid, ...op.fields });
    try {
      const etag = await dav.put(href, ics, { create: true });
      known.set(op.uid, { uid: op.uid, href, etag, ...op.fields, completed: false, raw: ics });
    } catch (e) {
      // 412: an earlier attempt landed but we never saw the reply.
      if (!(e instanceof DavError && e.status === 412)) throw e;
      known.delete(op.uid);
    }
    return;
  }

  for (let attempt = 0; attempt <= MAX_CONFLICT_RETRIES; attempt++) {
    let current = attempt === 0 ? known.get(op.uid) : undefined;
    if (!current || !current.raw) {
      const fresh = await dav.getItem(href);
      if (!fresh) return; // gone on the server: nothing to update or delete
      current = fresh;
    }
    try {
      if (op.kind === 'delete') {
        await dav.remove(current.href, current.etag);
        known.delete(op.uid);
      } else {
        const next = applyPatch(current, op.patch);
        const ics = serializeItem(next);
        const etag = await dav.put(current.href, ics, { etag: current.etag });
        known.set(op.uid, { ...next, raw: ics, etag });
      }
      return;
    } catch (e) {
      if (e instanceof DavError && e.status === 412) {
        known.delete(op.uid);
        continue; // someone else changed it — re-read and re-apply our intent
      }
      throw e;
    }
  }
  throw new DavError(412, 'Varen blev ændret samtidig flere gange');
}

/**
 * Send queued ops in order. `known` is the latest server snapshot by uid and
 * is updated as ops land. Stops at the first network failure.
 */
export async function flush(
  dav: DavLike,
  queue: Op[],
  known: Map<string, Item>,
  onStart: (op: Op) => void = () => {},
): Promise<FlushResult> {
  const result: FlushResult = { done: [], errors: [], offline: false };
  for (const op of queue) {
    onStart(op);
    try {
      await sendOp(dav, op, known);
      result.done.push(op.id);
    } catch (e) {
      if (isNetworkError(e)) {
        result.offline = true;
        break;
      }
      if (e instanceof DavError && e.status === 401) {
        result.errors.push(e.message);
        break; // keep the queue; the user needs to log in again
      }
      result.done.push(op.id);
      result.errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  return result;
}
