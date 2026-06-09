/**
 * Sync Engine
 * ------------
 * Provides cross-tab and cross-component real-time synchronization.
 * Uses BroadcastChannel (with localStorage fallback) to broadcast
 * mutation events so all open tabs and components refresh data.
 */

import { QueryClient } from "@tanstack/react-query";

export type SyncEvent =
  | "properties:mutated"
  | "contacts:mutated"
  | "owners:mutated"
  | "renters:mutated"
  | "contracts:mutated"
  | "expenses:mutated"
  | "revenues:mutated"
  | "payments:mutated"
  | "tasks:mutated"
  | "documents:mutated"
  | "messages:mutated"
  | "units:mutated"
  | "dashboard:mutated"
  | "members:mutated"
  | "any:mutated";

type SyncPayload = {
  event: SyncEvent;
  timestamp: number;
  tabId: string;
  detail?: Record<string, unknown>;
};

const TAB_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
const CHANNEL_NAME = "aaqarplus-sync";

let bc: BroadcastChannel | null = null;
try {
  if (typeof BroadcastChannel !== "undefined") {
    bc = new BroadcastChannel(CHANNEL_NAME);
  }
} catch {
  // BroadcastChannel not available (e.g., Firefox private mode)
}

const listeners = new Set<(payload: SyncPayload) => void>();

function receive(payload: SyncPayload) {
  if (payload.tabId === TAB_ID) return; // ignore own messages
  listeners.forEach((fn) => fn(payload));
}

if (bc) {
  bc.onmessage = (e) => receive(e.data as SyncPayload);
} else {
  // Fallback to localStorage for cross-tab sync
  const onStorage = (e: StorageEvent) => {
    if (e.key !== CHANNEL_NAME) return;
    if (!e.newValue) return;
    try {
      const payload = JSON.parse(e.newValue) as SyncPayload;
      receive(payload);
    } catch {
      // ignore
    }
  };
  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
  }
}

export function broadcastSync(event: SyncEvent, detail?: Record<string, unknown>) {
  const payload: SyncPayload = { event, timestamp: Date.now(), tabId: TAB_ID, detail };

  // Notify other tabs
  if (bc) {
    bc.postMessage(payload);
  } else if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(CHANNEL_NAME, JSON.stringify(payload));
      // immediately remove to avoid storage bloat
      setTimeout(() => localStorage.removeItem(CHANNEL_NAME), 100);
    } catch {
      // ignore
    }
  }

  // Notify current tab listeners too
  listeners.forEach((fn) => fn(payload));
}

export function onSyncEvent(fn: (payload: SyncPayload) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function invalidateAll(qc: QueryClient, opts?: { refetchActive?: boolean }) {
  const keys: string[][] = [
    ["agency", "owners"],
    ["agency", "renters"],
    ["agency", "members"],
    ["contacts"],
    ["properties"],
    ["contracts"],
    ["expenses"],
    ["revenues"],
    ["tasks"],
    ["documents"],
    ["dashboard", "stats"],
    ["agency", "commissions"],
    ["messages"],
    ["unread"],
  ];
  keys.forEach((k) => qc.invalidateQueries({ queryKey: k, refetchType: opts?.refetchActive ? "active" : "all" }));
}

export function invalidateRelated(qc: QueryClient, event: SyncEvent) {
  switch (event) {
    case "properties:mutated":
    case "units:mutated":
      qc.invalidateQueries({ queryKey: ["properties"] });
      qc.invalidateQueries({ queryKey: ["dashboard", "stats"] });
      qc.invalidateQueries({ queryKey: ["agency", "commissions"] });
      break;
    case "contacts:mutated":
      qc.invalidateQueries({ queryKey: ["contacts"] });
      qc.invalidateQueries({ queryKey: ["agency", "renters"] });
      qc.invalidateQueries({ queryKey: ["dashboard", "stats"] });
      break;
    case "owners:mutated":
      qc.invalidateQueries({ queryKey: ["agency", "owners"] });
      qc.invalidateQueries({ queryKey: ["contacts"] });
      qc.invalidateQueries({ queryKey: ["dashboard", "stats"] });
      break;
    case "renters:mutated":
      qc.invalidateQueries({ queryKey: ["agency", "renters"] });
      qc.invalidateQueries({ queryKey: ["contacts"] });
      break;
    case "contracts:mutated":
      qc.invalidateQueries({ queryKey: ["contracts"] });
      qc.invalidateQueries({ queryKey: ["dashboard", "stats"] });
      break;
    case "expenses:mutated":
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["dashboard", "stats"] });
      break;
    case "revenues:mutated":
      qc.invalidateQueries({ queryKey: ["revenues"] });
      qc.invalidateQueries({ queryKey: ["dashboard", "stats"] });
      break;
    case "payments:mutated":
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["dashboard", "stats"] });
      break;
    case "tasks:mutated":
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["dashboard", "stats"] });
      break;
    case "documents:mutated":
      qc.invalidateQueries({ queryKey: ["documents"] });
      break;
    case "messages:mutated":
      qc.invalidateQueries({ queryKey: ["messages"] });
      qc.invalidateQueries({ queryKey: ["unread"] });
      break;
    case "members:mutated":
      qc.invalidateQueries({ queryKey: ["agency", "members"] });
      break;
    case "dashboard:mutated":
    case "any:mutated":
      invalidateAll(qc);
      break;
  }
}
