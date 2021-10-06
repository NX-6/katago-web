// based on https://dev.to/stefnotch/enabling-coop-coep-without-touching-the-server-2d3n

if (typeof window !== 'undefined') {

  function condReload(reg) {
    // in some environments it becomes active with a delay (e.g. Chrome incognito)
    if (reg.active) {
      window.location.reload();
      return true;
    }
  }

  // initial load via `<script>`
  if (navigator.serviceWorker) {
    if (navigator.serviceWorker.controller) {
      console.log('service worker in control.');
    } else {
      console.log('starting service worker...');
      navigator.serviceWorker
        .register(window.document.currentScript.src)
        .then(reg => { condReload(reg) || setTimeout(_ => condReload(reg), 100); });
    }
  } else {
    console.warn("service workers not supported");
  }

} else {

  // subsequent load via `register` (in service worker context)
  self.addEventListener("install", () => self.skipWaiting());
  self.addEventListener("activate", ev => ev.waitUntil(self.clients.claim()));
  self.addEventListener("fetch", ev => {
    if (ev.request.cache === "only-if-cached"
     && ev.request.mode  !== "same-origin")
      return;

    ev.respondWith(
      fetch(ev.request).then(res => {

        const hdrs = new Headers(res.headers);
        hdrs.set("Cross-Origin-Embedder-Policy", "require-corp")
        hdrs.set("Cross-Origin-Opener-Policy", "same-origin");

        return new Response(res.body, {
          headers: hdrs,
          status: res.status,
          statusText: res.statusText
        });
      })
    );
  });

}
