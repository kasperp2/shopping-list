export interface Item {
  uid: string;
  /** Absolute URL of the .ics resource. */
  href: string;
  etag?: string;
  name: string;
  amount: number;
  /** Category label as stored in CATEGORIES ('' when none). */
  category: string;
  note: string;
  completed: boolean;
  /** ISO timestamps */
  completedAt?: string;
  createdAt?: string;
  modifiedAt?: string;
  /** Original iCalendar text, kept so edits preserve other apps' properties. */
  raw: string;
}

export interface ItemPatch {
  amountDelta?: number;
  name?: string;
  category?: string;
  note?: string;
  completed?: boolean;
}

export interface ShoppingList {
  url: string;
  name: string;
  color?: string;
  ctag?: string;
}

export interface Credentials {
  serverUrl: string;
  username: string;
  password: string;
}

export interface QuickButton {
  name: string;
}
