import { nameKey } from './amount';
import type { Item } from './types';

export interface HistoryEntry {
  key: string;
  /** Most recent spelling */
  name: string;
  category: string;
  /** Times it has appeared on the list */
  count: number;
  /** ISO time it was last added or bought */
  lastUsed: string;
  /** Completed VTODOs carrying this name (for deleting from history) */
  completed: Item[];
}

function usedAt(item: Item): string {
  return item.completedAt ?? item.modifiedAt ?? item.createdAt ?? '';
}

/** Every distinct item name ever seen on the list. */
export function buildHistory(items: Item[]): HistoryEntry[] {
  const map = new Map<string, HistoryEntry>();
  for (const item of items) {
    if (!item.name) continue;
    const key = nameKey(item.name);
    const at = usedAt(item);
    const entry = map.get(key);
    if (!entry) {
      map.set(key, {
        key,
        name: item.name,
        category: item.category,
        count: 1,
        lastUsed: at,
        completed: item.completed ? [item] : [],
      });
      continue;
    }
    entry.count++;
    if (item.completed) entry.completed.push(item);
    if (at >= entry.lastUsed) {
      entry.lastUsed = at;
      entry.name = item.name;
      if (item.category) entry.category = item.category;
    }
  }
  return [...map.values()];
}

/** name → category it was filed under most recently. */
export function learnedCategories(history: HistoryEntry[]): Map<string, string> {
  return new Map(history.filter((h) => h.category).map((h) => [h.key, h.category]));
}

/**
 * Suggestions for what's being typed: whole-name prefix beats word prefix,
 * then how often it's bought, then how recently.
 */
export function suggest(query: string, history: HistoryEntry[], exclude: Set<string> = new Set(), limit = 8): HistoryEntry[] {
  const q = nameKey(query);
  if (!q) return [];
  const scored: { h: HistoryEntry; rank: number }[] = [];
  for (const h of history) {
    if (exclude.has(h.key) || h.key === q) continue;
    let rank = 0;
    if (h.key.startsWith(q)) rank = 2;
    else if (h.key.split(/[\s-]+/).some((w) => w.startsWith(q))) rank = 1;
    if (rank) scored.push({ h, rank });
  }
  scored.sort(
    (a, b) => b.rank - a.rank || b.h.count - a.h.count || b.h.lastUsed.localeCompare(a.h.lastUsed),
  );
  return scored.slice(0, limit).map((s) => s.h);
}
