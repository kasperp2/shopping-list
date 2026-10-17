import { nameKey, tidyName } from '../amount';
import { categorize, DEFAULT_CATEGORIES, FALLBACK_ID, findCategory, type Category } from '../categories';
import { DavClient, DavError, isNetworkError, type ServerConfig } from '../dav/client';
import { newUid } from '../dav/vtodo';
import { clearAll, load, save } from '../storage';
import { buildHistory, learnedCategories, type HistoryEntry } from '../suggest';
import { applyOps, enqueue, flush, type NewItemFields, type Op } from '../sync';
import type { Credentials, Item, ItemPatch, QuickButton, ShoppingList } from '../types';

const POLL_MS = 30_000;
const LINGER_MS = 5_000;
const FLUSH_DEBOUNCE_MS = 400;

export interface Toast {
  id: number;
  text: string;
  action?: { label: string; run: () => void };
}

export interface Section {
  key: string;
  title: string;
  items: Item[];
}

interface ListCache {
  ctag?: string;
  items: Item[];
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type OpInput = DistributiveOmit<Op, 'id' | 'list'> & { list?: string };

function normalizeServerUrl(url: string): string {
  const t = url.trim();
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

class AppState {
  config = $state<ServerConfig>({ proxy: false, targetPath: '/' });
  ready = $state(false);
  creds = $state<Credentials | null>(load('creds', null));
  home = $state<string | null>(load('home', null));
  lists = $state<ShoppingList[]>(load('lists', []));
  currentUrl = $state<string | null>(load('current', null));
  serverItems = $state<Item[]>([]);
  queue = $state<Op[]>(load('queue', []));
  categories = $state<Category[]>(load('categories', DEFAULT_CATEGORIES));
  quick = $state<Record<string, QuickButton[]>>(load('quick', {}));
  online = $state(typeof navigator === 'undefined' ? true : navigator.onLine);
  syncing = $state(false);
  loaded = $state(false);
  toast = $state<Toast | null>(null);
  /** uid → time it was ticked; ticked items linger so a mis-tap can be undone */
  justTicked = $state<Record<string, number>>({});

  items = $derived(this.currentUrl ? applyOps(this.serverItems, this.queue, this.currentUrl) : []);
  currentList = $derived(this.lists.find((l) => l.url === this.currentUrl));
  history = $derived(buildHistory(this.items));
  learned = $derived(learnedCategories(this.history));
  quickButtons = $derived((this.currentUrl && this.quick[this.currentUrl]) || []);
  pending = $derived(this.queue.length);

  /** Open items grouped by category in store order; ticked ones sink to the bottom. */
  sections = $derived.by(() => {
    const visible = this.items.filter((i) => !i.completed || this.justTicked[i.uid]);
    const known = new Map<string, Section>();
    for (const c of this.categories) known.set(c.id, { key: c.id, title: c.name, items: [] });
    const extra = new Map<string, Section>();
    for (const item of visible) {
      const cat = findCategory(this.categories, item.category);
      if (cat) known.get(cat.id)!.items.push(item);
      else if (item.category) {
        const k = nameKey(item.category);
        if (!extra.has(k)) extra.set(k, { key: `x:${k}`, title: item.category, items: [] });
        extra.get(k)!.items.push(item);
      } else known.get(FALLBACK_ID)?.items.push(item);
    }
    const ordered = [...known.values()];
    const fallbackIdx = ordered.findIndex((s) => s.key === FALLBACK_ID);
    ordered.splice(fallbackIdx < 0 ? ordered.length : fallbackIdx, 0, ...extra.values());
    for (const s of ordered) {
      s.items.sort((a, b) => Number(a.completed) - Number(b.completed) || a.name.localeCompare(b.name, 'da'));
    }
    return ordered.filter((s) => s.items.length);
  });

  openCount = $derived(this.items.filter((i) => !i.completed).length);

  private dav: DavClient | null = null;
  private ctag: string | undefined;
  private inFlight: string | undefined;
  private running: Promise<void> | null = null;
  private again = false;
  private flushTimer: ReturnType<typeof setTimeout> | undefined;
  private toastId = 0;

  async init() {
    try {
      const res = await fetch('/config.json', { cache: 'no-store' });
      if (res.ok) this.config = await res.json();
    } catch {
      // offline start: use defaults / last known mode
      this.config = load('config', this.config);
    }
    save('config', this.config);
    if (this.creds) {
      this.dav = new DavClient(this.creds, this.config);
      this.loadCache();
      void this.sync({ lists: true });
    }
    this.ready = true;

    window.addEventListener('online', () => {
      this.online = true;
      void this.sync();
    });
    window.addEventListener('offline', () => (this.online = false));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void this.sync({ lists: true });
    });
    setInterval(() => {
      if (document.visibilityState === 'visible') void this.sync();
    }, POLL_MS);
  }

