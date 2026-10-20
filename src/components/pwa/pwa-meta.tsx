"use client";

import { useEffect } from "react";

/**
 * PWA / iOS meta tag'larini ve splash screen'lari yönetir.
 * - theme-color: platforma göre degisir
 * - apple-mobile-web-app-capable: standalone modda apple touch icon
 * - iOS splash screen: apple-touch-startup-image
 */
export function PWAMeta() {
  useEffect(() => {
    // Apple touch icon (iOS standalone)
    if (!document.querySelector('link[rel="apple-touch-icon"]')) {
      const link = document.createElement("link");
      link.rel = "apple-touch-icon";
      link.href = "/icons/icon-192.png";
      document.head.appendChild(link);
    }

    // iOS splash screen'leri
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;

    if (standalone && !document.querySelector("link[rel='apple-touch-startup-image']")) {
      const splashes = [
        { width: 640, height: 1136, file: "splash-640x1136.png" },
        { width: 750, height: 1334, file: "splash-750x1334.png" },
        { width: 1242, height: 2688, file: "splash-1242x2688.png" },
        { width: 1920, height: 1080, file: "splash-1920x1080.png" },
      ];

      for (const splash of splashes) {
        const link = document.createElement("link");
        link.rel = "apple-touch-startup-image";
        link.href = `/icons/${splash.file}`;
        link.media = `(device-width: ${splash.width}px) and (device-height: ${splash.height}px) and (-webkit-device-pixel-ratio: 2)`;
        document.head.appendChild(link);
      }
    }

    // Install prompt (Android/Chrome)
    let deferredPrompt: any = null;
    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt = e;
      window.dispatchEvent(new CustomEvent("pwa-install-available"));
    };
    window.addEventListener("beforeinstallprompt", handler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  return null;
}
