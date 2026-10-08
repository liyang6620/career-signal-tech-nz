const CACHE_NAME = "careersignal-shell-v4";
const APP_SHELL = [
  "/",
  "/offline.html",
  "/manifest.webmanifest",
  "/icons/app-icon.svg",
  "/icons/app-icon-192.png",
  "/icons/app-icon-512.png",
  "/icons/app-icon-maskable-512.png",
  "/images/auckland-skyline.jpg",
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL);
    const home = await fetch("/");
    const markup = await home.clone().text();
    await cache.put("/", home);
    const buildAssets = [...markup.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((match) => match[1]);
    await cache.addAll([...new Set(buildAssets)]);
    const stylesheets = buildAssets.filter((asset) => asset.endsWith(".css"));
    const stylesheetText = await Promise.all(stylesheets.map((asset) => fetch(asset).then((response) => response.text())));
    const stylesheetAssets = stylesheetText.flatMap((css) =>
      [...css.matchAll(/url\((?:"|')?(\/assets\/[^)"']+)(?:"|')?\)/g)].map((match) => match[1]),
    );
    await cache.addAll([...new Set(stylesheetAssets)]);
  })());
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
          return response;
        })
        .catch(async () => (await caches.match(request, { ignoreVary: true })) || (await caches.match("/")) || caches.match("/offline.html")),
    );
    return;
  }

  if (["script", "style", "font", "image"].includes(request.destination)) {
    event.respondWith(
      caches.match(request, { ignoreVary: true }).then(async (cached) => {
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
        return response;
      }),
    );
  }
});