  // ---------- account ----------

  async login(serverUrl: string, username: string, password: string) {
    const creds: Credentials = { serverUrl: this.config.proxy ? '' : normalizeServerUrl(serverUrl), username: username.trim(), password };
    const dav = new DavClient(creds, this.config);
    const home = await dav.homeUrl();
    let lists = await dav.listCollections(home);
    if (!lists.length) {
      await dav.createList(home, 'Indkøbsliste');
      lists = await dav.listCollections(home);
    }
    this.dav = dav;
    this.creds = creds;
    this.home = home;
    this.lists = lists;
    if (!lists.some((l) => l.url === this.currentUrl)) this.currentUrl = lists[0]?.url ?? null;
    save('creds', creds);
    save('home', home);
    save('lists', lists);
    save('current', this.currentUrl);
    this.loadCache();
    await this.sync({ force: true });
  }

  logout() {
    clearAll();
    this.dav = null;
    this.creds = null;
    this.home = null;
    this.lists = [];
    this.currentUrl = null;
    this.serverItems = [];
    this.queue = [];
    this.quick = {};
    this.categories = DEFAULT_CATEGORIES;
    this.loaded = false;
    save('config', this.config);
  }

  // ---------- sync ----------

  private loadCache() {
    const cache = this.currentUrl ? load<ListCache | null>(`cache:${this.currentUrl}`, null) : null;
    this.serverItems = cache?.items ?? [];
    this.ctag = cache?.ctag;
    this.loaded = !!cache;
  }

  private saveCache() {
    if (this.currentUrl) save(`cache:${this.currentUrl}`, { ctag: this.ctag, items: $state.snapshot(this.serverItems) });
  }

  private persistQueue() {
    save('queue', $state.snapshot(this.queue));
  }

  /** Push pending changes, then pull the list if it changed. Calls coalesce. */
  sync(opts: { force?: boolean; lists?: boolean } = {}): Promise<void> {
    if (this.running) {
      this.again = true;
      return this.running;
    }
    this.running = (async () => {
      try {
        do {
          this.again = false;
          await this.syncOnce(opts);
          opts = {};
        } while (this.again);
      } finally {
        this.running = null;
      }
    })();
    return this.running;
  }

  private async syncOnce({ force = false, lists = false }) {
    const dav = this.dav;
    if (!dav) return;
    this.syncing = true;
    try {
      if (lists && this.home) await this.refreshLists();
      if (this.queue.length) await this.flushQueue(dav);
      const url = this.currentUrl;
      if (!url) return;
      const ctag = await dav.ctag(url).catch((e) => {
        if (isNetworkError(e) || (e instanceof DavError && e.status === 401)) throw e;
        return undefined;
      });
      if (force || !ctag || ctag !== this.ctag || !this.loaded) {
        const items = await dav.fetchItems(url);
        if (url !== this.currentUrl) return; // switched list meanwhile
        this.serverItems = items;
        this.ctag = ctag;
        this.loaded = true;
        this.saveCache();
      }
      this.online = true;
    } catch (e) {
      if (isNetworkError(e)) this.online = false;
      else if (e instanceof DavError && e.status === 401) this.showToast('Log ind igen – adgangskoden blev afvist');
      else if (e instanceof DavError && e.status === 404 && this.home) await this.refreshLists().catch(() => {});
      else console.error(e);
    } finally {
      this.syncing = false;
    }
  }

