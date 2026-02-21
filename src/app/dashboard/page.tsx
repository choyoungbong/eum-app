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

  // [상태관리: 모달 제어]
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [showFileDetail, setShowFileDetail] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null);
  const [shareType, setShareType] = useState<"FILE" | "FOLDER">("FILE");

  // [상태관리: 태그 및 공유]
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [tagSuggestions, setTagSuggestions] = useState<Tag[]>([]);
  const [showTagInput, setShowTagInput] = useState(false);
  const [tagLoading, setTagLoading] = useState(false);
  const [shareEmail, setShareEmail] = useState("");
  const [sharePermission, setSharePermission] = useState<"VIEW" | "EDIT">("VIEW");
  const [shareLoading, setShareLoading] = useState(false);

  /**
   * 1. 데이터 호출 로직 (기존 로직 유지)
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
        const filtered = (data.files || []).filter((f: FileItem) => f.folderId === currentFolderId);
        setFiles(filtered);
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
   * 2. 핸들러 (한글 메시지 적용)
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
      if (res.ok) {
        setShowFolderModal(false);
        fetchFolders();
      } else {
        alert("폴더를 생성하지 못했습니다.");
      }
    } catch {
      alert("서버 통신 중 오류가 발생했습니다.");
    }
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
      if (xhr.status === 201 || xhr.status === 200) {
        fetchFiles();
      } else {
        alert("업로드에 실패했습니다.");
      }
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
      } else {
        setSelectedFile(file);
      }
    } catch {
      setSelectedFile(file);
    }
    setShowTagInput(false);
    setTagInput("");
    setShowFileDetail(true);
  };

  const handleFileDownload = async () => {
    if (!selectedFile) return;
    try {
      const res = await fetch(`/api/files/${selectedFile.id}/download`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = selectedFile.originalName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch {
      alert("파일을 내려받는 중 문제가 발생했습니다.");
    }
  };

  const handleFileDelete = async () => {
    if (!selectedFile || !confirm("정말 이 파일을 삭제할까요?")) return;
    try {
      const res = await fetch(`/api/files/${selectedFile.id}`, { method: "DELETE" });
      if (res.ok) {
        setShowFileDetail(false);
        setSelectedFile(null);
        fetchFiles();
      }
    } catch {
      alert("삭제 작업 중 오류가 발생했습니다.");
    }
  };

  const handleTagInputChange = (value: string) => {
    setTagInput(value);
    if (value.trim()) {
      const filtered = allTags.filter((tag) =>
        tag.name.toLowerCase().includes(value.toLowerCase())
      );
      setTagSuggestions(filtered);
    } else {
      setTagSuggestions([]);
    }
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
    } finally {
      setTagLoading(false);
    }
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
    } catch {
      console.error("태그 삭제 실패");
    }
  };

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
    if (!shareEmail.trim()) return;
    const resourceId = shareType === "FILE" ? selectedFile?.id : selectedFolder?.id;
    if (!resourceId) return;

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
      const data = await res.json();
      if (res.ok) {
        alert("성공적으로 공유했습니다.");
        setShowShareModal(false);
      } else {
        alert(data.error || "공유에 실패했습니다.");
      }
    } finally {
      setShareLoading(false);
    }
  };

  if (status === "loading") return <div className="min-h-screen flex items-center justify-center font-bold text-blue-600">이음을 연결하는 중...</div>;
  if (!session) return null;

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col font-sans text-slate-900">
      {/* 상단 헤더 */}
      <header className="bg-white/80 backdrop-blur-md border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-10">
            <h1 className="text-2xl font-black text-blue-600 tracking-tighter flex items-center gap-2">
              <span className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white text-base">이</span>
              이음
            </h1>
            <nav className="hidden md:flex gap-8 text-sm font-bold text-slate-400">
              <Link href="/dashboard" className="text-blue-600">파일</Link>
              <Link href="/posts" className="hover:text-slate-900 transition-colors">게시판</Link>
              <Link href="/chat" className="hover:text-slate-900 transition-colors">채팅</Link>
            </nav>
          </div>

          <div className="flex-1 max-w-md mx-8 relative hidden sm:block">
            <input 
              type="text"
              placeholder="파일 이름을 검색해보세요"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-100 border-none rounded-xl py-2.5 px-10 text-sm focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
            />
            <span className="absolute left-3 top-3 text-slate-400">🔍</span>
          </div>

          <div className="flex items-center gap-5">
            <div className="text-right hidden lg:block">
              <p className="text-[11px] font-black text-slate-400 leading-none mb-1">반가워요!</p>
              <p className="text-xs font-bold text-slate-800">{session.user?.name}님</p>
            </div>
            <button onClick={() => signOut()} className="text-[11px] font-black text-white bg-slate-900 px-4 py-2 rounded-lg hover:bg-slate-700 transition-all">로그아웃</button>
          </div>
        </div>
      </header>

      {/* 경로 안내 (브레드크럼) */}
      <div className="bg-white border-b py-3 px-6">
        <div className="max-w-7xl mx-auto flex items-center gap-2 text-[10px] font-black text-slate-300 uppercase tracking-widest">
          {breadcrumb.map((crumb, index) => (
            <div key={index} className="flex items-center gap-2">
              {index > 0 && <span className="text-slate-200">/</span>}
              <button 
                onClick={() => handleBreadcrumbClick(index)}
                className={`hover:text-blue-600 transition-colors ${index === breadcrumb.length - 1 ? "text-slate-900" : ""}`}
              >
                {crumb.name}
              </button>
            </div>
          ))}
        </div>
      </div>

      <main className="max-w-7xl w-full mx-auto p-6 lg:p-10 flex-1">
        {/* 주요 액션 버튼 */}
        <div className="flex gap-3 mb-10">
          <button 
            onClick={() => setShowFolderModal(true)}
            className="px-6 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-black text-slate-700 shadow-sm hover:shadow-md hover:border-blue-200 transition-all flex items-center gap-2"
          >
            <span>📁</span> 새 폴더 만들기
          </button>
          <label className="px-6 py-3 bg-blue-600 text-white rounded-2xl text-sm font-black shadow-lg shadow-blue-500/20 hover:bg-blue-700 cursor-pointer transition-all flex items-center gap-2">
            <span>📤</span> 파일 올리기
            <input type="file" onChange={handleFileUpload} className="hidden" disabled={uploading} />
          </label>
        </div>

        {/* 업로드 진행 상태 */}
        {uploading && (
          <div className="mb-10 p-6 bg-white border border-blue-100 rounded-[2rem] shadow-xl shadow-blue-500/5 animate-pulse">
            <div className="flex justify-between items-center mb-3">
              <span className="text-[11px] font-black text-blue-600 tracking-widest">파일 전송 중...</span>
              <span className="text-xs font-black text-blue-600">{uploadProgress.toFixed(0)}%</span>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div className="bg-blue-600 h-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
            </div>
          </div>
        )}

        {/* 폴더 목록 */}
        {!searchQuery && folders.length > 0 && (
          <div className="mb-14">
            <h2 className="text-[11px] font-black text-slate-300 uppercase tracking-[0.2em] mb-6 px-1">폴더 목록</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-5">
              {folders.map((folder) => (
                <div key={folder.id} className="group bg-white border border-slate-100 p-5 rounded-3xl flex items-center justify-between hover:border-blue-500 hover:shadow-2xl hover:shadow-blue-500/5 transition-all cursor-pointer relative">
                  <div className="flex items-center gap-4 overflow-hidden" onClick={() => handleFolderClick(folder)}>
                    <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">📂</div>
                    <div className="truncate">
                      <p className="text-sm font-black text-slate-800 truncate">{folder.name}</p>
                      <p className="text-[10px] font-bold text-slate-400">{folder._count.files}개의 파일</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleOpenShareModal("FOLDER", folder)}
                    className="opacity-0 group-hover:opacity-100 w-8 h-8 flex items-center justify-center bg-slate-50 rounded-full text-slate-400 hover:text-blue-600 transition-all"
                  >
                    🔗
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 파일 목록 */}
        <div>
          <h2 className="text-[11px] font-black text-slate-300 uppercase tracking-[0.2em] mb-6 px-1">파일 목록</h2>
          {loading ? (
            <div className="py-20 text-center text-slate-300 font-black">데이터 동기화 중...</div>
          ) : displayedFiles.length === 0 ? (
            <div className="py-40 text-center border-2 border-dashed border-slate-200 rounded-[3rem] bg-white/50">
              <p className="text-2xl mb-4">🏜️</p>
              <p className="text-sm font-black text-slate-400">{searchQuery ? "검색 결과가 없어요." : "이 폴더는 아직 비어있네요."}</p>
              <p className="text-[11px] text-slate-300 mt-2 font-bold">파일을 올려서 저장 공간을 채워보세요.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-8">
              {displayedFiles.map((file) => (
                <div key={file.id} className="group cursor-pointer" onClick={() => handleFileClick(file)}>
                  <div className="aspect-square bg-white border border-slate-100 rounded-[2.5rem] flex items-center justify-center overflow-hidden group-hover:shadow-2xl group-hover:shadow-blue-500/10 group-hover:-translate-y-2 transition-all relative">
                    {file.thumbnailUrl ? (
                      <img src={file.thumbnailUrl} className="w-full h-full object-cover" alt="" />
                    ) : (
                      <div className="flex flex-col items-center">
                        <span className="text-5xl mb-3">📄</span>
                        <span className="text-[9px] font-black text-slate-300 bg-slate-50 px-2 py-0.5 rounded border border-slate-100 uppercase">{file.mimeType.split('/')[1]}</span>
                      </div>
                    )}
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleOpenShareModal("FILE", file); }}
                      className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 bg-white/90 shadow-xl w-8 h-8 rounded-xl flex items-center justify-center text-xs hover:text-blue-600 transition-all"
                    >
                      🔗
                    </button>
                  </div>
                  <p className="mt-4 text-[11px] font-black text-slate-700 text-center truncate px-3">{file.originalName}</p>
                  <div className="flex flex-wrap justify-center gap-1 mt-2">
                    {file.fileTags?.slice(0, 2).map(ft => (
                      <span key={ft.tag.id} className="px-2 py-0.5 bg-slate-100 text-[8px] font-black rounded-lg text-slate-400 uppercase">#{ft.tag.name}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* 모달: 새 폴더 */}
      {showFolderModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[2.5rem] p-10 w-full max-w-sm shadow-2xl animate-in zoom-in duration-200">
            <h3 className="text-xl font-black mb-2">폴더 생성</h3>
            <p className="text-xs font-bold text-slate-400 mb-8">분류를 위한 폴더 명칭을 정해주세요.</p>
            <form onSubmit={handleCreateFolder}>
              <input 
                name="name" 
                type="text" 
                placeholder="예: 업무 문서, 여행 사진" 
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-sm mb-8 focus:border-blue-500 outline-none transition-all" 
                autoFocus 
              />
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowFolderModal(false)} className="flex-1 py-4 text-sm font-bold text-slate-400 hover:bg-slate-50 rounded-2xl transition-colors">취소</button>
                <button type="submit" className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl text-sm font-black shadow-lg shadow-blue-500/20">생성하기</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 모달: 파일 상세 */}
      {showFileDetail && selectedFile && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4" onClick={() => setShowFileDetail(false)}>
          <div className="bg-white rounded-[3rem] w-full max-w-md overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-300" onClick={e => e.stopPropagation()}>
            <div className="bg-slate-50 aspect-video flex items-center justify-center relative">
              {selectedFile.thumbnailUrl ? (
                <img src={selectedFile.thumbnailUrl} className="h-full w-full object-contain" alt="" />
              ) : (
                <span className="text-[100px]">📄</span>
              )}
              <button onClick={() => setShowFileDetail(false)} className="absolute top-6 right-6 w-10 h-10 bg-white shadow-lg rounded-full flex items-center justify-center font-bold text-slate-400 hover:text-slate-900 transition-all">✕</button>
            </div>
            
            <div className="p-10">
              <div className="mb-10">
                <h3 className="text-2xl font-black text-slate-900 mb-3 break-all leading-tight">{selectedFile.originalName}</h3>
                <div className="flex gap-4 text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">
                  <span className="text-slate-500">{(Number(selectedFile.size) / 1024 / 1024).toFixed(2)} MB</span>
                  <span>•</span>
                  <span className="text-slate-500">{selectedFile.mimeType}</span>
                </div>
              </div>

              {/* 태그 영역 */}
              <div className="mb-10">
                <div className="flex justify-between items-end mb-4 px-1">
                  <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">분류 태그</span>
                  <button onClick={() => setShowTagInput(!showTagInput)} className="text-[10px] font-black text-blue-600 hover:underline">
                    {showTagInput ? "닫기" : "+ 태그 추가"}
                  </button>
                </div>
                
                <div className="flex flex-wrap gap-2 mb-4 min-h-[36px]">
                  {selectedFile.fileTags?.map(ft => (
                    <span key={ft.tag.id} className="px-4 py-2 bg-blue-50 text-blue-600 rounded-2xl text-[10px] font-black flex items-center gap-2 border border-blue-100">
                      #{ft.tag.name}
                      <button onClick={() => handleRemoveTag(ft.tag.id)} className="text-blue-300 hover:text-red-500 transition-colors">✕</button>
                    </span>
                  ))}
                </div>

                {showTagInput && (
                  <div className="relative animate-in fade-in slide-in-from-top-2 duration-200">
                    <input 
                      type="text" 
                      value={tagInput}
                      onChange={e => handleTagInputChange(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddTag(tagInput)}
                      className="w-full border-2 border-slate-100 rounded-2xl px-5 py-3.5 text-xs focus:border-blue-500 outline-none transition-all"
                      placeholder="태그 입력 후 엔터를 눌러주세요"
                    />
                    {tagSuggestions.length > 0 && (
                      <div className="absolute bottom-full left-0 w-full bg-white border border-slate-100 rounded-2xl mb-3 shadow-2xl overflow-hidden z-50">
                        {tagSuggestions.map(tag => (
                          <button key={tag.id} onClick={() => handleAddTag(tag.name)} className="w-full text-left px-5 py-4 text-[11px] font-black text-slate-600 hover:bg-blue-50 transition-colors border-b last:border-0 border-slate-50 uppercase">#{tag.name}</button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button onClick={handleFileDownload} className="flex-[2] py-5 bg-blue-600 text-white rounded-[1.5rem] text-sm font-black shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition-all">내려받기</button>
                <button onClick={handleFileDelete} className="flex-1 py-5 bg-red-50 text-red-500 rounded-[1.5rem] text-xs font-black hover:bg-red-100 transition-all">삭제</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 모달: 공유 */}
      {showShareModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" onClick={() => setShowShareModal(false)}>
          <div className="bg-white rounded-[3rem] p-10 w-full max-w-sm shadow-2xl animate-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-black mb-2">공유하기</h3>
            <p className="text-xs font-bold text-slate-400 mb-10">다른 사용자와 안전하게 연결하세요.</p>
            <form onSubmit={handleShare}>
              <div className="mb-6">
                <label className="block text-[10px] font-black text-slate-300 uppercase tracking-widest mb-3 px-1">상대방 이메일</label>
                <input 
                  type="email" 
                  value={shareEmail}
                  onChange={e => setShareEmail(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-sm focus:border-blue-500 outline-none transition-all" 
                  placeholder="user@example.com"
                  required
                />
              </div>
              <div className="mb-10">
                <label className="block text-[10px] font-black text-slate-300 uppercase tracking-widest mb-3 px-1">권한 설정</label>
                <select 
                  value={sharePermission} 
                  onChange={e => setSharePermission(e.target.value as any)}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold appearance-none outline-none focus:border-blue-500 transition-all"
                >
                  <option value="VIEW">읽기만 가능 (Read)</option>
                  <option value="EDIT">수정 가능 (Write)</option>
                </select>
              </div>
              <div className="flex gap-4">
                <button type="button" onClick={() => setShowShareModal(false)} className="flex-1 py-4 text-xs font-black text-slate-400">취소</button>
                <button type="submit" disabled={shareLoading} className="flex-[2] py-4 bg-slate-900 text-white rounded-2xl text-xs font-black shadow-lg hover:bg-slate-700 disabled:bg-slate-200 transition-all">
                  {shareLoading ? "보내는 중..." : "초대장 발송"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}