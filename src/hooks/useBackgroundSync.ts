"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { getPendingActions, removeAction, incrementRetry } from "@/lib/offline/queue";

type SyncState = "idle" | "syncing" | "error";
type PendingAction = {
  id: string;
  type: string;
  payload: any;
  timestamp: number;
  retries: number;
};

export function useBackgroundSync() {
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const swRef = useRef<ServiceWorkerRegistration | null>(null);
  const messageHandlerRef = useRef<((event: MessageEvent) => void) | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.ready.then((reg) => {
      swRef.current = reg;
    });

    // Listen for SW messages
    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data?.type) return;

      switch (data.type) {
        case "sync:start":
          setSyncState("syncing");
          setError(null);
          break;
        case "sync:complete":
          setSyncState("idle");
          setLastSync(Date.now());
          refreshPendingCount();
          break;
        case "sync:error":
          setSyncState("error");
          setError(data.error || "Sync failed");
          break;
        case "sync:removeAction":
          // Action was successfully synced, remove from local queue
          if (data.id) removeAction(data.id).then(refreshPendingCount);
          break;
        case "sync:retryAction":
          if (data.id) incrementRetry(data.id);
          break;
      }
    };

    navigator.serviceWorker.addEventListener("message", handleMessage);
    messageHandlerRef.current = handleMessage;

    // Initial count
    refreshPendingCount();

    return () => {
      if (messageHandlerRef.current) {
        navigator.serviceWorker.removeEventListener("message", messageHandlerRef.current);
      }
    };
  }, []);

  const refreshPendingCount = useCallback(async () => {
    const actions = await getPendingActions();
    setPendingCount(actions.length);
  }, []);

  const triggerSync = useCallback(async () => {
    if (!swRef.current) return;
    try {
      // @ts-expect-error - sync is not in TypeScript lib but exists in browsers
      await swRef.current.sync.register("sync-library");
    } catch (e) {
      console.error("Sync registration failed:", e);
      setError("Sync registration failed");
    }
  }, []);

  const clearQueue = useCallback(async () => {
    // This would need a backend endpoint to clear all
    // For now, just remove locally
    const actions = await getPendingActions();
    for (const action of actions) {
      await removeAction(action.id);
    }
    refreshPendingCount();
  }, []);

  return {
    syncState,
    pendingCount,
    lastSync,
    error,
    triggerSync,
    clearQueue,
    refreshPendingCount,
  };
}

// Hook for components that need to queue offline actions
export function useOfflineQueue() {
  const { triggerSync } = useBackgroundSync();

  const addLibraryEntry = useCallback(
    async (titleId: string, status: string, rating?: number) => {
      const { queueLibraryAdd } = await import("@/lib/offline/queue");
      await queueLibraryAdd(titleId, status, rating);
      triggerSync();
    },
    [triggerSync]
  );

  const updateLibraryEntry = useCallback(
    async (entryId: string, updates: Record<string, any>) => {
      const { queueLibraryUpdate } = await import("@/lib/offline/queue");
      await queueLibraryUpdate(entryId, updates);
      triggerSync();
    },
    [triggerSync]
  );

  const deleteLibraryEntry = useCallback(
    async (entryId: string) => {
      const { queueLibraryDelete } = await import("@/lib/offline/queue");
      await queueLibraryDelete(entryId);
      triggerSync();
    },
    [triggerSync]
  );

  const addRating = useCallback(
    async (titleId: string, rating: number) => {
      const { queueRating } = await import("@/lib/offline/queue");
      await queueRating(titleId, rating);
      triggerSync();
    },
    [triggerSync]
  );

  const changeStatus = useCallback(
    async (titleId: string, status: string) => {
      const { queueStatusChange } = await import("@/lib/offline/queue");
      await queueStatusChange(titleId, status);
      triggerSync();
    },
    [triggerSync]
  );

  return {
    addLibraryEntry,
    updateLibraryEntry,
    deleteLibraryEntry,
    addRating,
    changeStatus,
  };
}