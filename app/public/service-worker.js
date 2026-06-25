// Notes App service worker
// Strategy:
// - HTML/JSX/CSS/icons → cache-first, updated in background (stale-while-revalidate)
// - CDN scripts → cache-first (immutable URLs)
// - /api/* → NEVER cached; always go to network. If offline → return a synthetic
//   error response so the app's auto-save retry path kicks in.
// - /login → network-first (must always reflect current auth state)
//
// Bump CACHE_VERSION whenever the static-asset list changes to force a refresh.

const CACHE_VERSION = "notes-v10-tabs-theme";
const STATIC_CACHE  = `notes-static-${CACHE_VERSION}`;
const CDN_CACHE     = "notes-cdn-v1";

const STATIC_URLS = [
  "/",
  "/manifest.json",
  "/icon.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-180.png",
  "/icon-maskable-512.png",
  // Pre-compiled JS bundles (no in-browser Babel)
  "/dist/icons.js",
  "/dist/utils.js",
  "/dist/hermes.js",
  "/dist/filetypes.js",
  "/dist/previewers.js",
  "/dist/pptx-render.js",
  "/dist/search.js",
  "/dist/attributes.js",
  "/dist/tweaks-panel.js",
  "/dist/panes.js",
  "/dist/mermaid.js",
  "/dist/history.js",
  "/dist/editors.js",
  "/dist/graph.js",
  "/dist/help.js",
  "/dist/office-convert.js",
  "/dist/app.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      // Pre-cache best-effort: failures here shouldn't block install
      return Promise.all(
        STATIC_URLS.map((u) =>
          fetch(u, { credentials: "same-origin" })
            .then((r) => (r.ok ? cache.put(u, r) : null))
            .catch(() => null)
        )
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== STATIC_CACHE && k !== CDN_CACHE).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // POST/PUT/DELETE never cached

  const url = new URL(req.url);

  // Same-origin handling
  if (url.origin === self.location.origin) {
    // API and auth endpoints: always network. Don't intercept — let the app's
    // own retry / offline UX handle failures.
    if (url.pathname.startsWith("/api/") || url.pathname === "/login") {
      return;
    }
    // Service worker file itself: never cache (so updates ship fast)
    if (url.pathname === "/service-worker.js") return;

    // Everything else (HTML, JSX, icons): stale-while-revalidate.
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        const network = fetch(req).then((resp) => {
          if (resp && resp.ok && resp.status === 200 && resp.type === "basic") {
            cache.put(req, resp.clone()).catch(() => {});
          }
          return resp;
        }).catch(() => null);
        return cached || (await network) || new Response("Offline", { status: 503 });
      })
    );
    return;
  }

  // Cross-origin: CDN libs (unpkg, cdnjs, jsdelivr, fonts) → cache-first
  if (/^(https:)?\/\/(cdnjs\.cloudflare\.com|unpkg\.com|cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com)/.test(req.url)) {
    event.respondWith(
      caches.open(CDN_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        if (cached) return cached;
        try {
          const resp = await fetch(req);
          if (resp && resp.ok) cache.put(req, resp.clone()).catch(() => {});
          return resp;
        } catch (e) {
          return cached || new Response("Offline", { status: 503 });
        }
      })
    );
  }
});

// Allow the app to ask the SW to skip waiting (smooth update on next reload)
self.addEventListener("message", (event) => {
  if (event.data === "skipWaiting") self.skipWaiting();
});
