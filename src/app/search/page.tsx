"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmDialog";

interface SearchResult { files: any[]; posts: any[]; total: number; }
interface SavedSearch { id: string; name: string; query: string; filters: string; createdAt: string; }
interface Tag { id: string; name: string; }

export default function SearchPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { confirmDialog, openConfirm } = useConfirm();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult>({ files: [], posts: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const [showFilters, setShowFilters] = useState(false);
  const [filterType, setFilterType] = useState<"ALL" | "FILE" | "POST">("ALL");
  const [filterMimeType, setFilterMimeType] = useState("");
  const [filterTagIds, setFilterTagIds] = useState<string[]>([]);
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveSearchName, setSaveSearchName] = useState("");
  const [showSavedList, setShowSavedList] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (session) { fetchTags(); fetchSavedSearches(); }
  }, [session]);

  const fetchTags = async () => {
    try {
      const res = await fetch("/api/tags");
      if (res.ok) setAllTags((await res.json()).tags || []);
    } catch {}
  };

  const fetchSavedSearches = async () => {
    try {
      const res = await fetch("/api/search/saved");
      if (res.ok) setSavedSearches((await res.json()).savedSearches || []);
    } catch {}
  };

  const activeFilterCount = [
    filterType !== "ALL",
    filterMimeType !== "",
    filterTagIds.length > 0,
    filterDateFrom !== "",
    filterDateTo !== "",
  ].filter(Boolean).length;

  const handleSearch = async (overrideQuery?: string) => {
    const searchQuery = overrideQuery ?? query;
    // ✅ alert() → toast.warning
    if (!searchQuery.trim() && filterTagIds.length === 0) {
      toast.warning("검색어 또는 태그를 선택하세요");
      return;
    }

    setLoading(true);
    setHasSearched(true);

    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set("q", searchQuery.trim());
      if (filterType !== "ALL") params.set("type", filterType);
      if (filterMimeType) params.set("mimeType", filterMimeType);
      if (filterTagIds.length > 0) params.set("tags", filterTagIds.join(","));
      if (filterDateFrom) params.set("dateFrom", filterDateFrom);
      if (filterDateTo) params.set("dateTo", filterDateTo);

      const res = await fetch(`/api/search?${params}`);
      if (res.ok) {
        setResults(await res.json());
      } else {
        toast.error("검색 중 오류가 발생했습니다");
      }
    } catch {
      toast.error("검색 중 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  };

  const handleResetFilters = () => {
    setFilterType("ALL");
    setFilterMimeType("");
    setFilterTagIds([]);
    setFilterDateFrom("");
    setFilterDateTo("");
  };

  const handleToggleTag = (tagId: string) =>
    setFilterTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );

  const handleSaveSearch = async () => {
    // ✅ alert() → toast.warning
    if (!saveSearchName.trim()) {
      toast.warning("검색 이름을 입력하세요");
      return;
    }
    try {
      const filters = JSON.stringify({
        type: filterType, mimeType: filterMimeType,
        tagIds: filterTagIds, dateFrom: filterDateFrom, dateTo: filterDateTo,
      });
      const res = await fetch("/api/search/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: saveSearchName.trim(), query, filters }),
      });
      if (res.ok) {
        toast.success("검색이 저장되었습니다");
        setShowSaveModal(false);
        setSaveSearchName("");
        fetchSavedSearches();
      } else {
        toast.error("저장에 실패했습니다");
      }
    } catch {
      toast.error("저장 중 오류가 발생했습니다");
    }
  };

  const handleLoadSavedSearch = (saved: SavedSearch) => {
    setQuery(saved.query || "");
    try {
      const filters = JSON.parse(saved.filters || "{}");
      setFilterType(filters.type || "ALL");
      setFilterMimeType(filters.mimeType || "");
      setFilterTagIds(filters.tagIds || []);
      setFilterDateFrom(filters.dateFrom || "");
      setFilterDateTo(filters.dateTo || "");
    } catch {}
    setShowSavedList(false);
    handleSearch(saved.query || "");
  };

  const handleDeleteSavedSearch = (id: string) => {
    // ✅ confirm() → ConfirmDialog
    openConfirm({
      title: "저장된 검색 삭제",
      message: "저장된 검색을 삭제하시겠습니까?",
      confirmLabel: "삭제",
      variant: "danger",
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/search/saved/${id}`, { method: "DELETE" });
          if (res.ok) {
            fetchSavedSearches();
            toast.success("삭제되었습니다");
          }
        } catch {}
      },
    });
  };

  if (status === "loading") {
    return <div className="min-h-screen flex items-center justify-center">로딩 중...</div>;
  }
  if (!session) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {confirmDialog}

      <header className="bg-white shadow">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold">🔍 검색</h1>
          <Link href="/dashboard" className="text-sm text-blue-600 hover:text-blue-700">
            ← 대시보드
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* 검색창 */}
        <div className="bg-white shadow rounded-lg p-5 mb-4">
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="파일명, 게시글 제목으로 검색..."
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-gray-900"
            />
            <button
              onClick={() => handleSearch()}
              disabled={loading}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 text-sm font-medium"
            >
              {loading ? "검색 중..." : "검색"}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm border transition ${
                showFilters
                  ? "bg-blue-50 border-blue-300 text-blue-700"
                  : "bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100"
              }`}
            >
              <span>⚙️ 필터</span>
              {activeFilterCount > 0 && (
                <span className="bg-blue-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {activeFilterCount > 0 && (
              <button
                onClick={handleResetFilters}
                className="px-3 py-1.5 text-xs text-red-500 hover:text-red-700 border border-red-200 rounded-md hover:bg-red-50"
              >
                필터 초기화
              </button>
            )}

            <div className="ml-auto flex gap-2">
              {hasSearched && (
                <button
                  onClick={() => setShowSaveModal(true)}
                  className="px-3 py-1.5 text-xs text-green-600 border border-green-300 rounded-md hover:bg-green-50"
                >
                  💾 검색 저장
                </button>
              )}
              {savedSearches.length > 0 && (
                <button
                  onClick={() => setShowSavedList(!showSavedList)}
                  className="px-3 py-1.5 text-xs text-purple-600 border border-purple-300 rounded-md hover:bg-purple-50"
                >
                  📋 저장된 검색 ({savedSearches.length})
                </button>
              )}
            </div>
          </div>

          {/* 필터 패널 */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t space-y-4">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">검색 대상</p>
                <div className="flex gap-2">
                  {(["ALL", "FILE", "POST"] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setFilterType(type)}
                      className={`px-3 py-1.5 text-sm rounded-full border transition ${
                        filterType === type
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      {type === "ALL" ? "전체" : type === "FILE" ? "📄 파일만" : "📝 게시글만"}
                    </button>
                  ))}
                </div>
              </div>

              {(filterType === "ALL" || filterType === "FILE") && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">파일 타입</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: "전체", value: "" },
                      { label: "🖼️ 이미지", value: "image" },
                      { label: "📹 동영상", value: "video" },
                      { label: "📄 PDF", value: "pdf" },
                      { label: "📊 문서", value: "document" },
                      { label: "🗜️ 압축", value: "zip" },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setFilterMimeType(opt.value)}
                        className={`px-3 py-1.5 text-sm rounded-full border transition ${
                          filterMimeType === opt.value
                            ? "bg-green-600 text-white border-green-600"
                            : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {allTags.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">
                    태그 필터
                    {filterTagIds.length > 0 && (
                      <span className="ml-2 text-blue-600 normal-case font-normal">
                        {filterTagIds.length}개 선택됨
                      </span>
                    )}
                  </p>
                  <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
                    {allTags.map((tag) => (
                      <button
                        key={tag.id}
                        onClick={() => handleToggleTag(tag.id)}
                        className={`px-3 py-1 text-sm rounded-full border transition ${
                          filterTagIds.includes(tag.id)
                            ? "bg-orange-500 text-white border-orange-500"
                            : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        🏷️ {tag.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">업로드 날짜</p>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={filterDateFrom}
                    onChange={(e) => setFilterDateFrom(e.target.value)}
                    className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
                  />
                  <span className="text-gray-400 text-sm">~</span>
                  <input
                    type="date"
                    value={filterDateTo}
                    onChange={(e) => setFilterDateTo(e.target.value)}
                    className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
                  />
                  {(filterDateFrom || filterDateTo) && (
                    <button
                      onClick={() => { setFilterDateFrom(""); setFilterDateTo(""); }}
                      className="text-xs text-red-400 hover:text-red-600"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              <button
                onClick={() => handleSearch()}
                className="w-full py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
              >
                🔍 필터 적용해서 검색
              </button>
            </div>
          )}

          {/* 저장된 검색 목록 */}
          {showSavedList && savedSearches.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">저장된 검색</p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {savedSearches.map((saved) => (
                  <div key={saved.id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-md">
                    <button onClick={() => handleLoadSavedSearch(saved)} className="flex-1 text-left">
                      <p className="text-sm font-medium text-blue-600 hover:text-blue-800">{saved.name}</p>
                      {saved.query && <p className="text-xs text-gray-400">"{saved.query}"</p>}
                    </button>
                    <button
                      onClick={() => handleDeleteSavedSearch(saved.id)}
                      className="ml-2 text-xs text-red-400 hover:text-red-600"
                    >
                      삭제
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 검색 결과 */}
        {hasSearched && !loading && (
          <div className="bg-white shadow rounded-lg p-5">
            {results.total === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 text-lg mb-2">검색 결과가 없습니다</p>
                <p className="text-gray-400 text-sm">다른 검색어나 필터를 사용해보세요</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold">
                    검색 결과 <span className="text-blue-600">({results.total}개)</span>
                  </h2>
                  <div className="flex gap-2 text-xs text-gray-500">
                    {results.files.length > 0 && <span>📄 파일 {results.files.length}개</span>}
                    {results.posts.length > 0 && <span>📝 게시글 {results.posts.length}개</span>}
                  </div>
                </div>

                {results.files.length > 0 && (
                  <div className="mb-5">
                    <h3 className="text-sm font-semibold text-gray-600 mb-2">📄 파일 ({results.files.length})</h3>
                    <div className="space-y-2">
                      {results.files.map((file: any) => (
                        <div
                          key={file.id}
                          className="flex items-center gap-3 p-3 border rounded-md hover:bg-gray-50 cursor-pointer"
                          onClick={() => router.push("/dashboard")}
                        >
                          <div className="w-10 h-10 rounded bg-gray-100 flex-shrink-0 overflow-hidden">
                            {file.thumbnailUrl ? (
                              <img src={file.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-lg">
                                {file.mimeType?.startsWith("image/") ? "🖼️" :
                                 file.mimeType?.startsWith("video/") ? "🎥" :
                                 file.mimeType === "application/pdf" ? "📕" : "📄"}
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{file.originalName}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-gray-400">
                                {(parseInt(file.size) / 1024 / 1024).toFixed(2)} MB
                              </span>
                              <span className="text-xs text-gray-300">•</span>
                              <span className="text-xs text-gray-400">
                                {new Date(file.createdAt).toLocaleDateString("ko-KR")}
                              </span>
                              {file.fileTags?.map((ft: any) => (
                                <span key={ft.tag.id} className="px-1.5 py-0.5 text-xs bg-blue-100 text-blue-600 rounded-full">
                                  {ft.tag.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {results.posts.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-600 mb-2">📝 게시글 ({results.posts.length})</h3>
                    <div className="space-y-2">
                      {results.posts.map((post: any) => (
                        <Link key={post.id} href={`/posts/${post.id}`} className="block p-3 border rounded-md hover:bg-gray-50">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm">{post.title}</p>
                              <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{post.content}</p>
                            </div>
                            <span className={`ml-2 px-2 py-0.5 text-xs rounded-full flex-shrink-0 ${
                              post.visibility === "PUBLIC" ? "bg-green-100 text-green-700" :
                              post.visibility === "SHARED" ? "bg-blue-100 text-blue-700" :
                              "bg-gray-100 text-gray-600"
                            }`}>
                              {post.visibility === "PUBLIC" ? "공개" :
                               post.visibility === "SHARED" ? "공유" : "비공개"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-gray-400">
                              {new Date(post.createdAt).toLocaleDateString("ko-KR")}
                            </span>
                            {post.postTags?.map((pt: any) => (
                              <span key={pt.tag.id} className="px-1.5 py-0.5 text-xs bg-orange-100 text-orange-600 rounded-full">
                                {pt.tag.name}
                              </span>
                            ))}
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>

      {/* 검색 저장 모달 */}
      {showSaveModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
          onClick={() => setShowSaveModal(false)}
        >
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold mb-3">💾 검색 저장</h3>
            <input
              type="text"
              value={saveSearchName}
              onChange={(e) => setSaveSearchName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSaveSearch()}
              placeholder="저장할 검색 이름 (예: 태국여행 이미지)"
              className="w-full px-3 py-2 border rounded-md text-sm mb-3 text-gray-900"
              autoFocus
            />
            <div className="text-xs text-gray-500 mb-4 space-y-0.5">
              {query && <p>검색어: "{query}"</p>}
              {filterType !== "ALL" && <p>대상: {filterType}</p>}
              {filterMimeType && <p>타입: {filterMimeType}</p>}
              {filterTagIds.length > 0 && <p>태그: {filterTagIds.length}개</p>}
              {(filterDateFrom || filterDateTo) && <p>날짜: {filterDateFrom} ~ {filterDateTo}</p>}
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowSaveModal(false)}
                className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-md"
              >
                취소
              </button>
              <button
                onClick={handleSaveSearch}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
