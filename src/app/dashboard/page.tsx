"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Bell, FolderPlus, Upload, Search, LogOut, User,
  Folder, ChevronRight, Home, Grid3X3, List, X,
  Share2, Trash2, TrendingUp, MessageSquare, FileText,
  LayoutDashboard, Tag,
} from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { toast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmDialog";
import { getFileIcon, getFileColor, formatFileSize } from "@/lib/client-utils";
import FilePreviewModal from "@/components/FilePreviewModal";

// ── 알림 벨 ──────────────────────────────────────────
function NotificationBell() {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const fetch_ = () =>
      fetch("/api/notifications?unread=true")
        .then((r) => r.json())
        .then((d) => setUnread(d.unreadCount ?? 0))
        .catch(() => {});
    fetch_();
    const t = setInterval(fetch_, 30000);
    return () => clearInterval(t);
  }, []);

  return (
    <Link href="/notifications" className="relative p-2 rounded-xl hover:bg-white/5 transition-colors group" title="알림">
      <Bell size={18} className="text-zinc-400 group-hover:text-zinc-200 transition-colors" />
      {unread > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}

// ── 타입 ──────────────────────────────────────────────
interface Folder_ {
  id: string; name: string; userId: string;
  _count: { files: number };
}
interface Tag_ { id: string; name: string; color: string | null; }
interface FileItem {
  id: string; filename: string; originalName: string;
  size: string; mimeType: string; thumbnailUrl: string | null;
  createdAt: string; folderId: string | null; userId: string;
  fileTags?: { tag: Tag_ }[];
}
interface BreadcrumbItem { id: string | null; name: string; }

// ── 메인 ──────────────────────────────────────────────
export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const { confirmDialog, openConfirm } = useConfirm();

  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folders, setFolders] = useState<Folder_[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbItem[]>([{ id: null, name: "홈" }]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const [showFolderModal, setShowFolderModal] = useState(false);
  const [showFileDetail, setShowFileDetail] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<Folder_ | null>(null);
  const [shareType, setShareType] = useState<"FILE" | "FOLDER">("FILE");

  const [newFolderName, setNewFolderName] = useState("");
  const [shareEmail, setShareEmail] = useState("");
  const [sharePermission, setSharePermission] = useState<"VIEW" | "EDIT">("VIEW");
  const [newTagName, setNewTagName] = useState("");
  const [isSharing, setIsSharing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const folderUrl = currentFolderId ? `/api/folders?parentId=${currentFolderId}` : `/api/folders`;
      const fileUrl   = currentFolderId ? `/api/files?folderId=${currentFolderId}` : `/api/files?folderId=null`;
      const [fRes, fileRes] = await Promise.all([fetch(folderUrl), fetch(fileUrl)]);
      if (fRes.ok)    setFolders((await fRes.json()).folders   || []);
      if (fileRes.ok) setFiles((await fileRes.json()).files     || []);
    } catch {
      toast.error("데이터를 불러오는데 실패했습니다");
    } finally {
      setLoading(false);
    }
  }, [currentFolderId]);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (session) fetchData();
  }, [status, session, fetchData, router]);

  const displayedFiles = useMemo(
    () => files.filter((f) => f.originalName.toLowerCase().includes(searchQuery.toLowerCase())),
    [files, searchQuery]
  );

  const handleFolderClick = (f: Folder_) => {
    setCurrentFolderId(f.id);
    setBreadcrumb((prev) => [...prev, { id: f.id, name: f.name }]);
  };

  const handleBreadcrumbClick = (idx: number) => {
    const next = breadcrumb.slice(0, idx + 1);
    setBreadcrumb(next);
    setCurrentFolderId(next[next.length - 1].id);
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    const res = await fetch("/api/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newFolderName, parentId: currentFolderId }),
    });
    if (res.ok) {
      setNewFolderName(""); setShowFolderModal(false);
      fetchData(); toast.success("폴더가 생성되었습니다");
    } else toast.error("폴더 생성에 실패했습니다");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    if (currentFolderId) fd.append("folderId", currentFolderId);
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (ev) => setUploadProgress((ev.loaded / ev.total) * 100);
    xhr.onload = () => {
      fetchData(); setUploading(false); setUploadProgress(0);
      xhr.status >= 200 && xhr.status < 300 ? toast.success("파일이 업로드되었습니다") : toast.error("업로드에 실패했습니다");
    };
    xhr.onerror = () => { setUploading(false); toast.error("업로드 중 오류가 발생했습니다"); };
    xhr.open("POST", "/api/files/upload");
    xhr.send(fd);
    e.target.value = "";
  };

  const handleDeleteFolder = (id: string) =>
    openConfirm({
      title: "폴더 삭제", message: "폴더를 삭제하면 되돌릴 수 없습니다. 삭제하시겠습니까?",
      confirmLabel: "삭제", variant: "danger",
      onConfirm: async () => {
        const res = await fetch(`/api/folders/${id}`, { method: "DELETE" });
        res.ok ? (fetchData(), toast.success("폴더가 삭제되었습니다")) : toast.error("삭제 권한이 없거나 오류가 발생했습니다");
      },
    });

  const handleDeleteFile = (id: string) =>
    openConfirm({
      title: "파일 삭제", message: "파일을 삭제하면 되돌릴 수 없습니다. 삭제하시겠습니까?",
      confirmLabel: "삭제", variant: "danger",
      onConfirm: async () => {
        const res = await fetch(`/api/files/${id}`, { method: "DELETE" });
        if (res.ok) { setShowFileDetail(false); fetchData(); toast.success("파일이 삭제되었습니다"); }
        else toast.error("파일 삭제에 실패했습니다");
      },
    });

  const handleAddTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !newTagName.trim()) return;
    const res = await fetch(`/api/files/${selectedFile.id}/tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tagName: newTagName }),
    });
    if (res.ok) {
      const tagData = await res.json();
      setSelectedFile({ ...selectedFile, fileTags: [...(selectedFile.fileTags || []), { tag: tagData }] });
      setNewTagName(""); fetchData();
    } else toast.error("태그 추가에 실패했습니다");
  };

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    const resourceId = shareType === "FILE" ? selectedFile?.id : selectedFolder?.id;
    if (!resourceId) return;
    setIsSharing(true);
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resourceType: shareType, resourceId, sharedWithEmail: shareEmail, permission: sharePermission }),
      });
      if (res.ok) { toast.success("공유가 완료되었습니다"); setShowShareModal(false); setShareEmail(""); }
      else { const d = await res.json(); toast.error(d.error || "공유에 실패했습니다"); }
    } catch { toast.error("공유 중 오류가 발생했습니다"); }
    finally { setIsSharing(false); }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!session) return null;

  const NAV_ITEMS = [
    { href: "/dashboard", label: "파일",    icon: LayoutDashboard },
    { href: "/posts",     label: "게시판",   icon: FileText },
    { href: "/chat",      label: "채팅",     icon: MessageSquare },
    { href: "/invest",    label: "AI Invest", icon: TrendingUp },
    { href: "/search",    label: "검색",     icon: Search },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col pb-20 md:pb-0">
      {confirmDialog}

      {/* 배경 효과 */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-violet-600/6 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-40 w-80 h-80 bg-blue-600/4 rounded-full blur-3xl" />
      </div>

      {/* ── 헤더 ── */}
      <header className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-14 flex items-center justify-between gap-4">

          {/* 로고 + 네비 */}
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center">
                <span className="text-white text-xs font-black">이</span>
              </div>
              <span className="text-sm font-black tracking-tight hidden sm:block">이음</span>
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    pathname === href
                      ? "bg-white/8 text-zinc-100 border border-white/10"
                      : "text-zinc-500 hover:text-zinc-300 hover:bg-white/4"
                  }`}>
                  <Icon size={12} /> {label}
                </Link>
              ))}
            </nav>
          </div>

          {/* 우측 액션 */}
          <div className="flex items-center gap-1.5">
            <NotificationBell />
            <ThemeToggle />
            <Link href="/profile"
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/8 border border-white/6 transition-all">
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center">
                <User size={10} className="text-white" />
              </div>
              <span className="text-xs font-medium text-zinc-300 hidden sm:block">{session.user?.name}</span>
            </Link>
            <button onClick={() => signOut()}
              className="p-2 rounded-xl hover:bg-white/5 transition-colors text-zinc-500 hover:text-red-400">
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </header>

      {/* ── 모바일 하단바 ── */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-zinc-950/90 backdrop-blur-xl border-t border-white/5">
        <div className="flex items-center justify-around px-2 py-2">
          {NAV_ITEMS.slice(0, 2).map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all ${
                pathname === href ? "text-violet-400" : "text-zinc-600"
              }`}>
              <Icon size={18} />
              <span className="text-[9px] font-medium">{label}</span>
            </Link>
          ))}
          {/* 업로드 FAB */}
          <label className="w-12 h-12 bg-gradient-to-br from-violet-600 to-blue-600 text-white rounded-2xl flex items-center justify-center -mt-5 shadow-xl shadow-violet-500/25 cursor-pointer">
            <Upload size={18} />
            <input type="file" onChange={handleFileUpload} className="hidden" />
          </label>
          {NAV_ITEMS.slice(2, 4).map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all ${
                pathname === href ? "text-violet-400" : "text-zinc-600"
              }`}>
              <Icon size={18} />
              <span className="text-[9px] font-medium">{label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* ── 서브헤더: 브레드크럼 + 액션 ── */}
      <div className="bg-zinc-950/60 border-b border-white/4 sticky top-14 z-30 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-2.5 flex items-center justify-between gap-4">
          {/* 브레드크럼 */}
          <div className="flex items-center gap-1 text-xs overflow-x-auto scrollbar-none">
            {breadcrumb.map((c, i) => (
              <span key={i} className="flex items-center gap-1 shrink-0">
                {i > 0 && <ChevronRight size={12} className="text-zinc-700" />}
                <button onClick={() => handleBreadcrumbClick(i)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-all ${
                    i === breadcrumb.length - 1
                      ? "text-zinc-200 font-semibold"
                      : "text-zinc-600 hover:text-zinc-300 hover:bg-white/4"
                  }`}>
                  {i === 0 && <Home size={11} />}
                  {c.name}
                </button>
              </span>
            ))}
          </div>

          {/* 액션 버튼 그룹 */}
          <div className="flex items-center gap-2 shrink-0">
            {/* 뷰 모드 */}
            <div className="hidden sm:flex items-center bg-zinc-900 rounded-lg border border-white/6 p-0.5">
              <button onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded-md transition-all ${viewMode === "grid" ? "bg-white/10 text-zinc-200" : "text-zinc-600 hover:text-zinc-400"}`}>
                <Grid3X3 size={13} />
              </button>
              <button onClick={() => setViewMode("list")}
                className={`p-1.5 rounded-md transition-all ${viewMode === "list" ? "bg-white/10 text-zinc-200" : "text-zinc-600 hover:text-zinc-400"}`}>
                <List size={13} />
              </button>
            </div>
            <button onClick={() => setShowFolderModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/8 border border-white/6 text-xs font-medium text-zinc-300 transition-all">
              <FolderPlus size={13} /> <span className="hidden sm:inline">새 폴더</span>
            </button>
            <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-xs font-medium text-white cursor-pointer transition-all">
              <Upload size={13} /> <span className="hidden sm:inline">업로드</span>
              <input type="file" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
        </div>
      </div>

      <main className="max-w-7xl w-full mx-auto px-4 md:px-6 py-6 flex-1 relative">

        {/* 검색바 */}
        <div className="mb-6 relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
          <input
            type="text"
            placeholder="파일 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white/3 border border-white/6 focus:border-violet-500/50 rounded-xl outline-none text-sm text-zinc-100 placeholder:text-zinc-600 transition-all"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-300">
              <X size={14} />
            </button>
          )}
        </div>

        {/* 업로드 진행바 */}
        {uploading && (
          <div className="mb-6 p-4 bg-violet-500/10 border border-violet-500/20 rounded-2xl">
            <div className="flex justify-between text-xs font-medium text-violet-400 mb-2">
              <span>업로드 중...</span>
              <span>{uploadProgress.toFixed(0)}%</span>
            </div>
            <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
              <div className="bg-gradient-to-r from-violet-500 to-blue-500 h-full rounded-full transition-all duration-200" style={{ width: `${uploadProgress}%` }} />
            </div>
          </div>
        )}

        {/* ── 폴더 섹션 ── */}
        {!searchQuery && folders.length > 0 && (
          <section className="mb-8">
            <h2 className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-3 px-1">폴더</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {folders.map((f) => (
                <div key={f.id} className="group flex items-center gap-3 p-3.5 bg-white/3 hover:bg-white/5 border border-white/6 hover:border-white/10 rounded-2xl transition-all cursor-pointer">
                  <div onClick={() => handleFolderClick(f)} className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                      <Folder size={18} className="text-amber-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-200 truncate">{f.name}</p>
                      <p className="text-[10px] text-zinc-600 mt-0.5">{f._count.files}개 파일</p>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button onClick={() => { setSelectedFolder(f); setShareType("FOLDER"); setShowShareModal(true); }}
                      className="p-1.5 rounded-lg hover:bg-white/8 text-zinc-600 hover:text-zinc-300 transition-all" title="공유">
                      <Share2 size={13} />
                    </button>
                    {f.userId === session.user?.id && (
                      <button onClick={() => handleDeleteFolder(f.id)}
                        className="p-1.5 rounded-lg hover:bg-red-500/10 text-zinc-600 hover:text-red-400 transition-all" title="삭제">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── 파일 섹션 ── */}
        <section>
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">
              파일 {!loading && displayedFiles.length > 0 && <span className="text-zinc-700">({displayedFiles.length})</span>}
            </h2>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="aspect-square bg-white/4 rounded-2xl" />
                  <div className="h-2.5 bg-white/4 rounded mt-2 mx-1" />
                </div>
              ))}
            </div>
          ) : displayedFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-2xl bg-white/3 border border-white/6 flex items-center justify-center mb-4">
                <Folder size={28} className="text-zinc-700" />
              </div>
              <p className="text-zinc-500 font-medium text-sm">
                {searchQuery ? "검색 결과가 없습니다" : "파일이 없습니다"}
              </p>
              <p className="text-zinc-700 text-xs mt-1">
                {searchQuery ? "다른 검색어를 입력해보세요" : "파일을 업로드해보세요"}
              </p>
            </div>
          ) : viewMode === "grid" ? (
            /* 그리드 뷰 */
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
              {displayedFiles.map((file) => (
                <div key={file.id} className="group cursor-pointer"
                  onClick={() => { setSelectedFile(file); setShowFileDetail(true); }}>
                  <div className={`aspect-square rounded-2xl flex items-center justify-center overflow-hidden border border-white/4 group-hover:border-white/10 group-hover:scale-[1.02] transition-all relative ${
                    file.thumbnailUrl ? "bg-zinc-900" : "bg-white/3"
                  }`}>
                    {file.thumbnailUrl ? (
                      <img src={file.thumbnailUrl} className="w-full h-full object-cover" alt={file.originalName} />
                    ) : (
                      <span className="text-3xl select-none">{getFileIcon(file.mimeType)}</span>
                    )}
                    {file.userId !== session.user?.id && (
                      <span className="absolute top-1.5 right-1.5 bg-violet-600/80 text-white text-[8px] px-1.5 py-0.5 rounded-full backdrop-blur-sm">
                        공유
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-[10px] font-medium text-zinc-400 text-center truncate px-1 group-hover:text-zinc-200 transition-colors">
                    {file.originalName}
                  </p>
                  {file.fileTags && file.fileTags.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-0.5 mt-1">
                      {file.fileTags.slice(0, 2).map((ft) => (
                        <span key={ft.tag.id} className="text-[8px] bg-violet-500/10 text-violet-400 px-1.5 py-0.5 rounded-full">
                          {ft.tag.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            /* 리스트 뷰 */
            <div className="space-y-1">
              {displayedFiles.map((file) => (
                <div key={file.id} className="group flex items-center gap-3 px-4 py-3 bg-white/2 hover:bg-white/4 border border-white/4 hover:border-white/8 rounded-xl cursor-pointer transition-all"
                  onClick={() => { setSelectedFile(file); setShowFileDetail(true); }}>
                  <div className="w-8 h-8 rounded-lg bg-white/4 flex items-center justify-center shrink-0 overflow-hidden">
                    {file.thumbnailUrl
                      ? <img src={file.thumbnailUrl} className="w-full h-full object-cover" alt="" />
                      : <span className="text-base">{getFileIcon(file.mimeType)}</span>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-300 truncate group-hover:text-zinc-100 transition-colors">{file.originalName}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-zinc-600">{formatFileSize(parseInt(file.size))}</span>
                      <span className="text-zinc-700">·</span>
                      <span className="text-[10px] text-zinc-600">{new Date(file.createdAt).toLocaleDateString("ko-KR")}</span>
                      {file.fileTags?.map((ft) => (
                        <span key={ft.tag.id} className="text-[9px] bg-violet-500/10 text-violet-400 px-1.5 py-0.5 rounded-full">
                          {ft.tag.name}
                        </span>
                      ))}
                    </div>
                  </div>
                  {file.userId !== session.user?.id && (
                    <span className="shrink-0 text-[9px] bg-violet-500/10 text-violet-400 px-2 py-0.5 rounded-full">공유</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* ── 모달: 폴더 생성 ── */}
      {showFolderModal && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowFolderModal(false)}>
          <div className="bg-zinc-900 border border-white/8 rounded-2xl shadow-2xl w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <FolderPlus size={15} className="text-amber-400" />
              </div>
              <h3 className="font-semibold text-zinc-100">새 폴더 생성</h3>
            </div>
            <input
              type="text" value={newFolderName} autoFocus
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateFolder(e as any)}
              placeholder="폴더 이름 입력"
              className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 focus:border-violet-500 rounded-xl outline-none text-sm text-zinc-100 placeholder:text-zinc-600 mb-5 transition-colors"
            />
            <div className="flex gap-2">
              <button onClick={() => setShowFolderModal(false)}
                className="flex-1 py-2.5 text-sm text-zinc-500 hover:text-zinc-300 rounded-xl hover:bg-white/4 transition-all">
                취소
              </button>
              <button onClick={handleCreateFolder as any}
                className="flex-[2] py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-medium transition-colors">
                만들기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 모달: 파일 미리보기 ── */}
      <FilePreviewModal
        file={showFileDetail && selectedFile ? {
          id: selectedFile.id,
          originalName: selectedFile.originalName,
          mimeType: selectedFile.mimeType,
          size: selectedFile.size,
        } : null}
        onClose={() => setShowFileDetail(false)}
      />

      {/* ── 모달: 공유 ── */}
      {showShareModal && (
        <div className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowShareModal(false)}>
          <div className="bg-zinc-900 border border-white/8 rounded-2xl shadow-2xl w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-5">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Share2 size={15} className="text-blue-400" />
              </div>
              <h3 className="font-semibold text-zinc-100">항목 공유</h3>
            </div>
            <div className="space-y-3 mb-5">
              <input type="email" value={shareEmail} onChange={(e) => setShareEmail(e.target.value)}
                placeholder="상대방 이메일" required
                className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 focus:border-violet-500 rounded-xl outline-none text-sm text-zinc-100 placeholder:text-zinc-600 transition-colors" />
              <select value={sharePermission} onChange={(e) => setSharePermission(e.target.value as "VIEW" | "EDIT")}
                className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-sm text-zinc-300 outline-none">
                <option value="VIEW">읽기 가능</option>
                <option value="EDIT">편집 가능</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowShareModal(false)}
                className="flex-1 py-2.5 text-sm text-zinc-500 hover:text-zinc-300 rounded-xl hover:bg-white/4 transition-all">
                취소
              </button>
              <button onClick={handleShare as any} disabled={isSharing}
                className="flex-[2] py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors">
                {isSharing ? "공유 중..." : "보내기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
