"use client";

import { useEffect } from "react";

export function SWRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log("SW registered:", registration.scope);
          // Check for updates periodically
          setInterval(() => registration.update(), 1000 * 60 * 60); // hourly
        })
        .catch((err) => console.log("SW registration failed:", err));
    }
  }, []);

  return null;
}