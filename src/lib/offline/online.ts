/**
 * Online/offline detection utility
 */

export const isOnline = (): boolean => {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine;
};

export function onOnlineChange(callback: (online: boolean) => void): () => void {
  if (typeof window === "undefined") return () => {};

  const handler = () => callback(navigator.onLine);
  window.addEventListener("online", handler);
  window.addEventListener("offline", handler);
  return () => {
    window.removeEventListener("online", handler);
    window.removeEventListener("offline", handler);
  }
}