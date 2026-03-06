"use client";
// src/app/search/page.tsx — EUM 브랜딩 고도화 + 모바일 버튼 overflow 수정

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmDialog";
import {
  Search, SlidersHorizontal, X, Save, BookMarked,
  FileText, Image, Film, FileArchive, Trash2, ChevronLeft,
  Tag as TagIcon, Calendar, LayoutGrid, AlignLeft,
} from "lucide-react";

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
    filterType !== "ALL", filterMimeType !== "",
    filterTagIds.length > 0, filterDateFrom !== "", filterDateTo !== "",
  ].filter(Boolean).length;

  const handleSearch = async (overrideQuery?: string) => {
    const q = overrideQuery ?? query;
    if (!q.trim() && filterTagIds.length === 0) {
      toast.warning("검색어 또는 태그를 선택하세요");
      return;
    }
    setLoading(true);
    setHasSearched(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (filterType !== "ALL") params.set("type", filterType);
      if (filterMimeType) params.set("mimeType", filterMimeType);
      if (filterTagIds.length > 0) params.set("tags", filterTagIds.join(","));
      if (filterDateFrom) params.set("dateFrom", filterDateFrom);
      if (filterDateTo) params.set("dateTo", filterDateTo);
      const res = await fetch(`/api/search?${params}`);
      if (res.ok) setResults(await res.json());
      else toast.error("검색 중 오류가 발생했습니다");
    } catch { toast.error("검색 중 오류가 발생했습니다"); }
    finally { setLoading(false); }
  };

  const handleResetFilters = () => {
    setFilterType("ALL"); setFilterMimeType(""); setFilterTagIds([]); setFilterDateFrom(""); setFilterDateTo("");
  };

  const handleToggleTag = (tagId: string) =>
    setFilterTagIds((prev) => prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]);

  const handleSaveSearch = async () => {
    if (!saveSearchName.trim()) { toast.warning("검색 이름을 입력하세요"); return; }
    try {
      const filters = JSON.stringify({ type: filterType, mimeType: filterMimeType, tagIds: filterTagIds, dateFrom: filterDateFrom, dateTo: filterDateTo });
      const res = await fetch("/api/search/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: saveSearchName.trim(), query, filters }),
      });
      if (res.ok) { toast.success("검색이 저장되었습니다"); setShowSaveModal(false); setSaveSearchName(""); fetchSavedSearches(); }
      else toast.error("저장에 실패했습니다");
    } catch { toast.error("저장 중 오류가 발생했습니다"); }
  };

  const handleLoadSavedSearch = (saved: SavedSearch) => {
    setQuery(saved.query || "");
    try {
      const f = JSON.parse(saved.filters || "{}");
      setFilterType(f.type || "ALL"); setFilterMimeType(f.mimeType || "");
      setFilterTagIds(f.tagIds || []); setFilterDateFrom(f.dateFrom || ""); setFilterDateTo(f.dateTo || "");
    } catch {}
    setShowSavedList(false);
    handleSearch(saved.query || "");
  };

  const handleDeleteSavedSearch = (id: string) => {
    openConfirm({
      title: "저장된 검색 삭제", message: "저장된 검색을 삭제하시겠습니까?",
      confirmLabel: "삭제", variant: "danger",
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/search/saved/${id}`, { method: "DELETE" });
          if (res.ok) { fetchSavedSearches(); toast.success("삭제되었습니다"); }
        } catch {}
      },
    });
  };

  if (status === "loading") {
    return <div className="min-h-screen flex items-center justify-center bg-zinc-950"><div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>;
  }
  if (!session) return null;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {confirmDialog}

      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-1/3 w-80 h-80 bg-violet-600/5 rounded-full blur-3xl" />
      </div>

      {/* 헤더 */}
      <header className="sticky top-0 z-20 bg-zinc-950/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/dashboard" className="p-1.5 rounded-lg hover:bg-white/5 transition-colors text-zinc-400 hover:text-zinc-200">
            <ChevronLeft size={20} />
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center">
              <Search size={13} className="text-white" />
            </div>
            <h1 className="text-lg font-bold tracking-tight">검색</h1>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 relative">

        {/* 검색 카드 */}
        <div className="bg-white/3 border border-white/6 rounded-2xl p-4 mb-4">

          {/* ✅ 모바일 overflow 수정: flex-1 min-w-0 on wrapper + shrink-0 on button */}
          <div className="flex gap-2 mb-3">
            <div className="flex-1 min-w-0 relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="파일명, 게시글 제목으로 검색..."
                className="w-full pl-9 pr-4 py-2.5 bg-zinc-900 border border-zinc-700 focus:border-violet-500 rounded-xl outline-none text-sm text-zinc-100 placeholder:text-zinc-600 transition-colors"
              />
            </div>
            <button
              onClick={() => handleSearch()}
              disabled={loading}
              className="shrink-0 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-700 text-white rounded-xl text-sm font-medium transition-colors"
            >
              {loading
                ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin block" />
                : "검색"}
            </button>
          </div>

          {/* 필터 / 저장 버튼 행 */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-all ${
                showFilters || activeFilterCount > 0
                  ? "bg-violet-500/10 border-violet-500/30 text-violet-400"
                  : "bg-zinc-800/60 border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300"
              }`}
            >
              <SlidersHorizontal size={12} />
              필터
              {activeFilterCount > 0 && (
                <span className="bg-violet-600 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
                  {activeFilterCount}
                </span>
              )}
            </button>
            {activeFilterCount > 0 && (
              <button onClick={handleResetFilters} className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/8 transition-colors">
                <X size={11} /> 초기화
              </button>
            )}
            <div className="ml-auto flex items-center gap-2">
              {hasSearched && (
                <button onClick={() => setShowSaveModal(true)} className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-emerald-400 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/8 transition-colors">
                  <Save size={11} /> 저장
                </button>
              )}
              {savedSearches.length > 0 && (
                <button onClick={() => setShowSavedList(!showSavedList)} className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-blue-400 border border-blue-500/20 rounded-lg hover:bg-blue-500/8 transition-colors">
                  <BookMarked size={11} /> 저장됨 ({savedSearches.length})
                </button>
              )}
            </div>
          </div>

          {/* 필터 패널 */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-white/6 space-y-4">
              <div>
                <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">검색 대상</p>
                <div className="flex gap-2">
                  {(["ALL", "FILE", "POST"] as const).map((type) => (
                    <button key={type} onClick={() => setFilterType(type)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-all ${
                        filterType === type ? "bg-violet-600 text-white border-violet-600" : "bg-zinc-800/60 text-zinc-400 border-zinc-700 hover:border-zinc-500"
                      }`}>
                      {type === "ALL" ? <LayoutGrid size={11} /> : type === "FILE" ? <FileText size={11} /> : <AlignLeft size={11} />}
                      {type === "ALL" ? "전체" : type === "FILE" ? "파일" : "게시글"}
                    </button>
                  ))}
                </div>
              </div>

              {(filterType === "ALL" || filterType === "FILE") && (
                <div>
                  <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">파일 타입</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: "전체", value: "", icon: LayoutGrid },
                      { label: "이미지", value: "image", icon: Image },
                      { label: "동영상", value: "video", icon: Film },
                      { label: "PDF", value: "pdf", icon: FileText },
                      { label: "문서", value: "document", icon: AlignLeft },
                      { label: "압축", value: "zip", icon: FileArchive },
                    ].map(({ label, value, icon: Icon }) => (
                      <button key={value} onClick={() => setFilterMimeType(value)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-all ${
                          filterMimeType === value ? "bg-emerald-600 text-white border-emerald-600" : "bg-zinc-800/60 text-zinc-400 border-zinc-700 hover:border-zinc-500"
                        }`}>
                        <Icon size={11} />{label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {allTags.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                    태그 {filterTagIds.length > 0 && <span className="text-violet-400 normal-case font-normal">{filterTagIds.length}개 선택</span>}
                  </p>
                  <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
                    {allTags.map((tag) => (
                      <button key={tag.id} onClick={() => handleToggleTag(tag.id)}
                        className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-full border transition-all ${
                          filterTagIds.includes(tag.id) ? "bg-orange-500/20 text-orange-400 border-orange-500/30" : "bg-zinc-800/60 text-zinc-500 border-zinc-700 hover:border-zinc-500"
                        }`}>
                        <TagIcon size={10} />{tag.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Calendar size={11} /> 업로드 날짜
                </p>
                {/* ✅ 날짜 input도 min-w-0 처리 */}
                <div className="flex items-center gap-2">
                  <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)}
                    className="flex-1 min-w-0 px-3 py-1.5 bg-zinc-900 border border-zinc-700 focus:border-violet-500 rounded-lg text-xs text-zinc-300 outline-none transition-colors" />
                  <span className="text-zinc-600 text-xs shrink-0">~</span>
                  <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)}
                    className="flex-1 min-w-0 px-3 py-1.5 bg-zinc-900 border border-zinc-700 focus:border-violet-500 rounded-lg text-xs text-zinc-300 outline-none transition-colors" />
                  {(filterDateFrom || filterDateTo) && (
                    <button onClick={() => { setFilterDateFrom(""); setFilterDateTo(""); }} className="shrink-0 text-zinc-500 hover:text-red-400 transition-colors">
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              <button onClick={() => handleSearch()}
                className="w-full py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2">
                <Search size={14} /> 필터 적용해서 검색
              </button>
            </div>
          )}

          {/* 저장된 검색 목록 */}
          {showSavedList && savedSearches.length > 0 && (
            <div className="mt-4 pt-4 border-t border-white/6">
              <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-3">저장된 검색</p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {savedSearches.map((saved) => (
                  <div key={saved.id} className="flex items-center gap-2 p-2.5 bg-zinc-900/60 rounded-xl border border-white/4">
                    <button onClick={() => handleLoadSavedSearch(saved)} className="flex-1 text-left min-w-0">
                      <p className="text-sm font-medium text-violet-400 hover:text-violet-300 transition-colors truncate">{saved.name}</p>
                      {saved.query && <p className="text-xs text-zinc-600 truncate">"{saved.query}"</p>}
                    </button>
                    <button onClick={() => handleDeleteSavedSearch(saved.id)} className="shrink-0 p-1 text-zinc-600 hover:text-red-400 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 검색 결과 */}
        {hasSearched && !loading && (
          <div className="bg-white/3 border border-white/6 rounded-2xl p-5">
            {results.total === 0 ? (
              <div className="text-center py-10">
                <Search size={32} className="text-zinc-700 mx-auto mb-3" />
                <p className="text-zinc-400 mb-1">검색 결과가 없습니다</p>
                <p className="text-zinc-600 text-sm">다른 검색어나 필터를 사용해보세요</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-sm font-semibold text-zinc-300">
                    검색 결과 <span className="text-violet-400 ml-1">{results.total}개</span>
                  </h2>
                  <div className="flex gap-3 text-xs text-zinc-600">
                    {results.files.length > 0 && <span className="flex items-center gap-1"><FileText size={11} />{results.files.length}</span>}
                    {results.posts.length > 0 && <span className="flex items-center gap-1"><AlignLeft size={11} />{results.posts.length}</span>}
                  </div>
                </div>

                {results.files.length > 0 && (
                  <div className="mb-5">
                    <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <FileText size={11} /> 파일 ({results.files.length})
                    </p>
                    <div className="space-y-2">
                      {results.files.map((file: any) => (
                        <div key={file.id} onClick={() => router.push("/dashboard")}
                          className="flex items-center gap-3 p-3 bg-zinc-900/60 hover:bg-zinc-900 border border-white/4 hover:border-white/8 rounded-xl cursor-pointer transition-all">
                          <div className="w-10 h-10 rounded-lg bg-zinc-800 flex-shrink-0 overflow-hidden">
                            {file.thumbnailUrl ? (
                              <img src={file.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                {file.mimeType?.startsWith("image/") ? <Image size={18} className="text-zinc-500" /> :
                                 file.mimeType?.startsWith("video/") ? <Film size={18} className="text-zinc-500" /> :
                                 <FileText size={18} className="text-zinc-500" />}
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-zinc-200 truncate">{file.originalName}</p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className="text-xs text-zinc-600">{(parseInt(file.size) / 1024 / 1024).toFixed(2)} MB</span>
                              <span className="text-zinc-700">·</span>
                              <span className="text-xs text-zinc-600">{new Date(file.createdAt).toLocaleDateString("ko-KR")}</span>
                              {file.fileTags?.map((ft: any) => (
                                <span key={ft.tag.id} className="px-1.5 py-0.5 text-[10px] bg-violet-500/10 text-violet-400 rounded-full">{ft.tag.name}</span>
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
                    <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <AlignLeft size={11} /> 게시글 ({results.posts.length})
                    </p>
                    <div className="space-y-2">
                      {results.posts.map((post: any) => (
                        <Link key={post.id} href={`/posts/${post.id}`}
                          className="block p-3 bg-zinc-900/60 hover:bg-zinc-900 border border-white/4 hover:border-white/8 rounded-xl transition-all">
                          <div className="flex items-start gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm text-zinc-200 truncate">{post.title}</p>
                              <p className="text-xs text-zinc-600 mt-0.5 line-clamp-1">{post.content}</p>
                            </div>
                            <span className={`shrink-0 px-2 py-0.5 text-[10px] rounded-full font-medium ${
                              post.visibility === "PUBLIC" ? "bg-emerald-500/10 text-emerald-400" :
                              post.visibility === "SHARED" ? "bg-blue-500/10 text-blue-400" :
                              "bg-zinc-700/60 text-zinc-500"
                            }`}>
                              {post.visibility === "PUBLIC" ? "공개" : post.visibility === "SHARED" ? "공유" : "비공개"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <span className="text-xs text-zinc-600">{new Date(post.createdAt).toLocaleDateString("ko-KR")}</span>
                            {post.postTags?.map((pt: any) => (
                              <span key={pt.tag.id} className="px-1.5 py-0.5 text-[10px] bg-orange-500/10 text-orange-400 rounded-full">{pt.tag.name}</span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowSaveModal(false)}>
          <div className="bg-zinc-900 border border-white/8 rounded-2xl shadow-2xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-zinc-100 mb-4 flex items-center gap-2">
              <Save size={16} className="text-violet-400" /> 검색 저장
            </h3>
            <input
              type="text" value={saveSearchName} onChange={(e) => setSaveSearchName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSaveSearch()}
              placeholder="저장할 검색 이름"
              className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 focus:border-violet-500 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-600 outline-none mb-4 transition-colors"
              autoFocus
            />
            <div className="text-xs text-zinc-600 mb-5 space-y-1 bg-zinc-800/50 rounded-xl p-3">
              {query && <p>검색어: <span className="text-zinc-400">"{query}"</span></p>}
              {filterType !== "ALL" && <p>대상: <span className="text-zinc-400">{filterType}</span></p>}
              {filterMimeType && <p>타입: <span className="text-zinc-400">{filterMimeType}</span></p>}
              {filterTagIds.length > 0 && <p>태그: <span className="text-zinc-400">{filterTagIds.length}개</span></p>}
              {(filterDateFrom || filterDateTo) && <p>날짜: <span className="text-zinc-400">{filterDateFrom} ~ {filterDateTo}</span></p>}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowSaveModal(false)} className="px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-800 rounded-xl transition-colors">취소</button>
              <button onClick={handleSaveSearch} className="px-4 py-2 text-sm bg-violet-600 hover:bg-violet-500 text-white rounded-xl transition-colors font-medium">저장</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
