// src/hooks/useInfiniteScroll.ts
import { useState, useEffect, useRef, useCallback } from "react";

interface Options<T> {
  fetcher: (page: number) => Promise<{ items: T[]; hasMore: boolean }>;
  deps?: unknown[];
}

export function useInfiniteScroll<T>({ fetcher, deps = [] }: Options<T>) {
  const [items, setItems] = useState<T[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const fetchingRef = useRef(false);
  const pageRef = useRef(1);

  const reset = useCallback(() => {
    setItems([]); setPage(1); setHasMore(true); setInitialLoading(true); pageRef.current = 1;
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { reset(); }, deps);

  const loadMore = useCallback(async (targetPage: number) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    try {
      const result = await fetcher(targetPage);
      setItems((prev) => targetPage === 1 ? result.items : [...prev, ...result.items]);
      setHasMore(result.hasMore);
      pageRef.current = targetPage + 1;
      setPage(targetPage + 1);
    } catch {}
    finally { setLoading(false); setInitialLoading(false); fetchingRef.current = false; }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetcher]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadMore(1); }, deps);

  const setSentinel = useCallback((el: HTMLDivElement | null) => {
    if (observerRef.current) observerRef.current.disconnect();
    if (!el) return;
    observerRef.current = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && !fetchingRef.current) loadMore(pageRef.current); },
      { rootMargin: "200px" }
    );
    observerRef.current.observe(el);
  }, [loadMore]);

  return { items, loading, initialLoading, hasMore, setSentinel, reload: () => { reset(); loadMore(1); } };
}
