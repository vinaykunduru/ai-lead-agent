"use client";

import { useSyncExternalStore } from "react";

/**
 * Tiny localStorage-backed boolean, read via useSyncExternalStore so it's
 * SSR-safe (server + first client render both see `false`, the real value
 * only applies after hydration — no setState-in-effect, no hydration
 * mismatch). Used for onboarding UI state that must never touch the
 * database (no onboarding table/flag exists, and none should be added).
 */
function eventName(key: string) {
  return `bloom:client-flag:${key}`;
}

export function useClientFlag(key: string): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      const event = eventName(key);
      window.addEventListener(event, onStoreChange);
      return () => window.removeEventListener(event, onStoreChange);
    },
    () => window.localStorage.getItem(key) === "true",
    () => false,
  );
}

export function setClientFlag(key: string, value: boolean) {
  if (value) {
    window.localStorage.setItem(key, "true");
  } else {
    window.localStorage.removeItem(key);
  }
  window.dispatchEvent(new Event(eventName(key)));
}
