"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";

/** [인터페이스 정의] */
interface Folder {
  id: string;
  name: string;
  _count: { children: number; files: number };
}

interface FileItem {
  id: string;
  filename: string;
  originalName: string;
  size: string;
  mimeType: string;
  thumbnailUrl: string | null;
  createdAt: string;
  folderId: string | null;
  fileTags?: Array<{ tag: { id: string; name: string; color: string | null } }>;
}

interface Tag {
  id: string;
  name: string;
  color: string | null;
}

interface BreadcrumbItem {
  id: string | null;
  name: string;
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbItem[]>([{ id: null, name: "홈" }]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [showFolderModal, setShowFolderModal] = useState(false);
  const [showFileDetail, setShowFileDetail] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null);
  const [shareType, setShareType] = useState<"FILE" | "FOLDER">("FILE");

  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [tagSuggestions, setTagSuggestions] = useState<Tag[]>([]);
  const [showTagInput, setShowTagInput] = useState(false);
  const [tagLoading, setTagLoading] = useState(false);
  const [shareEmail, setShareEmail] = useState("");
  const [sharePermission, setSharePermission] = useState<"VIEW" | "EDIT">("VIEW");
  const [shareLoading, setShareLoading] = useState(false);

  // 데이터 로직 (기존 유지)
  const fetchFolders = useCallback(async () => {
    try {
      const url = currentFolderId ? `/api/folders?parentId=${currentFolderId}` : `/api/folders`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setFolders(data.folders || []);
      }
    } catch (err) { console.error(err); }
  }, [currentFolderId]);

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    try {
      const url = currentFolderId ? `/api/files?folderId=${currentFolderId}` : `/api/files?folderId=null`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const filtered = (data.files || []).filter((f: FileItem) => f.folderId === currentFolderId);
        setFiles(filtered);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [currentFolderId]);

  const fetchTags = async () => {
    try {
      const res = await fetch("/api/tags");
      if (res.ok) {
        const data = await res.json();
        setAllTags(data.tags || []);
      }
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchFolders();
      fetchFiles();
      fetchTags();
    }
  }, [session, currentFolderId, fetchFolders, fetchFiles]);

  const displayedFiles = useMemo(() => {
    if (!searchQuery.trim()) return files;
    return files.filter(f => f.originalName.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [files, searchQuery]);

  // 핸들러 생략 (기존과 동일하므로 유지)
  const handleFolderClick = (folder: Folder) => {
    setCurrentFolderId(folder.id);
    setBreadcrumb([...breadcrumb, { id: folder.id, name: folder.name }]);
    setSearchQuery("");
  };

  const handleBreadcrumbClick = (index: number) => {
    const newBreadcrumb = breadcrumb.slice(0, index + 1);
    setBreadcrumb(newBreadcrumb);
    setCurrentFolderId(newBreadcrumb[newBreadcrumb.length - 1].id);
    setSearchQuery("");
  };

  const handleCreateFolder = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    if (!name.trim()) return;
    try {
      const res = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), parentId: currentFolderId }),
      });
      if (res.ok) { setShowFolderModal(false); fetchFolders(); }
    } catch { alert("에러 발생"); }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    if (currentFolderId) formData.append("folderId", currentFolderId);
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) setUploadProgress((e.loaded / e.total) * 100);
    });
    xhr.addEventListener("load", () => {
      if (xhr.status === 201 || xhr.status === 200) fetchFiles();
      setUploading(false);
      setUploadProgress(0);
    });
    xhr.open("POST", "/api/files/upload");
    xhr.send(formData);
  };

  const handleFileClick = async (file: FileItem) => {
    try {
      const res = await fetch(`/api/files/${file.id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedFile(data.file || file);
      } else { setSelectedFile(file); }
    } catch { setSelectedFile(file); }
    setShowTagInput(false);
    setShowFileDetail(true);
  };

  const handleFileDownload = async () => {
    if (!selectedFile) return;
    const res = await fetch(`/api/files/${selectedFile.id}/download`);
    if (res.ok) {
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = selectedFile.originalName;
      a.click();
    }
  };

  const handleFileDelete = async () => {
    if (!selectedFile || !confirm("삭제하시겠습니까?")) return;
    const res = await fetch(`/api/files/${selectedFile.id}`, { method: "DELETE" });
    if (res.ok) { setShowFileDetail(false); fetchFiles(); }
  };

  const handleTagInputChange = (value: string) => {
    setTagInput(value);
    if (value.trim()) {
      setTagSuggestions(allTags.filter(t => t.name.toLowerCase().includes(value.toLowerCase())));
    } else { setTagSuggestions([]); }
  };

  const handleAddTag = async (tagName: string) => {
    if (!selectedFile || !tagName.trim()) return;
    const res = await fetch(`/api/files/${selectedFile.id}/tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tagName: tagName.trim() }),
    });
    const data = await res.json();
    if (res.ok) {
      setSelectedFile(data.file);
      setFiles(prev => prev.map(f => f.id === data.file.id ? data.file : f));
      setTagInput("");
    }
  };

  const handleRemoveTag = async (tagId: string) => {
    const res = await fetch(`/api/files/${selectedFile?.id}/tags`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tagId }),
    });
    const data = await res.json();
    if (res.ok) {
      setSelectedFile(data.file);
      setFiles(prev => prev.map(f => f.id === data.file.id ? data.file : f));
    }
  };

  const handleOpenShareModal = (type: "FILE" | "FOLDER", item: any) => {
    setShareType(type);
    if (type === "FILE") setSelectedFile(item);
    else setSelectedFolder(item);
    setShowShareModal(true);
  };

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    setShareLoading(true);
    const res = await fetch("/api/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resourceType: shareType,
        resourceId: shareType === "FILE" ? selectedFile?.id : selectedFolder?.id,
        sharedWithEmail: shareEmail.trim(),
        permission: sharePermission,
      }),
    });
    if (res.ok) { alert("공유 완료"); setShowShareModal(false); }
    setShareLoading(false);
  };

  if (status === "loading") return <div className="min-h-screen flex items-center justify-center font-bold text-blue-600">이음을 연결하는 중...</div>;
  if (!session) return null;

  return (
    <div className="min-h-[100dvh] bg-[#F8F9FA] flex flex-col font-sans text-slate-900 pb-20 md:pb-0">
      {/* 상단 헤더: 모바일 최적화 */}
      <header className="bg-white/80 backdrop-blur-md border-b sticky top-0 z-40 w-full">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 md:gap-10 shrink-0">
            <h1 className="text-xl md:text-2xl font-black text-blue-600 tracking-tighter flex items-center gap-2">
              <span className="w-7 h-7 md:w-8 md:h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white text-sm md:text-base">이</span>
              이음
            </h1>
            {/* 데스크탑 전용 메뉴 */}
            <nav className="hidden md:flex gap-8 text-sm font-bold text-slate-400">
              <Link href="/dashboard" className="text-blue-600">파일</Link>
              <Link href="/posts" className="hover:text-slate-900 transition-colors">게시판</Link>
              <Link href="/chat" className="hover:text-slate-900 transition-colors">채팅</Link>
            </nav>
          </div>

          {/* 검색창: 모바일에서는 숨기거나 아이콘으로 축소 가능하지만 일단 유지하되 너비 조정 */}
          <div className="flex-1 max-w-md relative hidden sm:block">
            <input 
              type="text"
              placeholder="파일 검색"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-100 border-none rounded-xl py-2 px-9 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
            />
            <span className="absolute left-3 top-2.5 text-xs">🔍</span>
          </div>

          <div className="flex items-center gap-3 md:gap-5 shrink-0">
            <div className="text-right hidden lg:block">
              <p className="text-[10px] font-black text-slate-400 leading-none mb-1">반가워요!</p>
              <p className="text-xs font-bold text-slate-800">{session.user?.name}님</p>
            </div>
            <button onClick={() => signOut()} className="text-[10px] md:text-xs font-black text-white bg-slate-900 px-3 py-2 rounded-lg hover:bg-slate-700 transition-all">로그아웃</button>
          </div>
        </div>
      </header>

      {/* 모바일 하단 탭 바: 세로 화면에서 메뉴 노출 보장 */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t z-50 flex md:hidden items-center justify-around h-16 px-2 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
        <Link href="/dashboard" className="flex flex-col items-center gap-1 text-blue-600">
          <span className="text-xl">📁</span>
          <span className="text-[10px] font-bold">파일</span>
        </Link>
        <Link href="/posts" className="flex flex-col items-center gap-1 text-slate-400">
          <span className="text-xl">📋</span>
          <span className="text-[10px] font-bold">게시판</span>
        </Link>
        <Link href="/chat" className="flex flex-col items-center gap-1 text-slate-400">
          <span className="text-xl">💬</span>
          <span className="text-[10px] font-bold">채팅</span>
        </Link>
      </nav>

      {/* 브레드크럼 */}
      <div className="bg-white border-b py-2 px-4 md:px-6 overflow-x-auto no-scrollbar">
        <div className="max-w-7xl mx-auto flex items-center gap-2 text-[10px] font-black text-slate-300 uppercase tracking-widest whitespace-nowrap">
          {breadcrumb.map((crumb, index) => (
            <div key={index} className="flex items-center gap-2">
              {index > 0 && <span className="text-slate-200">/</span>}
              <button onClick={() => handleBreadcrumbClick(index)} className={`hover:text-blue-600 transition-colors ${index === breadcrumb.length - 1 ? "text-slate-900" : ""}`}>
                {crumb.name}
              </button>
            </div>
          ))}
        </div>
      </div>

      <main className="max-w-7xl w-full mx-auto p-4 md:p-10 flex-1">
        {/* 주요 액션 버튼: 모바일 대응 가로 정렬 */}
        <div className="flex gap-2 md:gap-3 mb-6 md:mb-10">
          <button 
            onClick={() => setShowFolderModal(true)}
            className="flex-1 md:flex-none px-4 md:px-6 py-3 bg-white border border-slate-200 rounded-xl md:rounded-2xl text-xs md:text-sm font-black text-slate-700 shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2"
          >
            <span>📁</span> <span className="hidden xs:inline">폴더 만들기</span><span className="xs:hidden">폴더</span>
          </button>
          <label className="flex-1 md:flex-none px-4 md:px-6 py-3 bg-blue-600 text-white rounded-xl md:rounded-2xl text-xs md:text-sm font-black shadow-lg shadow-blue-500/20 hover:bg-blue-700 cursor-pointer transition-all flex items-center justify-center gap-2">
            <span>📤</span> <span className="hidden xs:inline">파일 올리기</span><span className="xs:hidden">업로드</span>
            <input type="file" onChange={handleFileUpload} className="hidden" disabled={uploading} />
          </label>
        </div>

        {/* 업로드 상태 */}
        {uploading && (
          <div className="mb-6 md:mb-10 p-4 md:p-6 bg-white border border-blue-100 rounded-2xl md:rounded-[2rem] shadow-xl shadow-blue-500/5">
            <div className="flex justify-between items-center mb-3">
              <span className="text-[10px] md:text-[11px] font-black text-blue-600 tracking-widest">전송 중...</span>
              <span className="text-xs font-black text-blue-600">{uploadProgress.toFixed(0)}%</span>
            </div>
            <div className="w-full bg-slate-100 h-1.5 md:h-2 rounded-full overflow-hidden">
              <div className="bg-blue-600 h-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
            </div>
          </div>
        )}

        {/* 폴더 목록: 모바일 2열 */}
        {!searchQuery && folders.length > 0 && (
          <div className="mb-8 md:mb-14">
            <h2 className="text-[10px] md:text-[11px] font-black text-slate-300 uppercase tracking-[0.2em] mb-4 md:mb-6 px-1">폴더 목록</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-5">
              {folders.map((folder) => (
                <div key={folder.id} className="group bg-white border border-slate-100 p-3 md:p-5 rounded-2xl md:rounded-3xl flex items-center justify-between hover:border-blue-500 transition-all cursor-pointer relative shadow-sm">
                  <div className="flex items-center gap-2 md:gap-4 overflow-hidden" onClick={() => handleFolderClick(folder)}>
                    <div className="w-8 h-8 md:w-12 md:h-12 bg-amber-50 rounded-xl flex items-center justify-center text-lg md:text-2xl">📂</div>
                    <div className="truncate">
                      <p className="text-xs md:text-sm font-black text-slate-800 truncate">{folder.name}</p>
                      <p className="text-[9px] md:text-[10px] font-bold text-slate-400">{folder._count.files}개</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 파일 목록: 모바일 그리드 최적화 */}
        <div>
          <h2 className="text-[10px] md:text-[11px] font-black text-slate-300 uppercase tracking-[0.2em] mb-4 md:mb-6 px-1">파일 목록</h2>
          {loading ? (
            <div className="py-20 text-center text-slate-300 font-black">동기화 중...</div>
          ) : displayedFiles.length === 0 ? (
            <div className="py-20 md:py-40 text-center border-2 border-dashed border-slate-200 rounded-3xl md:rounded-[3rem] bg-white/50">
              <p className="text-2xl mb-2">🏜️</p>
              <p className="text-xs md:text-sm font-black text-slate-400">비어있습니다.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-4 md:gap-8">
              {displayedFiles.map((file) => (
                <div key={file.id} className="group cursor-pointer" onClick={() => handleFileClick(file)}>
                  <div className="aspect-square bg-white border border-slate-100 rounded-2xl md:rounded-[2.5rem] flex items-center justify-center overflow-hidden group-hover:shadow-xl transition-all relative">
                    {file.thumbnailUrl ? (
                      <img src={file.thumbnailUrl} className="w-full h-full object-cover" alt="" />
                    ) : (
                      <div className="flex flex-col items-center">
                        <span className="text-3xl md:text-5xl mb-1 md:mb-3">📄</span>
                        <span className="text-[8px] md:text-[9px] font-black text-slate-300 bg-slate-50 px-1.5 py-0.5 rounded uppercase">{file.mimeType.split('/')[1]}</span>
                      </div>
                    )}
                  </div>
                  <p className="mt-2 md:mt-4 text-[10px] md:text-[11px] font-black text-slate-700 text-center truncate px-2">{file.originalName}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* 모달: 기존 로직 유지 (CSS 클래스만 모바일 대응으로 일부 미세 조정) */}
      {showFolderModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl md:rounded-[2.5rem] p-6 md:p-10 w-full max-w-sm shadow-2xl">
            <h3 className="text-lg md:text-xl font-black mb-2">폴더 생성</h3>
            <form onSubmit={handleCreateFolder}>
              <input name="name" type="text" placeholder="폴더 명칭" className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl md:rounded-2xl px-5 py-3 md:py-4 text-sm mb-6 outline-none transition-all focus:border-blue-500" autoFocus />
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowFolderModal(false)} className="flex-1 py-3 text-sm font-bold text-slate-400">취소</button>
                <button type="submit" className="flex-[2] py-3 bg-blue-600 text-white rounded-xl md:rounded-2xl text-sm font-black shadow-lg shadow-blue-500/20">생성</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 파일 상세 모달: 모바일 전체 화면에 가깝게 조정 */}
      {showFileDetail && selectedFile && (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-slate-900/60 backdrop-blur-md p-0 md:p-4" onClick={() => setShowFileDetail(false)}>
          <div className="bg-white rounded-t-[2rem] md:rounded-[3rem] w-full max-w-md overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-300" onClick={e => e.stopPropagation()}>
            <div className="bg-slate-50 aspect-video flex items-center justify-center relative">
              {selectedFile.thumbnailUrl ? <img src={selectedFile.thumbnailUrl} className="h-full w-full object-contain" alt="" /> : <span className="text-7xl md:text-[100px]">📄</span>}
              <button onClick={() => setShowFileDetail(false)} className="absolute top-4 right-4 md:top-6 md:right-6 w-8 h-8 md:w-10 md:h-10 bg-white shadow-lg rounded-full flex items-center justify-center font-bold text-slate-400">✕</button>
            </div>
            <div className="p-6 md:p-10">
              <h3 className="text-xl md:text-2xl font-black text-slate-900 mb-2 break-all">{selectedFile.originalName}</h3>
              <div className="flex gap-3 text-[9px] md:text-[10px] font-black text-slate-300 uppercase tracking-widest mb-8">
                <span>{(Number(selectedFile.size) / 1024 / 1024).toFixed(2)} MB</span>
                <span>•</span>
                <span>{selectedFile.mimeType}</span>
              </div>
              <div className="flex gap-2">
                <button onClick={handleFileDownload} className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl text-sm font-black shadow-xl">내려받기</button>
                <button onClick={handleFileDelete} className="flex-1 py-4 bg-red-50 text-red-500 rounded-2xl text-xs font-black">삭제</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 공유 모달 생략 (로직 동일) */}
    </div>
  );
}