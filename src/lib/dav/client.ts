import type { Credentials, Item, ShoppingList } from '../types';
import { parseTodo } from './vtodo';

const DAV = 'DAV:';
const CALDAV = 'urn:ietf:params:xml:ns:caldav';
const CS = 'http://calendarserver.org/ns/';
const APPLE = 'http://apple.com/ns/ical/';

export interface ServerConfig {
  /** The Bun server proxies /dav/* to a fixed CalDAV server. */
  proxy: boolean;
  /** Path prefix of the proxied server, e.g. "/" or "/radicale/". */
  targetPath: string;
}

export class DavError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** True when the request never reached the server (offline, DNS, CORS). */
export function isNetworkError(e: unknown): boolean {
  return e instanceof TypeError || (e instanceof DOMException && e.name === 'AbortError');
}

function basicAuth(username: string, password: string): string {
  const bytes = new TextEncoder().encode(`${username}:${password}`);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return 'Basic ' + btoa(bin);
}

function xmlEscape(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => `&#${c.charCodeAt(0)};`);
}

interface DavResponse {
  href: string;
  props: Element[];
}

function parseMultistatus(text: string): DavResponse[] {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  const out: DavResponse[] = [];
  for (const res of Array.from(doc.getElementsByTagNameNS(DAV, 'response'))) {
    const href = res.getElementsByTagNameNS(DAV, 'href')[0]?.textContent?.trim();
    if (!href) continue;
    const props: Element[] = [];
    for (const ps of Array.from(res.getElementsByTagNameNS(DAV, 'propstat'))) {
      const status = ps.getElementsByTagNameNS(DAV, 'status')[0]?.textContent ?? '';
      if (!/\s2\d\d\s/.test(status + ' ')) continue;
      const prop = ps.getElementsByTagNameNS(DAV, 'prop')[0];
      if (prop) props.push(...Array.from(prop.children));
    }
    out.push({ href, props });
  }
  return out;
}

function prop(r: DavResponse, ns: string, name: string): Element | undefined {
  return r.props.find((p) => p.namespaceURI === ns && p.localName === name);
}

function childHref(el: Element | undefined): string | undefined {
  return el?.getElementsByTagNameNS(DAV, 'href')[0]?.textContent?.trim() || undefined;
}

export class DavClient {
  private auth: string;
  private base: string;

  constructor(
    private creds: Credentials,
    private config: ServerConfig,
    private origin = typeof location !== 'undefined' ? location.origin : 'http://localhost',
  ) {
    this.auth = basicAuth(creds.username, creds.password);
    this.base = config.proxy ? `${this.origin}/dav/` : creds.serverUrl.replace(/\/?$/, '/');
  }

