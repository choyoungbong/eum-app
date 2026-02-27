import cache, { withCache } from "@/lib/cache";

describe("MemoryCache", () => {
  beforeEach(() => {
    // 캐시 클리어 (내부 map 초기화 대신 만료된 키 제거 방식)
    jest.useFakeTimers();
  });
  afterEach(() => jest.useRealTimers());

  it("값을 저장하고 조회할 수 있어야 한다", () => {
    cache.set("test:1", { name: "이음" }, 60);
    expect(cache.get("test:1")).toEqual({ name: "이음" });
  });

  it("TTL 만료 후 null을 반환해야 한다", () => {
    cache.set("test:ttl", "value", 1); // 1초
    jest.advanceTimersByTime(2000);    // 2초 경과
    expect(cache.get("test:ttl")).toBeNull();
  });

  it("태그로 관련 캐시를 일괄 무효화해야 한다", () => {
    cache.set("a", 1, 60, ["tag:x"]);
    cache.set("b", 2, 60, ["tag:x"]);
    cache.set("c", 3, 60, ["tag:y"]);
    cache.invalidateByTag("tag:x");
    expect(cache.get("a")).toBeNull();
    expect(cache.get("b")).toBeNull();
    expect(cache.get("c")).toBe(3);
  });

  it("패턴으로 캐시를 무효화해야 한다", () => {
    cache.set("user:1:files", [], 60);
    cache.set("user:1:posts", [], 60);
    cache.set("user:2:files", [], 60);
    cache.invalidateByPattern("user:1:");
    expect(cache.get("user:1:files")).toBeNull();
    expect(cache.get("user:1:posts")).toBeNull();
    expect(cache.get("user:2:files")).toEqual([]);
  });
});

describe("withCache", () => {
  it("fetcher를 처음에만 실행하고 이후에는 캐시를 반환해야 한다", async () => {
    const fetcher = jest.fn().mockResolvedValue({ data: 42 });
    const key = `test:withcache:${Date.now()}`;

    const first  = await withCache(key, fetcher, 60);
    const second = await withCache(key, fetcher, 60);

    expect(first).toEqual({ data: 42 });
    expect(second).toEqual({ data: 42 });
    expect(fetcher).toHaveBeenCalledTimes(1); // 한 번만 실행
  });
});
