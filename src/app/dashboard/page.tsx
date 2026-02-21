"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";

/**
 * [인터페이스 정의]
 */
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

  // [상태관리: 핵심 데이터]
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbItem[]>([{ id: null, name: "홈" }]);
  const [loading, setLoading] = useState(true);

  // [상태관리: 업로드 및 검색]
  const [searchQuery, setSearchQuery] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // [상태관리: 모달 및 선택]
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [showFileDetail, setShowFileDetail] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null);
  const [shareType, setShareType] = useState<"FILE" | "FOLDER">("FILE");

  // [상태관리: 태그]
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [tagSuggestions, setTagSuggestions] = useState<Tag[]>([]);
  const [showTagInput, setShowTagInput] = useState(false);
  const [tagLoading, setTagLoading] = useState(false);

  // [상태관리: 공유]
  const [shareEmail, setShareEmail] = useState("");
  const [sharePermission, setSharePermission] = useState<"VIEW" | "EDIT">("VIEW");
  const [shareLoading, setShareLoading] = useState(false);

  /**
   * 1. 데이터 호출 (복구 완료)
   */
  const fetchFolders = useCallback(async () => {
    try {
      const url = currentFolderId ? `/api/folders?parentId=${currentFolderId}` : `/api/folders`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setFolders(data.folders || []);
      }
    } catch (err) {
      console.error("폴더 조회 실패:", err);
    }
  }, [currentFolderId]);

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    try {
      const url = currentFolderId ? `/api/files?folderId=${currentFolderId}` : `/api/files?folderId=null`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setFiles(data.files || []);
      }
    } catch (err) {
      console.error("파일 조회 실패:", err);
    } finally {
      setLoading(false);
    }
  }, [currentFolderId]);

  const fetchTags = async () => {
    try {
      const res = await fetch("/api/tags");
      if (res.ok) {
        const data = await res.json();
        setAllTags(data.tags || []);
      }
    } catch (err) {
      console.error("태그 조회 실패:", err);
    }
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

  /**
   * 2. 핸들러 (태그, 공유, 폴더 이동 로직 전면 복구)
   */
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
    } catch { alert("오류 발생"); }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadProgress(0);
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
    setTagInput("");
    setShowFileDetail(true);
  };

  // [태그 관리 로직 복구]
  const handleTagInputChange = (value: string) => {
    setTagInput(value);
    if (value.trim()) {
      setTagSuggestions(allTags.filter(t => t.name.toLowerCase().includes(value.toLowerCase())));
    } else { setTagSuggestions([]); }
  };

  const handleAddTag = async (tagName: string) => {
    if (!selectedFile || !tagName.trim()) return;
    setTagLoading(true);
    try {
      const res = await fetch(`/api/files/${selectedFile.id}/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagName: tagName.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.file) {
        setSelectedFile(data.file);
        setFiles(prev => prev.map(f => f.id === data.file.id ? data.file : f));
        setTagInput("");
        setTagSuggestions([]);
        fetchTags();
      }
    } finally { setTagLoading(false); }
  };

  const handleRemoveTag = async (tagId: string) => {
    if (!selectedFile) return;
    try {
      const res = await fetch(`/api/files/${selectedFile.id}/tags`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagId }),
      });
      const data = await res.json();
      if (res.ok && data.file) {
        setSelectedFile(data.file);
        setFiles(prev => prev.map(f => f.id === data.file.id ? data.file : f));
      }
    } catch { console.error("태그 삭제 실패"); }
  };

  // [공유 로직 복구]
  const handleOpenShareModal = (type: "FILE" | "FOLDER", item: any) => {
    setShareType(type);
    if (type === "FILE") setSelectedFile(item);
    else setSelectedFolder(item);
    setShareEmail("");
    setSharePermission("VIEW");
    setShowShareModal(true);
  };

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    const resourceId = shareType === "FILE" ? selectedFile?.id : selectedFolder?.id;
    if (!resourceId || !shareEmail.trim()) return;
    setShareLoading(true);
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resourceType: shareType,
          resourceId,
          sharedWithEmail: shareEmail.trim(),
          permission: sharePermission,
        }),
      });
      if (res.ok) { alert("공유 완료"); setShowShareModal(false); }
      else { const d = await res.json(); alert(d.error || "실패"); }
    } finally { setShareLoading(false); }
  };

  const handleFileDownload = async () => {
    if (!selectedFile) return;
    try {
      const res = await fetch(`/api/files/${selectedFile.id}/download`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = selectedFile.originalName;
        document.body.appendChild(a); a.click();
        window.URL.revokeObjectURL(url); document.body.removeChild(a);
      }
    } catch { alert("다운로드 오류"); }
  };

  const handleFileDelete = async () => {
    if (!selectedFile || !confirm("삭제하시겠습니까?")) return;
    try {
      const res = await fetch(`/api/files/${selectedFile.id}`, { method: "DELETE" });
      if (res.ok) { setShowFileDetail(false); fetchFiles(); }
    } catch { alert("삭제 오류"); }
  };

  if (status === "loading") return <div className="min-h-screen flex items-center justify-center font-bold text-blue-600">불러오는 중...</div>;
  if (!session) return null;

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col font-sans text-slate-900 overflow-x-hidden">
      {/* 상단 헤더 */}
      <header className="bg-white/90 backdrop-blur-md border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between gap-2">
          <h1 className="text-xl md:text-2xl font-black text-blue-600 flex items-center gap-2 shrink-0">
            <span className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white text-base">이</span>
            <span className="hidden xs:block">이음</span>
          </h1>
          <div className="flex-1 max-w-md relative">
            <input type="text" placeholder="검색" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-100 border-none rounded-xl py-2 pl-9 pr-3 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none" />
            <span className="absolute left-3 top-2.5 text-slate-400">🔍</span>
          </div>
          <div className="flex items-center gap-2 md:gap-5">
            <nav className="hidden lg:flex gap-6 text-sm font-bold text-slate-400 mr-4">
              <Link href="/dashboard" className="text-blue-600">파일</Link>
              <Link href="/posts" className="hover:text-slate-900">게시판</Link>
              <Link href="/chat" className="hover:text-slate-900">채팅</Link>
            </nav>
            <button onClick={() => signOut()} className="text-[10px] font-black text-white bg-slate-900 px-3 py-2 rounded-lg hover:bg-slate-700 shrink-0">
              로그아웃
            </button>
          </div>
        </div>
      </header>

      {/* 모바일 하단 내비게이션 (복구된 하단 바) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t z-50 flex lg:hidden items-center justify-around h-16 px-2 shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
        <Link href="/dashboard" className="flex flex-col items-center gap-1 flex-1">
          <span className="text-xl">📁</span><span className="text-[10px] font-bold text-blue-600">파일</span>
        </Link>
        <Link href="/posts" className="flex flex-col items-center gap-1 flex-1">
          <span className="text-xl">📋</span><span className="text-[10px] font-bold text-slate-400">게시판</span>
        </Link>
        <Link href="/chat" className="flex flex-col items-center gap-1 flex-1">
          <span className="text-xl">💬</span><span className="text-[10px] font-bold text-slate-400">채팅</span>
        </Link>
        <button onClick={() => setShowFolderModal(true)} className="flex flex-col items-center gap-1 flex-1">
          <span className="text-xl">➕</span><span className="text-[10px] font-bold text-slate-400">새 폴더</span>
        </button>
      </nav>

      {/* 브레드크럼 */}
      <div className="bg-white border-b py-3 px-4 md:px-6">
        <div className="max-w-7xl mx-auto flex items-center gap-2 text-[10px] font-black text-slate-300 uppercase overflow-x-auto whitespace-nowrap">
          {breadcrumb.map((crumb, index) => (
            <div key={index} className="flex items-center gap-2">
              {index > 0 && <span className="text-slate-200">/</span>}
              <button onClick={() => handleBreadcrumbClick(index)} className={index === breadcrumb.length - 1 ? "text-slate-900" : ""}>{crumb.name}</button>
            </div>
          ))}
        </div>
      </div>

      <main className="max-w-7xl w-full mx-auto p-4 md:p-10 flex-1 pb-24">
        {/* 업로드/폴더 버튼 */}
        <div className="flex gap-3 mb-8">
          <button onClick={() => setShowFolderModal(true)} className="flex-1 md:flex-none px-6 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-black text-slate-700 shadow-sm">
            <span>📁 새 폴더</span>
          </button>
          <label className="flex-1 md:flex-none px-6 py-3 bg-blue-600 text-white rounded-2xl text-sm font-black shadow-lg shadow-blue-500/20 cursor-pointer text-center">
            <span>📤 파일 업로드</span>
            <input type="file" onChange={handleFileUpload} className="hidden" disabled={uploading} />
          </label>
        </div>

        {uploading && (
          <div className="mb-10 p-6 bg-white border border-blue-100 rounded-[2rem] shadow-xl">
            <div className="flex justify-between items-center mb-3">
              <span className="text-[11px] font-black text-blue-600 uppercase">업로드 중...</span>
              <span className="text-xs font-black text-blue-600">{uploadProgress.toFixed(0)}%</span>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div className="bg-blue-600 h-full transition-all" style={{ width: `${uploadProgress}%` }} />
            </div>
          </div>
        )}

        {/* 폴더 그리드 (공유 버튼 포함 복구) */}
        {!searchQuery && folders.length > 0 && (
          <div className="mb-10">
            <h2 className="text-[11px] font-black text-slate-300 uppercase tracking-widest mb-6">폴더</h2>
            <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {folders.map((folder) => (
                <div key={folder.id} className="group bg-white border border-slate-100 p-4 rounded-2xl flex items-center justify-between hover:border-blue-500 shadow-sm cursor-pointer transition-all">
                  <div className="flex items-center gap-3 overflow-hidden flex-1" onClick={() => handleFolderClick(folder)}>
                    <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-xl shrink-0">📂</div>
                    <div className="truncate">
                      <p className="text-sm font-black text-slate-800 truncate">{folder.name}</p>
                      <p className="text-[10px] font-bold text-slate-400">{folder._count.files}개 파일</p>
                    </div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); handleOpenShareModal("FOLDER", folder); }} 
                    className="w-8 h-8 flex items-center justify-center bg-slate-50 rounded-full text-slate-400 hover:text-blue-600 ml-2">🔗</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 파일 그리드 (공유/태그 연동 복구) */}
        <div>
          <h2 className="text-[11px] font-black text-slate-300 uppercase tracking-widest mb-6">파일</h2>
          {loading ? (
            <div className="py-20 text-center text-slate-300 font-black">동기화 중...</div>
          ) : displayedFiles.length === 0 ? (
            <div className="py-20 text-center border-2 border-dashed border-slate-200 rounded-[3rem] bg-white/50 text-slate-400 font-black">파일이 없습니다.</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-4 md:gap-8">
              {displayedFiles.map((file) => (
                <div key={file.id} className="group cursor-pointer" onClick={() => handleFileClick(file)}>
                  <div className="aspect-square bg-white border border-slate-100 rounded-[2rem] flex items-center justify-center overflow-hidden group-hover:shadow-xl transition-all relative shadow-sm">
                    {file.thumbnailUrl ? (
                      <img src={file.thumbnailUrl} className="w-full h-full object-cover" alt="" />
                    ) : (
                      <div className="flex flex-col items-center">
                        <span className="text-4xl mb-2">📄</span>
                        <span className="text-[8px] font-black text-slate-300 bg-slate-50 px-2 py-0.5 rounded uppercase">{file.mimeType.split('/')[1]}</span>
                      </div>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); handleOpenShareModal("FILE", file); }}
                      className="absolute top-3 right-3 bg-white/90 shadow-lg w-8 h-8 rounded-lg flex items-center justify-center text-[10px] hover:text-blue-600 transition-all">🔗</button>
                  </div>
                  <p className="mt-4 text-[11px] font-black text-slate-700 text-center truncate px-2">{file.originalName}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* 모달: 폴더 생성 */}
      {showFolderModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl">
            <h3 className="text-xl font-black mb-6">새 폴더 생성</h3>
            <form onSubmit={handleCreateFolder}>
              <input name="name" type="text" placeholder="폴더명" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-sm mb-6 outline-none focus:border-blue-500" autoFocus />
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowFolderModal(false)} className="flex-1 font-bold text-slate-400">취소</button>
                <button type="submit" className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg">생성</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 모달: 파일 상세 (태그 기능 완전 복구) */}
      {showFileDetail && selectedFile && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-md p-0 sm:p-4" onClick={() => setShowFileDetail(false)}>
          <div className="bg-white rounded-t-[3rem] sm:rounded-[3rem] w-full max-w-md overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="bg-slate-50 aspect-video flex items-center justify-center relative">
              {selectedFile.thumbnailUrl ? <img src={selectedFile.thumbnailUrl} className="h-full w-full object-contain" alt="" /> : <span className="text-[80px]">📄</span>}
              <button onClick={() => setShowFileDetail(false)} className="absolute top-6 right-6 w-10 h-10 bg-white shadow-lg rounded-full flex items-center justify-center font-bold text-slate-400 hover:text-slate-900 transition-all">✕</button>
            </div>
            
            <div className="p-8">
              <div className="mb-8">
                <h3 className="text-xl font-black text-slate-900 mb-2 break-all">{selectedFile.originalName}</h3>
                <div className="flex gap-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <span>{(Number(selectedFile.size) / 1024 / 1024).toFixed(2)} MB</span>
                  <span>•</span>
                  <span>{selectedFile.mimeType}</span>
                </div>
              </div>

              {/* [분류 태그 섹션 복구] */}
              <div className="mb-8">
                <div className="flex justify-between items-center mb-4 px-1">
                  <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">분류 태그</span>
                  <button onClick={() => setShowTagInput(!showTagInput)} className="text-[10px] font-black text-blue-600">{showTagInput ? "닫기" : "+ 추가"}</button>
                </div>
                <div className="flex flex-wrap gap-2 mb-4 min-h-[30px]">
                  {selectedFile.fileTags?.map(ft => (
                    <span key={ft.tag.id} className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-xl text-[10px] font-black flex items-center gap-2 border border-blue-100">
                      #{ft.tag.name}
                      <button onClick={() => handleRemoveTag(ft.tag.id)} className="text-blue-300 hover:text-red-500">✕</button>
                    </span>
                  ))}
                </div>
                {showTagInput && (
                  <div className="relative">
                    <input type="text" value={tagInput} onChange={e => handleTagInputChange(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddTag(tagInput)}
                      className="w-full border-2 border-slate-100 rounded-2xl px-5 py-3 text-xs focus:border-blue-500 outline-none" placeholder="태그 입력 후 엔터" />
                    {tagSuggestions.length > 0 && (
                      <div className="absolute bottom-full left-0 w-full bg-white border border-slate-100 rounded-2xl mb-2 shadow-2xl overflow-hidden z-50">
                        {tagSuggestions.map(tag => (
                          <button key={tag.id} onClick={() => handleAddTag(tag.name)} className="w-full text-left px-5 py-3 text-[10px] font-black text-slate-600 hover:bg-blue-50 border-b last:border-0 border-slate-50">#{tag.name}</button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button onClick={handleFileDownload} className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl text-sm font-black shadow-lg">내려받기</button>
                <button onClick={handleFileDelete} className="flex-1 py-4 bg-red-50 text-red-500 rounded-2xl text-xs font-black">삭제</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 모달: 공유 (폴더/파일 공유 통합 복구) */}
      {showShareModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" onClick={() => setShowShareModal(false)}>
          <div className="bg-white rounded-[3rem] p-8 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-black mb-2">공유하기 ({shareType === "FILE" ? "파일" : "폴더"})</h3>
            <p className="text-xs font-bold text-slate-400 mb-8">상대의 이메일을 입력하세요.</p>
            <form onSubmit={handleShare}>
              <div className="mb-4">
                <label className="block text-[10px] font-black text-slate-300 uppercase mb-2">이메일</label>
                <input type="email" value={shareEmail} onChange={e => setShareEmail(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3.5 text-sm focus:border-blue-500 outline-none" placeholder="example@email.com" required />
              </div>
              <div className="mb-8">
                <label className="block text-[10px] font-black text-slate-300 uppercase mb-2">권한</label>
                <select value={sharePermission} onChange={e => setSharePermission(e.target.value as any)}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3.5 text-sm font-bold outline-none">
                  <option value="VIEW">읽기 전용</option>
                  <option value="EDIT">편집 가능</option>
                </select>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowShareModal(false)} className="flex-1 py-4 text-xs font-black text-slate-400">취소</button>
                <button type="submit" disabled={shareLoading} className="flex-[2] py-4 bg-slate-900 text-white rounded-2xl text-xs font-black shadow-lg">
                  {shareLoading ? "전송 중..." : "공유 보내기"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}