  /** Turn an href from the server into a URL the browser can request. */
  resolve(href: string): string {
    if (!this.config.proxy) return new URL(href, this.base).href;
    const path = new URL(href, 'http://x').pathname;
    const tp = this.config.targetPath.replace(/\/?$/, '/');
    const rest = path.startsWith(tp) ? path.slice(tp.length) : path.replace(/^\//, '');
    return this.base + rest;
  }

  async request(
    url: string,
    method: string,
    opts: { body?: string; depth?: '0' | '1'; headers?: Record<string, string> } = {},
  ): Promise<Response> {
    const headers: Record<string, string> = { Authorization: this.auth, ...opts.headers };
    if (opts.depth) headers.Depth = opts.depth;
    if (opts.body) headers['Content-Type'] ??= 'application/xml; charset=utf-8';
    const res = await fetch(url, { method, headers, body: opts.body, cache: 'no-store', credentials: 'omit' });
    if (!res.ok && res.status !== 207) {
      const msg = res.status === 401 ? 'Forkert brugernavn eller adgangskode' : `Serverfejl (${res.status})`;
      throw new DavError(res.status, msg);
    }
    return res;
  }

  private async propfind(url: string, depth: '0' | '1', props: string): Promise<DavResponse[]> {
    const body =
      `<?xml version="1.0" encoding="utf-8"?>` +
      `<d:propfind xmlns:d="DAV:" xmlns:c="${CALDAV}" xmlns:cs="${CS}" xmlns:a="${APPLE}"><d:prop>${props}</d:prop></d:propfind>`;
    const res = await this.request(url, 'PROPFIND', { body, depth });
    return parseMultistatus(await res.text());
  }

  private async principalUrl(): Promise<string> {
    const candidates = [this.base];
    if (!this.config.proxy) candidates.push(new URL('/.well-known/caldav', this.base).href);
    let lastError: unknown;
    for (const url of candidates) {
      try {
        const [r] = await this.propfind(url, '0', '<d:current-user-principal/>');
        const href = r && childHref(prop(r, DAV, 'current-user-principal'));
        if (href) return this.resolve(href);
      } catch (e) {
        if (e instanceof DavError && e.status === 401) throw e;
        lastError = e;
      }
    }
    if (isNetworkError(lastError)) throw lastError;
    throw new DavError(0, 'Kunne ikke finde en CalDAV-konto på adressen');
  }

  /** Discover the collection that holds the user's calendars/lists. */
  async homeUrl(): Promise<string> {
    const principal = await this.principalUrl();
    const [r] = await this.propfind(principal, '0', '<c:calendar-home-set/>');
    const href = r && childHref(prop(r, CALDAV, 'calendar-home-set'));
    return href ? this.resolve(href) : principal;
  }

  /** All collections that can hold tasks (VTODO). */
  async listCollections(home: string): Promise<ShoppingList[]> {
    const rs = await this.propfind(
      home,
      '1',
      '<d:resourcetype/><d:displayname/><c:supported-calendar-component-set/><cs:getctag/><a:calendar-color/>',
    );
    const lists: ShoppingList[] = [];
    for (const r of rs) {
      const type = prop(r, DAV, 'resourcetype');
      if (!type?.getElementsByTagNameNS(CALDAV, 'calendar').length) continue;
      const comps = prop(r, CALDAV, 'supported-calendar-component-set');
      if (comps) {
        const names = Array.from(comps.getElementsByTagNameNS(CALDAV, 'comp')).map((c) => c.getAttribute('name')?.toUpperCase());
        if (!names.includes('VTODO')) continue;
      }
      const url = this.resolve(r.href);
      const segments = url.replace(/\/$/, '').split('/');
      lists.push({
        url,
        name: prop(r, DAV, 'displayname')?.textContent?.trim() || decodeURIComponent(segments[segments.length - 1]),
        color: prop(r, APPLE, 'calendar-color')?.textContent?.trim() || undefined,
        ctag: prop(r, CS, 'getctag')?.textContent?.trim() || undefined,
      });
    }
    return lists.sort((a, b) => a.name.localeCompare(b.name, 'da'));
  }

  /** Cheap change marker for a collection; undefined if unsupported. */
  async ctag(listUrl: string): Promise<string | undefined> {
    const [r] = await this.propfind(listUrl, '0', '<cs:getctag/><d:sync-token/>');
    if (!r) return undefined;
    return (prop(r, CS, 'getctag') ?? prop(r, DAV, 'sync-token'))?.textContent?.trim() || undefined;
  }

  async fetchItems(listUrl: string): Promise<Item[]> {
    const body =
      `<?xml version="1.0" encoding="utf-8"?>` +
      `<c:calendar-query xmlns:d="DAV:" xmlns:c="${CALDAV}"><d:prop><d:getetag/><c:calendar-data/></d:prop>` +
      `<c:filter><c:comp-filter name="VCALENDAR"><c:comp-filter name="VTODO"/></c:comp-filter></c:filter></c:calendar-query>`;
    const res = await this.request(listUrl, 'REPORT', { body, depth: '1' });
    const items: Item[] = [];
    for (const r of parseMultistatus(await res.text())) {
      const data = prop(r, CALDAV, 'calendar-data')?.textContent;
      if (!data) continue;
      const item = parseTodo(data, this.resolve(r.href), prop(r, DAV, 'getetag')?.textContent?.trim());
      if (item) items.push(item);
    }
    return items;
  }

  async getItem(href: string): Promise<Item | null> {
    try {
      const res = await this.request(href, 'GET');
      return parseTodo(await res.text(), href, res.headers.get('ETag') ?? undefined);
    } catch (e) {
      if (e instanceof DavError && (e.status === 404 || e.status === 410)) return null;
      throw e;
    }
  }

  /** PUT a calendar object. Returns the new ETag when the server exposes it. */
  async put(href: string, ics: string, cond: { etag?: string; create?: boolean }): Promise<string | undefined> {
    const headers: Record<string, string> = { 'Content-Type': 'text/calendar; charset=utf-8' };
    if (cond.create) headers['If-None-Match'] = '*';
    else if (cond.etag) headers['If-Match'] = cond.etag;
    const res = await this.request(href, 'PUT', { body: ics, headers });
    return res.headers.get('ETag') ?? undefined;
  }

  async remove(href: string, etag?: string): Promise<void> {
    try {
      await this.request(href, 'DELETE', { headers: etag ? { 'If-Match': etag } : {} });
    } catch (e) {
      if (e instanceof DavError && (e.status === 404 || e.status === 410)) return;
      throw e;
    }
  }

  async createList(home: string, name: string): Promise<string> {
    const url = `${home.replace(/\/?$/, '/')}${crypto.randomUUID()}/`;
    const body =
      `<?xml version="1.0" encoding="utf-8"?>` +
      `<c:mkcalendar xmlns:d="DAV:" xmlns:c="${CALDAV}"><d:set><d:prop>` +
      `<d:displayname>${xmlEscape(name)}</d:displayname>` +
      `<c:supported-calendar-component-set><c:comp name="VTODO"/></c:supported-calendar-component-set>` +
      `</d:prop></d:set></c:mkcalendar>`;
    await this.request(url, 'MKCALENDAR', { body });
    return url;
  }

  async deleteList(url: string): Promise<void> {
    await this.request(url, 'DELETE');
  }
}
