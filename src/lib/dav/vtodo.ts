import ICAL from 'ical.js';
import { clampAmount, formatSummary, parseSummary } from '../amount';
import type { Item, ItemPatch } from '../types';

const PRODID = '-//shopping-list//Indkøb//DA';

function iso(value: unknown): string | undefined {
  if (value instanceof ICAL.Time) return value.toJSDate().toISOString();
  return undefined;
}

function nowUtc(): ICAL.Time {
  return ICAL.Time.fromJSDate(new Date(), true);
}

function firstTodo(raw: string): { cal: ICAL.Component; todo: ICAL.Component } | null {
  try {
    const cal = new ICAL.Component(ICAL.parse(raw));
    const todo = cal.getFirstSubcomponent('vtodo');
    return todo ? { cal, todo } : null;
  } catch {
    return null;
  }
}

function categoriesOf(todo: ICAL.Component): string[] {
  return todo
    .getAllProperties('categories')
    .flatMap((p) => p.getValues().map(String))
    .map((c) => c.trim())
    .filter(Boolean);
}

/** Parse one calendar object into an Item, or null when it holds no VTODO. */
export function parseTodo(raw: string, href: string, etag?: string): Item | null {
  const parsed = firstTodo(raw);
  if (!parsed) return null;
  const { todo } = parsed;
  const uid = String(todo.getFirstPropertyValue('uid') ?? href);
  const { name, amount } = parseSummary(String(todo.getFirstPropertyValue('summary') ?? ''));
  const status = String(todo.getFirstPropertyValue('status') ?? '').toUpperCase();
  const percent = Number(todo.getFirstPropertyValue('percent-complete') ?? 0);
  const completedAt = iso(todo.getFirstPropertyValue('completed'));
  return {
    uid,
    href,
    etag,
    name,
    amount,
    category: categoriesOf(todo)[0] ?? '',
    note: String(todo.getFirstPropertyValue('description') ?? ''),
    completed: status === 'COMPLETED' || percent >= 100 || (!!completedAt && status !== 'NEEDS-ACTION'),
    completedAt,
    createdAt: iso(todo.getFirstPropertyValue('created')) ?? iso(todo.getFirstPropertyValue('dtstamp')),
    modifiedAt: iso(todo.getFirstPropertyValue('last-modified')) ?? iso(todo.getFirstPropertyValue('dtstamp')),
    raw,
  };
}

/** Fields an item ends up with after a patch (pure, used for optimistic UI). */
export function applyPatch(item: Item, patch: ItemPatch, now = new Date()): Item {
  const next = { ...item };
  if (patch.amountDelta) next.amount = clampAmount(item.amount + patch.amountDelta);
  if (patch.name !== undefined) next.name = patch.name;
  if (patch.category !== undefined) next.category = patch.category;
  if (patch.note !== undefined) next.note = patch.note;
  if (patch.completed !== undefined && patch.completed !== item.completed) {
    next.completed = patch.completed;
    next.completedAt = patch.completed ? now.toISOString() : undefined;
  }
  next.modifiedAt = now.toISOString();
  return next;
}

function setText(todo: ICAL.Component, prop: string, value: string) {
  if (value) todo.updatePropertyWithValue(prop, value);
  else todo.removeAllProperties(prop);
}

/**
 * Write an item's fields into its original iCalendar text, touching only the
 * properties we own so anything other apps added survives.
 */
export function serializeItem(item: Item): string {
  const parsed = firstTodo(item.raw);
  if (!parsed) return createTodo(item);
  const { cal, todo } = parsed;
  const now = nowUtc();

  todo.updatePropertyWithValue('summary', formatSummary(item.name, item.amount));
  // Keep any extra categories other apps set; replace only the first one.
  const others = categoriesOf(todo).slice(1).filter((c) => c !== item.category);
  todo.removeAllProperties('categories');
  const cats = [item.category, ...others].filter(Boolean);
  if (cats.length) {
    const prop = new ICAL.Property('categories', todo);
    prop.setValues(cats);
    todo.addProperty(prop);
  }
  setText(todo, 'description', item.note);

  const wasCompleted = String(todo.getFirstPropertyValue('status') ?? '').toUpperCase() === 'COMPLETED';
  if (item.completed) {
    todo.updatePropertyWithValue('status', 'COMPLETED');
    todo.updatePropertyWithValue('percent-complete', 100);
    if (!wasCompleted || !todo.getFirstPropertyValue('completed')) {
      todo.updatePropertyWithValue(
        'completed',
        item.completedAt ? ICAL.Time.fromJSDate(new Date(item.completedAt), true) : now,
      );
    }
  } else {
    todo.updatePropertyWithValue('status', 'NEEDS-ACTION');
    todo.removeAllProperties('completed');
    todo.removeAllProperties('percent-complete');
  }

  todo.updatePropertyWithValue('last-modified', now);
  todo.updatePropertyWithValue('dtstamp', now);
  const seq = Number(todo.getFirstPropertyValue('sequence') ?? 0);
  todo.updatePropertyWithValue('sequence', seq + 1);
  return cal.toString();
}

export function createTodo(fields: Pick<Item, 'uid' | 'name' | 'amount' | 'category' | 'note'> & Partial<Item>): string {
  const cal = new ICAL.Component(['vcalendar', [], []]);
  cal.updatePropertyWithValue('version', '2.0');
  cal.updatePropertyWithValue('prodid', PRODID);
  const todo = new ICAL.Component('vtodo', cal);
  const now = nowUtc();
  todo.updatePropertyWithValue('uid', fields.uid);
  todo.updatePropertyWithValue('dtstamp', now);
  todo.updatePropertyWithValue('created', now);
  todo.updatePropertyWithValue('last-modified', now);
  todo.updatePropertyWithValue('summary', formatSummary(fields.name, fields.amount));
  todo.updatePropertyWithValue('status', fields.completed ? 'COMPLETED' : 'NEEDS-ACTION');
  if (fields.completed) {
    todo.updatePropertyWithValue('completed', now);
    todo.updatePropertyWithValue('percent-complete', 100);
  }
  if (fields.category) todo.updatePropertyWithValue('categories', fields.category);
  if (fields.note) todo.updatePropertyWithValue('description', fields.note);
  cal.addSubcomponent(todo);
  return cal.toString();
}

export function newUid(): string {
  return crypto.randomUUID();
}
