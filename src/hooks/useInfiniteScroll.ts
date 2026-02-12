import { useEffect, useRef, useState } from "react";

interface UseInfiniteScrollProps {
  fetchMore: () => Promise<void>;
  hasMore: boolean;
  loading: boolean;
}

export function useInfiniteScroll({ fetchMore, hasMore, loading }: UseInfiniteScrollProps) {
  const observerRef = useRef<HTMLDivElement>(null);
  const [isFetching, setIsFetching] = useState(false);

  useEffect(() => {
    if (!observerRef.current || loading || !hasMore) return;

    const observer = new IntersectionObserver(
      async ([entry]) => {
        if (entry.isIntersecting && !isFetching) {
          setIsFetching(true);
          await fetchMore();
          setIsFetching(false);
        }
      },
      { rootMargin: "100px" }
    );

    observer.observe(observerRef.current);

    return () => observer.disconnect();
  }, [fetchMore, hasMore, loading, isFetching]);

  return observerRef;
}