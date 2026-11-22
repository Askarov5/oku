"use client";

import type { Book, BookPage, IngestionJob, Unit } from "@oku/db";
import { useCallback, useEffect, useSyncExternalStore } from "react";

export interface BookDetail {
  book: Book;
  pages: BookPage[];
  jobs: IngestionJob[];
  units: Unit[];
}

export interface BookDetailState {
  data: BookDetail | null;
  failed: boolean;
}

export interface UseBookDetailOptions {
  /** Keep the book fresh on an interval while this consumer is mounted. */
  poll?: boolean;
}

export interface UseBookDetailResult extends BookDetailState {
  refresh: () => Promise<void>;
}

interface Entry {
  state: BookDetailState;
  listeners: Set<() => void>;
  pollers: number;
  timer: number | null;
  fetchedAt: number;
  inflight: Promise<void> | null;
}

const POLL_MS = 4000;
const STALE_MS = 2000;
const EMPTY: BookDetailState = { data: null, failed: false };

/*
 * One entry per book, shared by every consumer on the page, so the rail and
 * the book screen read the same copy and only one request is ever in flight.
 */
const entries = new Map<string, Entry>();

const entryFor = (bookId: string): Entry => {
  const existing = entries.get(bookId);
  if (existing) {
    return existing;
  }
  const created: Entry = {
    state: EMPTY,
    listeners: new Set(),
    pollers: 0,
    timer: null,
    fetchedAt: 0,
    inflight: null,
  };
  entries.set(bookId, created);
  return created;
};

const fetchBook = (bookId: string): Promise<void> => {
  const entry = entryFor(bookId);
  if (entry.inflight) {
    return entry.inflight;
  }

  entry.inflight = (async (): Promise<void> => {
    try {
      const response = await fetch(`/api/admin/books/${bookId}`);
      entry.state = response.ok
        ? { data: (await response.json()) as BookDetail, failed: false }
        : { data: entry.state.data, failed: true };
    } catch {
      entry.state = { data: entry.state.data, failed: true };
    } finally {
      entry.fetchedAt = Date.now();
      entry.inflight = null;
      entry.listeners.forEach((listener) => listener());
    }
  })();

  return entry.inflight;
};

export const useBookDetail = (
  bookId: string | null,
  { poll = false }: UseBookDetailOptions = {},
): UseBookDetailResult => {
  const subscribe = useCallback(
    (listener: () => void): (() => void) => {
      if (!bookId) {
        return () => undefined;
      }
      const entry = entryFor(bookId);
      entry.listeners.add(listener);
      return () => {
        entry.listeners.delete(listener);
      };
    },
    [bookId],
  );

  const getSnapshot = useCallback(
    (): BookDetailState => (bookId ? entryFor(bookId).state : EMPTY),
    [bookId],
  );

  const state = useSyncExternalStore(
    subscribe,
    getSnapshot,
    (): BookDetailState => EMPTY,
  );

  useEffect(() => {
    if (!bookId) {
      return undefined;
    }
    const entry = entryFor(bookId);
    if (Date.now() - entry.fetchedAt > STALE_MS) {
      void fetchBook(bookId);
    }
    if (!poll) {
      return undefined;
    }

    entry.pollers += 1;
    if (entry.timer === null) {
      entry.timer = window.setInterval(() => {
        void fetchBook(bookId);
      }, POLL_MS);
    }
    return () => {
      entry.pollers -= 1;
      if (entry.pollers === 0 && entry.timer !== null) {
        window.clearInterval(entry.timer);
        entry.timer = null;
      }
    };
  }, [bookId, poll]);

  const refresh = useCallback(
    (): Promise<void> => (bookId ? fetchBook(bookId) : Promise.resolve()),
    [bookId],
  );

  return { ...state, refresh };
};