  private async flushQueue(dav: DavClient) {
    const known = new Map(this.serverItems.map((i) => [i.uid, $state.snapshot(i) as Item]));
    const result = await flush(dav, $state.snapshot(this.queue) as Op[], known, (op) => (this.inFlight = op.id));
    this.inFlight = undefined;
    const done = new Set(result.done);
    this.queue = this.queue.filter((o) => !done.has(o.id));
    this.persistQueue();
    // Adopt what we just wrote so the view doesn't flicker before the next fetch.
    const url = this.currentUrl;
    if (url) {
      this.serverItems = [...known.values()].filter((i) => i.href.startsWith(url));
      this.ctag = undefined;
      this.saveCache();
    }
    if (result.offline) {
      this.online = false;
      throw new TypeError('offline');
    }
    for (const err of result.errors) this.showToast(err);
  }

  private scheduleFlush() {
    clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => void this.sync(), FLUSH_DEBOUNCE_MS);
  }

  private push(op: OpInput) {
    const list = op.list ?? this.currentUrl;
    if (!list) return;
    this.queue = enqueue(this.queue, { ...op, list, id: newUid() } as Op, this.inFlight);
    this.persistQueue();
    this.scheduleFlush();
  }

  // ---------- items ----------

  findOpen(name: string): Item | undefined {
    const key = nameKey(name);
    return this.items.find((i) => !i.completed && nameKey(i.name) === key);
  }

  /** Add by name; bumps the amount if it's already on the list. */
  add(rawName: string, amount = 1) {
    const name = tidyName(rawName);
    if (!name) return;
    const existing = this.findOpen(name);
    if (existing) {
      this.push({ kind: 'update', uid: existing.uid, patch: { amountDelta: amount } });
      this.showToast(`${existing.name} → ${existing.amount + amount}`);
      return;
    }
    const fields: NewItemFields = {
      name,
      amount,
      category: categorize(name, this.learned, this.categories),
      note: '',
    };
    this.push({ kind: 'create', uid: newUid(), fields });
  }

  update(uid: string, patch: ItemPatch) {
    this.push({ kind: 'update', uid, patch });
  }

  changeAmount(uid: string, delta: number) {
    const item = this.items.find((i) => i.uid === uid);
    if (!item || item.amount + delta < 1 || item.amount + delta > 99) return;
    this.update(uid, { amountDelta: delta });
  }

  toggle(uid: string) {
    const item = this.items.find((i) => i.uid === uid);
    if (!item) return;
    const { [uid]: _, ...rest } = this.justTicked;
    if (item.completed) {
      this.justTicked = rest;
      this.update(uid, { completed: false });
      return;
    }
    this.justTicked = { ...rest, [uid]: Date.now() };
    this.update(uid, { completed: true });
    setTimeout(() => {
      const { [uid]: _gone, ...left } = this.justTicked;
      this.justTicked = left;
    }, LINGER_MS);
  }

  remove(uid: string) {
    const item = this.items.find((i) => i.uid === uid);
    if (!item) return;
    this.push({ kind: 'delete', uid });
    if (!item.completed) {
      this.showToast(`${item.name} slettet`, {
        label: 'Fortryd',
        run: () => this.push({ kind: 'create', uid: newUid(), fields: { name: item.name, amount: item.amount, category: item.category, note: item.note } }),
      });
    }
  }

  /** Delete the completed copies of one history entry (keeps an open one). */
  removeFromHistory(entry: HistoryEntry) {
    for (const item of entry.completed) this.push({ kind: 'delete', uid: item.uid });
  }

  // ---------- quick add ----------

  hasQuick(name: string): boolean {
    const key = nameKey(name);
    return this.quickButtons.some((q) => nameKey(q.name) === key);
  }

  private setQuick(buttons: QuickButton[]) {
    if (!this.currentUrl) return;
    this.quick = { ...this.quick, [this.currentUrl]: buttons };
    save('quick', $state.snapshot(this.quick));
  }

  addQuick(name: string) {
    if (!this.hasQuick(name)) this.setQuick([...this.quickButtons, { name: tidyName(name) }]);
  }

  removeQuick(name: string) {
    const key = nameKey(name);
    this.setQuick(this.quickButtons.filter((q) => nameKey(q.name) !== key));
  }

  moveQuick(from: number, to: number) {
    const next = [...this.quickButtons];
    const [b] = next.splice(from, 1);
    next.splice(to, 0, b);
    this.setQuick(next);
  }

  // ---------- lists ----------

  async refreshLists() {
    if (!this.dav || !this.home) return;
    const lists = await this.dav.listCollections(this.home);
    this.lists = lists;
    save('lists', lists);
    if (!lists.some((l) => l.url === this.currentUrl) && lists[0]) this.selectList(lists[0].url);
  }

  selectList(url: string) {
    if (url === this.currentUrl) return;
    this.currentUrl = url;
    this.justTicked = {};
    save('current', url);
    this.loadCache();
    void this.sync({ force: !this.loaded });
  }

  async createList(name: string) {
    if (!this.dav || !this.home) return;
    const url = await this.dav.createList(this.home, name.trim());
    await this.refreshLists();
    const created = this.lists.find((l) => l.url === url) ?? this.lists.find((l) => l.name === name.trim());
    if (created) this.selectList(created.url);
  }

  /** Only lists with no items at all — open or completed — may be deleted. */
  async deleteList(url: string): Promise<boolean> {
    if (!this.dav) return false;
    const items = await this.dav.fetchItems(url);
    if (items.length || this.queue.some((o) => o.list === url)) {
      this.showToast('Kun tomme lister kan slettes');
      return false;
    }
    await this.dav.deleteList(url);
    const { [url]: _, ...quick } = this.quick;
    this.quick = quick;
    save('quick', quick);
    save(`cache:${url}`, undefined);
    if (this.currentUrl === url) this.currentUrl = null;
    await this.refreshLists();
    return true;
  }

  // ---------- categories ----------

  private saveCategories(cats: Category[]) {
    this.categories = cats;
    save('categories', $state.snapshot(cats));
  }

  renameCategory(id: string, name: string) {
    const clean = name.trim();
    if (!clean) return;
    this.saveCategories(
      this.categories.map((c) => (c.id === id && c.name !== clean ? { ...c, name: clean, aliases: [...new Set([...c.aliases, c.name])] } : c)),
    );
  }

  addCategory(name: string) {
    const clean = name.trim();
    if (!clean || findCategory(this.categories, clean)) return;
    const cats = [...this.categories];
    const fallback = cats.findIndex((c) => c.id === FALLBACK_ID);
    cats.splice(fallback < 0 ? cats.length : fallback, 0, { id: newUid(), name: clean, aliases: [] });
    this.saveCategories(cats);
  }

  removeCategory(id: string) {
    if (id === FALLBACK_ID) return;
    this.saveCategories(this.categories.filter((c) => c.id !== id));
  }

  moveCategory(from: number, to: number) {
    const next = [...this.categories];
    const [c] = next.splice(from, 1);
    next.splice(to, 0, c);
    this.saveCategories(next);
  }

  resetCategories() {
    this.saveCategories(DEFAULT_CATEGORIES);
  }

  // ---------- toast ----------

  showToast(text: string, action?: Toast['action']) {
    const id = ++this.toastId;
    this.toast = { id, text, action };
    setTimeout(() => {
      if (this.toast?.id === id) this.toast = null;
    }, action ? 5000 : 2500);
  }
}

export const app = new AppState();
