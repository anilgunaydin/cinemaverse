/* Service Worker - CinemaVerse PWA with Offline Sync */

const CACHE_NAME = "cinemaverse-v1";
const STATIC_ASSETS = [
  "/",
  "/library",
  "/recommendations",
  "/community",
  "/wrapped",
  "/karakter",
  "/profile",
  "/search",
  "/manifest.json",
];

const API_BASE = "/api";

/* ---------- Install / Activate ---------- */

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS.map((url) => new Request(url, { credentials: "same-origin" })));
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

/* ---------- Fetch ---------- */

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") return;
  if (!url.protocol.startsWith("http")) return;

  // API routes: network-first, fallback to cache
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Static assets: cache-first, fallback to network
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          if (request.mode === "navigate") {
            return caches.match("/");
          }
        });
    })
  );
});

/* ---------- Background Sync ---------- */

self.addEventListener("sync", (event) => {
  if (event.tag === "sync-library") {
    event.waitUntil(syncLibrary());
  }
});

async function syncLibrary() {
  console.log("[SW] Background sync: sync-library started");

  // Get all clients to send messages
  const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });

  // Send start message
  clients.forEach((client) => {
    client.postMessage({ type: "sync:start" });
  });

  try {
    // In a real implementation, we would read from IndexedDB here
    // Since SW can't directly access client's IndexedDB, we use postMessage
    // The client will respond with queued actions
    clients.forEach((client) => {
      client.postMessage({ type: "sync:getActions" });
    });

    // Wait for responses (with timeout)
    await new Promise<void>((resolve) => {
      let resolved = false;
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve();
        }
      }, 10000);

      const messageHandler = async (messageEvent: ExtendableMessageEvent) => {
        if (messageEvent.data?.type === "sync:actions") {
          const actions = messageEvent.data.actions;
          if (actions && actions.length > 0) {
            await processActions(actions);
          }
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            self.removeEventListener("message", messageHandler);
            resolve();
          }
        }
      };

      self.addEventListener("message", messageHandler);
    });

    // Send completion message
    clients.forEach((client) => {
      client.postMessage({ type: "sync:complete" });
    });

    console.log("[SW] Background sync: completed");
  } catch (error) {
    console.error("[SW] Background sync failed:", error);
    clients.forEach((client) => {
      client.postMessage({ type: "sync:error", error: String(error) });
    });
  }
}

async function processActions(actions: any[]) {
  for (const action of actions) {
    try {
      await sendActionToAPI(action);
      // Notify client to remove from queue
      const clients = await self.clients.matchAll({ type: "window" });
      clients.forEach((client) => {
        client.postMessage({ type: "sync:removeAction", id: action.id });
      });
    } catch (error) {
      console.error(`[SW] Failed to process action ${action.id}:`, error);
      // Increment retry count via client
      const clients = await self.clients.matchAll({ type: "window" });
      clients.forEach((client) => {
        client.postMessage({ type: "sync:retryAction", id: action.id });
      });
    }
  }
}

async function sendActionToAPI(action: any): Promise<Response> {
  const baseUrl = self.location.origin;
  let url: string;
  let method: string;
  let body: any;

  switch (action.type) {
    case "library_add":
      url = `${API_BASE}/library`;
      method = "POST";
      body = action.payload;
      break;
    case "library_update":
      url = `${API_BASE}/library/${action.payload.entryId}`;
      method = "PATCH";
      body = action.payload.updates;
      break;
    case "library_delete":
      url = `${API_BASE}/library/${action.payload.entryId}`;
      method = "DELETE";
      body = null;
      break;
    case "rating":
      url = `${API_BASE}/library/rating`;
      method = "POST";
      body = action.payload;
      break;
    case "status":
      url = `${API_BASE}/library/status`;
      method = "POST";
      body = action.payload;
      break;
    default:
      throw new Error(`Unknown action type: ${action.type}`);
  }

  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      // Include credentials for session
    },
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return response;
}

/* ---------- Push Notifications ---------- */

self.addEventListener("push", (event) => {
  if (!event.data) return;
  const data = event.data.json();
  const options = {
    body: data.body,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-72.png",
    vibrate: [100, 50, 100],
    data: { url: data.url || "/" },
    actions: data.actions || [{ action: "open", title: "Aç" }],
  };
  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "open") {
    event.waitUntil(clients.openWindow(event.notification.data.url));
  } else {
    event.waitUntil(clients.openWindow("/"));
  }
});