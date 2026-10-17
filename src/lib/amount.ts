// Amount lives in the SUMMARY so other CalDAV apps show it: "2 × Mælk".
// We read the common variants other people/apps might type.

export interface ParsedSummary {
  name: string;
  amount: number;
}

const MAX_AMOUNT = 99;
// "500 g smør" is a name with a unit, not 500 items.
const UNITS = new Set(['g', 'gr', 'gram', 'kg', 'l', 'ltr', 'liter', 'dl', 'cl', 'ml', '%']);

const PATTERNS: { re: RegExp; amount: number; name: number }[] = [
  { re: /^(\d{1,2})\s*[×x*]\s*(.+)$/i, amount: 1, name: 2 }, // 2 × Mælk, 2x Mælk
  { re: /^(.+?)\s*×\s*(\d{1,2})$/, amount: 2, name: 1 }, // Mælk ×2
  { re: /^(.+?)\s+[x*]\s*(\d{1,2})$/i, amount: 2, name: 1 }, // Mælk x2
  { re: /^(.+?)\s*\((\d{1,2})\)$/, amount: 2, name: 1 }, // Mælk (2)
  { re: /^(\d{1,2})\s+(.+)$/, amount: 1, name: 2 }, // 2 Mælk
];

export function parseSummary(summary: string): ParsedSummary {
  const text = summary.trim().replace(/\s+/g, ' ');
  for (const p of PATTERNS) {
    const m = text.match(p.re);
    if (!m) continue;
    const amount = Number(m[p.amount]);
    const name = m[p.name].trim();
    if (!name || amount < 1 || amount > MAX_AMOUNT) continue;
    if (p.name === 2 && UNITS.has(name.split(' ')[0].toLowerCase())) continue;
    return { name, amount };
  }
  return { name: text, amount: 1 };
}

export function formatSummary(name: string, amount: number): string {
  const clean = name.trim().replace(/\s+/g, ' ');
  return amount > 1 ? `${amount} × ${clean}` : clean;
}

export function clampAmount(n: number): number {
  return Math.min(MAX_AMOUNT, Math.max(1, Math.round(n)));
}

/** Key used to compare item names: case-, space-insensitive. */
export function nameKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('da');
}

/** Capitalise first letter, keep the rest as typed. */
export function tidyName(name: string): string {
  const t = name.trim().replace(/\s+/g, ' ');
  return t.charAt(0).toLocaleUpperCase('da') + t.slice(1);
}
