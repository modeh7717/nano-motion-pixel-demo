"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { createCommerceStore } from "@/lib/commerce/store";
import type { CommerceStore } from "@/lib/commerce/store";
import type { StorageIssue } from "@/lib/browser-storage";

const CommerceContext = createContext<CommerceStore | null>(null);

export function CommerceProvider({ children }: { children: React.ReactNode }) {
  const [store] = useState(() => createCommerceStore());
  useEffect(() => {
    store.hydrate();
  }, [store]);
  return (
    <CommerceContext.Provider value={store}>
      {children}
    </CommerceContext.Provider>
  );
}

export function useCommerce() {
  const store = useContext(CommerceContext);
  if (!store) throw new Error("CommerceProvider is missing.");
  const state = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );
  return { state, actions: store };
}

export function StorageNotice({
  issue,
  subject,
}: {
  issue: StorageIssue;
  subject: string;
}) {
  if (!issue) return null;
  return (
    <p className="storage-notice" role="status">
      {issue === "unavailable"
        ? `Browser storage is unavailable. Your ${subject} will remain available for this visit, but may be lost when you refresh or close the page.`
        : `Saved ${subject} data could not be read. Start a new demo journey to replace it safely.`}
    </p>
  );
}

export function JourneyLoading({ label }: { label: string }) {
  return (
    <div className="container journey-loading" role="status">
      {label}
    </div>
  );
}
