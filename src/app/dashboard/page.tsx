"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { toast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmDialog";

interface Folder {
  id: string;
  name: string;
  userId: string;
  _count: { files: number };
}

interface Tag { id: string; name: string; color: string | null; }

interface FileItem {
  id: string;
  filename: string;
  originalName: string;
  size: string;
  mimeType: string;
  thumbnailUrl: string | null;
  createdAt: string;
  folderId: string | null;
  userId: string;
  fileTags?: { tag: Tag }[];
}

interface BreadcrumbItem { id: string | null; name: string; }

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  // ✅ confirm() 대체
  const { confirmDialog, openConfirm } = useConfirm();

  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbItem[]>([{ id: null, name: "홈" }]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [showFolderModal, setShowFolderModal] = useState(false);
  const [showFileDetail, setShowFileDetail] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null);
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
      const fileUrl = currentFolderId ? `/api/files?folderId=${currentFolderId}` : `/api/files?folderId=null`;
      const [fRes, fileRes] = await Promise.all([fetch(folderUrl), fetch(fileUrl)]);
      if (fRes.ok) setFolders((await fRes.json()).folders || []);
      if (fileRes.ok) setFiles((await fileRes.json()).files || []);
    } catch (err) {
      console.error(err);
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

  const handleFolderClick = (f: Folder) => {
    setCurrentFolderId(f.id);
    setBreadcrumb([...breadcrumb, { id: f.id, name: f.name }]);
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
      setNewFolderName("");
      setShowFolderModal(false);
      fetchData();
      // ✅ alert() → toast
      toast.success("폴더가 생성되었습니다");
    } else {
      toast.error("폴더 생성에 실패했습니다");
    }
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
      fetchData();
      setUploading(false);
      setUploadProgress(0);
      if (xhr.status >= 200 && xhr.status < 300) {
        toast.success("파일이 업로드되었습니다");
      } else {
        toast.error("업로드에 실패했습니다");
      }
    };
    xhr.onerror = () => {
      setUploading(false);
      toast.error("업로드 중 오류가 발생했습니다");
    };
    xhr.open("POST", "/api/files/upload");
    xhr.send(fd);
    // input 초기화 (같은 파일 재업로드 가능하도록)
    e.target.value = "";
  };

  const handleDeleteFolder = (id: string) => {
    // ✅ confirm() → ConfirmDialog
    openConfirm({
      title: "폴더 삭제",
      message: "폴더를 삭제하면 되돌릴 수 없습니다. 삭제하시겠습니까?",
      confirmLabel: "삭제",
      variant: "danger",
      onConfirm: async () => {
        const res = await fetch(`/api/folders/${id}`, { method: "DELETE" });
        if (res.ok) {
          fetchData();
          toast.success("폴더가 삭제되었습니다");
        } else {
          toast.error("삭제 권한이 없거나 오류가 발생했습니다");
        }
      },
    });
  };

  const handleDeleteFile = (id: string) => {
    // ✅ confirm() → ConfirmDialog
    openConfirm({
      title: "파일 삭제",
      message: "파일을 삭제하면 되돌릴 수 없습니다. 삭제하시겠습니까?",
      confirmLabel: "삭제",
      variant: "danger",
      onConfirm: async () => {
        const res = await fetch(`/api/files/${id}`, { method: "DELETE" });
        if (res.ok) {
          setShowFileDetail(false);
          fetchData();
          toast.success("파일이 삭제되었습니다");
        } else {
          toast.error("파일 삭제에 실패했습니다");
        }
      },
    });
  };

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
      setNewTagName("");
      fetchData();
    } else {
      toast.error("태그 추가에 실패했습니다");
    }
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
        body: JSON.stringify({
          resourceType: shareType,
          resourceId,
          sharedWithEmail: shareEmail,
          permission: sharePermission,
        }),
      });
      if (res.ok) {
        toast.success("공유가 완료되었습니다");
        setShowShareModal(false);
        setShareEmail("");
      } else {
        const data = await res.json();
        toast.error(data.error || "공유에 실패했습니다");
      }
    } catch {
      toast.error("공유 중 오류가 발생했습니다");
    } finally {
      setIsSharing(false);
    }
  };

  if (status === "loading") {
    return <div className="h-screen flex items-center justify-center font-bold">로딩 중...</div>;
  }
  if (!session) return null;

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col text-slate-900 pb-20 md:pb-0">
      {/* ConfirmDialog 렌더링 */}
      {confirmDialog}

      {/* 헤더 */}
      <header className="bg-white border-b sticky top-0 z-40 px-6 h-16 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-black text-blue-600">이음</h1>
          <nav className="flex items-center gap-4 text-xs font-bold text-slate-400">
            <Link href="/dashboard" className={pathname === "/dashboard" ? "text-blue-600" : ""}>파일</Link>
            <Link href="/posts" className={pathname === "/posts" ? "text-blue-600" : ""}>게시판</Link>
            <Link href="/chat" className={pathname === "/chat" ? "text-blue-600" : ""}>채팅</Link>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[12px] font-black text-slate-600 bg-slate-100 px-3 py-1.5 rounded-full">
            {session.user?.name}님
          </span>
          <button
            onClick={() => signOut()}
            className="text-[11px] font-black bg-slate-900 text-white px-3 py-2 rounded-lg"
          >
            로그아웃
          </button>
        </div>
      </header>

      {/* 모바일 하단바 */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t px-12 py-3 z-50 flex justify-between items-center shadow-lg">
        <Link href="/dashboard" className="text-xl">📁</Link>
        <button
          onClick={() => setShowFolderModal(true)}
          className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl -mt-10 border-4 border-white shadow-xl"
        >+</button>
        <Link href="/chat" className="text-xl opacity-30">💬</Link>
      </div>

      {/* 경로 안내 */}
      <div className="bg-white border-b py-2.5 px-6 text-[10px] font-black text-slate-300">
        {breadcrumb.map((c, i) => (
          <span key={i}>
            {i > 0 && <span className="mx-2">/</span>}
            <button
              onClick={() => handleBreadcrumbClick(i)}
              className={i === breadcrumb.length - 1 ? "text-slate-800" : "hover:text-slate-600"}
            >
              {c.name}
            </button>
          </span>
        ))}
      </div>

      <main className="max-w-7xl w-full mx-auto p-4 md:p-10 flex-1">
        {/* 검색 & 액션 */}
        <div className="mb-8 flex flex-wrap gap-4">
          <input
            type="text"
            placeholder="파일 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 min-w-[200px] bg-white border rounded-xl py-3 px-4 text-sm outline-none shadow-sm focus:border-blue-500"
          />
          <button
            onClick={() => setShowFolderModal(true)}
            className="bg-white border px-5 py-3 rounded-xl font-bold text-sm"
          >
            📁 새 폴더
          </button>
          <label className="bg-blue-600 text-white px-5 py-3 rounded-xl font-bold text-sm cursor-pointer shadow-lg shadow-blue-500/20">
            📤 업로드
            <input type="file" onChange={handleFileUpload} className="hidden" />
          </label>
        </div>

        {/* 업로드 진행바 */}
        {uploading && (
          <div className="mb-8 p-4 bg-blue-50 rounded-xl border border-blue-100">
            <div className="flex justify-between text-[10px] font-black text-blue-600 mb-1">
              <span>파일 전송 중...</span>
              <span>{uploadProgress.toFixed(0)}%</span>
            </div>
            <div className="w-full bg-blue-100 h-1.5 rounded-full overflow-hidden">
              <div className="bg-blue-600 h-full transition-all" style={{ width: `${uploadProgress}%` }} />
            </div>
          </div>
        )}

        {/* 폴더 섹션 */}
        {!searchQuery && folders.length > 0 && (
          <div className="mb-10">
            <h2 className="text-[11px] font-black text-slate-300 uppercase mb-4 px-1">폴더</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {folders.map((f) => (
                <div
                  key={f.id}
                  className="group bg-white border p-4 rounded-2xl flex items-center justify-between hover:border-blue-500 transition-all shadow-sm"
                >
                  <div
                    className="flex items-center gap-3 truncate cursor-pointer flex-1"
                    onClick={() => handleFolderClick(f)}
                  >
                    <span className="text-2xl">📂</span>
                    <div className="truncate">
                      <p className="text-sm font-bold truncate">{f.name}</p>
                      <p className="text-[10px] font-bold text-slate-400">{f._count.files} items</p>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => { setSelectedFolder(f); setShareType("FOLDER"); setShowShareModal(true); }}
                      className="p-1.5 hover:bg-slate-50 rounded-lg"
                      title="공유"
                    >🔗</button>
                    {f.userId === session.user?.id && (
                      <button
                        onClick={() => handleDeleteFolder(f.id)}
                        className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg"
                        title="삭제"
                      >🗑️</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 파일 섹션 */}
        <div>
          <h2 className="text-[11px] font-black text-slate-300 uppercase mb-4 px-1">파일</h2>
          {loading ? (
            <div className="grid grid-cols-2 xs:grid-cols-3 md:grid-cols-5 lg:grid-cols-7 gap-6">
              {[...Array(7)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="aspect-square bg-gray-200 rounded-[2rem]" />
                  <div className="h-3 bg-gray-200 rounded mt-2 mx-2" />
                </div>
              ))}
            </div>
          ) : displayedFiles.length === 0 ? (
            <div className="text-center py-16 text-slate-300">
              <p className="text-4xl mb-3">📂</p>
              <p className="font-bold text-sm">
                {searchQuery ? "검색 결과가 없습니다" : "파일이 없습니다"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 xs:grid-cols-3 md:grid-cols-5 lg:grid-cols-7 gap-6">
              {displayedFiles.map((file) => (
                <div
                  key={file.id}
                  className="group cursor-pointer"
                  onClick={() => { setSelectedFile(file); setShowFileDetail(true); }}
                >
                  <div className="aspect-square bg-white border rounded-[2rem] flex items-center justify-center overflow-hidden group-hover:shadow-xl transition-all relative">
                    {file.thumbnailUrl ? (
                      <img src={file.thumbnailUrl} className="w-full h-full object-cover" alt={file.originalName} />
                    ) : (
                      <span className="text-4xl">📄</span>
                    )}
                    {file.userId !== session.user?.id && (
                      <span className="absolute top-2 right-2 bg-blue-600 text-white text-[8px] px-1.5 py-0.5 rounded-full">
                        SHARED
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-[10px] font-bold text-center truncate px-2">{file.originalName}</p>
                  <div className="flex flex-wrap justify-center gap-1 mt-1">
                    {file.fileTags?.map((ft) => (
                      <span key={ft.tag.id} className="text-[8px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                        #{ft.tag.name}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* 모달: 폴더 생성 */}
      {showFolderModal && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateFolder}
            className="bg-white p-6 rounded-[2rem] w-full max-w-xs shadow-2xl animate-in fade-in zoom-in duration-200"
          >
            <h3 className="font-black mb-4">새 폴더 생성</h3>
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              autoFocus
              className="w-full border-2 rounded-xl p-3 mb-6 outline-none focus:border-blue-500 font-bold"
              placeholder="폴더 이름 입력"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowFolderModal(false)}
                className="flex-1 font-bold text-slate-400"
              >
                취소
              </button>
              <button
                type="submit"
                className="flex-[2] py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg"
              >
                폴더 만들기
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 모달: 파일 상세 */}
      {showFileDetail && selectedFile && (
        <div
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowFileDetail(false)}
        >
          <div
            className="bg-white w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="aspect-video bg-slate-50 flex items-center justify-center relative border-b">
              {selectedFile.thumbnailUrl ? (
                <img src={selectedFile.thumbnailUrl} className="h-full object-contain" alt={selectedFile.originalName} />
              ) : (
                <span className="text-8xl">📄</span>
              )}
              <button
                onClick={() => setShowFileDetail(false)}
                className="absolute top-4 right-4 bg-white/80 w-8 h-8 rounded-full font-black"
              >
                ✕
              </button>
            </div>
            <div className="p-8">
              <h3 className="text-lg font-black break-all mb-4">{selectedFile.originalName}</h3>
              <div className="mb-6">
                <p className="text-[10px] font-black text-slate-400 uppercase mb-2">태그</p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {selectedFile.fileTags?.map((ft) => (
                    <span key={ft.tag.id} className="text-xs bg-blue-50 text-blue-600 px-2.5 py-1 rounded-lg font-bold">
                      #{ft.tag.name}
                    </span>
                  ))}
                </div>
                <form onSubmit={handleAddTag} className="flex gap-2">
                  <input
                    type="text"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    placeholder="새 태그..."
                    className="flex-1 bg-slate-50 border rounded-xl px-3 py-2 text-xs outline-none"
                  />
                  <button type="submit" className="bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold">
                    추가
                  </button>
                </form>
              </div>
              <div className="flex gap-2 mb-2">
                <button
                  onClick={() => { setShowFileDetail(false); setShareType("FILE"); setShowShareModal(true); }}
                  className="flex-1 py-4 bg-slate-100 rounded-2xl text-xs font-black"
                >
                  🔗 공유
                </button>
                <button
                  onClick={() => handleDeleteFile(selectedFile.id)}
                  className="flex-1 py-4 bg-red-50 text-red-500 rounded-2xl text-xs font-black"
                >
                  🗑️ 삭제
                </button>
              </div>
              <button
                onClick={() => window.open(`/api/files/${selectedFile.id}/download`)}
                className="w-full py-4 bg-blue-600 text-white rounded-2xl text-sm font-black shadow-lg"
              >
                📥 다운로드
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 모달: 공유 */}
      {showShareModal && (
        <div
          className="fixed inset-0 z-[110] bg-black/50 flex items-center justify-center p-4"
          onClick={() => setShowShareModal(false)}
        >
          <div
            className="bg-white p-8 rounded-[2.5rem] w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-black text-lg mb-6">항목 공유</h3>
            <form onSubmit={handleShare} className="space-y-4">
              <input
                type="email"
                value={shareEmail}
                onChange={(e) => setShareEmail(e.target.value)}
                required
                className="w-full border-2 rounded-xl p-3 text-sm outline-none focus:border-blue-500"
                placeholder="상대방 이메일"
              />
              <select
                value={sharePermission}
                onChange={(e) => setSharePermission(e.target.value as "VIEW" | "EDIT")}
                className="w-full border-2 rounded-xl p-3 text-sm font-bold"
              >
                <option value="VIEW">읽기 가능</option>
                <option value="EDIT">편집 가능</option>
              </select>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowShareModal(false)}
                  className="flex-1 font-bold text-slate-400 text-sm"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isSharing}
                  className="flex-[2] py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg disabled:opacity-50"
                >
                  {isSharing ? "공유 중..." : "보내기"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
