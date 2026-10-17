# Indkøb – shopping list on your own CalDAV server

A small, mobile-first PWA for shared shopping lists, in Danish. There is no backend and no database: each item is a standard CalDAV task (VTODO) on your own server (built and tested against [Radicale](https://radicale.org)). The same list also shows up in Apple Reminders, Tasks.org, Thunderbird or your dashboard.

- **Quick-add buttons** per list, with an amount badge. Hold a button down to move or remove it.
- **Suggestions while you type**, based on what has been on the list before.
- **Automatic categories** in store order (Frugt & grønt → Brød → Kød → … → Husholdning). The app learns from your choices, and you can reorder and rename categories.
- **⋯ menu** on each item: amount (− / +), create quick-add button, category, rename, note, delete.
- **Tidligere varer:** history of everything ticked off. Tap to add again, swipe to delete.
- **Shared and offline:** several phones can use the same login. Changes are saved locally and sent when you're online again. Edits made at the same time on different phones don't overwrite each other (ETag).
- iOS-style design, dark mode, and installable on the home screen.

## Running with Docker

```yaml
# docker-compose.yml
services:
  shopping-list:
    image: ghcr.io/kasperp2/shopping-list:latest
    restart: unless-stopped
    ports:
      - "3000:3000"
    # environment:
    #   CALDAV_PROXY_TARGET: "https://dav.example.com"
```

```bash
docker compose up -d
```

Open `http://<server>:3000`, log in with your CalDAV address, username and password, and on iPhone choose **Del → Føj til hjemmeskærm** ("Share → Add to Home Screen").

The image runs on `linux/amd64` (Intel/AMD, e.g. a Lenovo ThinkCentre) and `linux/arm64` (Raspberry Pi).

> Use HTTPS (e.g. behind Caddy, Traefik or Nginx Proxy Manager). Browsers only allow installation and offline mode over HTTPS, and you're sending a password.

### Two ways to reach Radicale

**1. Directly from the browser (default).** Radicale must allow CORS. Add this to the Radicale config:

```ini
[headers]
Access-Control-Allow-Origin = https://indkoeb.example.com
Access-Control-Allow-Methods = GET, PUT, DELETE, PROPFIND, PROPPATCH, REPORT, MKCALENDAR, MKCOL, OPTIONS
Access-Control-Allow-Headers = Authorization, Content-Type, Depth, If-Match, If-None-Match, Prefer
Access-Control-Expose-Headers = ETag
```

**2. Through the container (no CORS).** Set `CALDAV_PROXY_TARGET` to your Radicale URL. The container then forwards `/dav/*` to that one server and nowhere else. It stores nothing; your login is just passed through. The login screen then asks only for username and password.

## What is stored where?

| Data | Where |
| --- | --- |
| Items, amounts, categories, notes, completed | On the CalDAV server (VTODO: `SUMMARY: 2 × Mælk`, `CATEGORIES`, `DESCRIPTION`, `STATUS`) |
| Login, last-opened list, quick-add buttons, category order, offline queue | In the browser's localStorage on each device |

"Log ud" (log out) deletes everything locally. The lists stay on the server.

## Development

Requires [Bun](https://bun.sh) ≥ 1.4.

```bash
docker compose -f docker-compose.dev.yml up -d   # Vite with hot reload on :5173 + Radicale on :5232 (test / test)
bun install                                      # for the tests and the type check on the host
bun test tests                                   # unit tests
bun run check                                    # type check
```

Open `http://localhost:5173`, or `http://<your computer's LAN IP>:5173` on a phone on the same Wi-Fi. Edits to `src/` reload on the phone straight away. By default the dev server reaches Radicale through the `/dav` proxy, so the phone only needs port 5173. To try direct (CORS) mode, start with `DEV_PROXY= docker compose -f docker-compose.dev.yml up -d` and log in with `http://<LAN IP>:5232`. Over plain http the service worker doesn't register, so offline mode and installing need the HTTPS production setup.

The structure:

- `src/lib/dav/`: a small CalDAV client (PROPFIND/REPORT/PUT/DELETE/MKCALENDAR) and the VTODO ↔ item mapping (ical.js, which keeps other apps' properties)
- `src/lib/sync.ts`: offline queue; the server snapshot plus pending changes make up what you see. 412 conflicts are re-read and reapplied.
- `src/lib/categories.ts`: Danish keyword dictionary and categories
- `src/components/`: Svelte 5 UI (sheets, swipe rows, springs)
- `server.ts`: Bun server for static files plus the optional CalDAV proxy

Pushes to `main` build and publish `ghcr.io/kasperp2/shopping-list:latest`. Tags `v1.2.3` publish versioned images.

## License

MIT
