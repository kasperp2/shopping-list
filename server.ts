// Serves the built PWA. Holds no data. When CALDAV_PROXY_TARGET is set it
// also forwards /dav/* to that one CalDAV server, for setups where the
// browser can't reach the server directly (no CORS headers).

import { join, normalize } from 'node:path';

const PORT = Number(process.env.PORT ?? 3000);
const DIST = join(import.meta.dir, 'dist');
const TARGET = process.env.CALDAV_PROXY_TARGET?.trim().replace(/\/?$/, '/');
const target = TARGET ? new URL(TARGET) : null;

const config = JSON.stringify({ proxy: !!target, targetPath: target?.pathname ?? '/' });

// Request headers CalDAV needs; everything else (cookies etc.) stays behind.
const FORWARD_REQ = ['authorization', 'content-type', 'depth', 'if-match', 'if-none-match', 'prefer', 'brief'];
const FORWARD_RES = ['content-type', 'etag', 'dav', 'allow', 'last-modified', 'content-length'];

async function proxy(req: Request, path: string): Promise<Response> {
  const url = new URL(path.replace(/^\/dav\/?/, ''), target!);
  // Never let a crafted path escape the configured server.
  if (url.origin !== target!.origin || !url.pathname.startsWith(target!.pathname)) {
    return new Response('Forbidden', { status: 403 });
  }
  url.search = new URL(req.url).search;
  const headers = new Headers();
  for (const h of FORWARD_REQ) {
    const v = req.headers.get(h);
    if (v) headers.set(h, v);
  }
  const res = await fetch(url, {
    method: req.method,
    headers,
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.arrayBuffer(),
    redirect: 'manual',
  });
  const out = new Headers({ 'cache-control': 'no-store' });
  for (const h of FORWARD_RES) {
    const v = res.headers.get(h);
    if (v) out.set(h, v);
  }
  // Dropping WWW-Authenticate stops the browser from showing its own login popup.
  return new Response(res.body, { status: res.status, headers: out });
}

const IMMUTABLE = /^\/assets\//;

async function staticFile(path: string): Promise<Response> {
  const safe = normalize(decodeURIComponent(path)).replace(/^(\.\.[/\\])+/, '');
  let file = Bun.file(join(DIST, safe));
  if (safe.endsWith('/') || !(await file.exists())) {
    // SPA fallback for unknown routes; real missing assets get a 404.
    if (/\.[a-z0-9]+$/i.test(safe)) return new Response('Not found', { status: 404 });
    file = Bun.file(join(DIST, 'index.html'));
  }
  const cache = IMMUTABLE.test(safe)
    ? 'public, max-age=31536000, immutable'
    : 'no-cache'; // index.html, sw.js, manifest: always revalidate
  return new Response(file, { headers: { 'cache-control': cache } });
}

const server = Bun.serve({
  port: PORT,
  hostname: '0.0.0.0',
  async fetch(req) {
    const { pathname } = new URL(req.url);
    if (pathname === '/config.json') {
      return new Response(config, { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
    }
    if (pathname === '/healthz') return new Response('ok');
    if (pathname === '/dav' || pathname.startsWith('/dav/')) {
      if (!target) return new Response('Proxy disabled', { status: 404 });
      try {
        return await proxy(req, pathname);
      } catch (e) {
        console.error('proxy error', e);
        return new Response('Bad gateway', { status: 502 });
      }
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return new Response('Method not allowed', { status: 405 });
    return staticFile(pathname);
  },
});

console.log(`Indkøb kører på http://localhost:${server.port}${target ? ` · CalDAV-proxy → ${target.href}` : ''}`);
