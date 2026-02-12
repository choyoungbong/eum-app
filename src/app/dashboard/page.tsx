"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

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
  fileTags?: Array<{ tag: { id: string; name: string; color: string | null } }>;
}

interface Tag {
  id: string;
  name: string;
  color: string | null;
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [breadcrumb, setBreadcrumb] = useState([{ id: null as string | null, name: "홈" }]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // 모달 상태
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [showFileDetail, setShowFileDetail] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null);
  const [shareType, setShareType] = useState<"FILE" | "FOLDER">("FILE");

  // 태그 상태
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [tagSuggestions, setTagSuggestions] = useState<Tag[]>([]);
  const [showTagInput, setShowTagInput] = useState(false);
  const [tagLoading, setTagLoading] = useState(false);

  // 공유 상태
  const [shareEmail, setShareEmail] = useState("");
  const [sharePermission, setSharePermission] = useState<"VIEW" | "EDIT">("VIEW");
  const [shareLoading, setShareLoading] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchFolders();
      fetchFiles();
      fetchTags();
    }
  }, [session, currentFolderId]);

  const fetchFolders = async () => {
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
  };

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const url = currentFolderId ? `/api/files?folderId=${currentFolderId}` : `/api/files`;
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
  };

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

  // ========== 폴더 ==========

  const handleFolderClick = (folder: Folder) => {
    setCurrentFolderId(folder.id);
    setBreadcrumb([...breadcrumb, { id: folder.id, name: folder.name }]);
  };

  const handleBreadcrumbClick = (index: number) => {
    const newBreadcrumb = breadcrumb.slice(0, index + 1);
    setBreadcrumb(newBreadcrumb);
    setCurrentFolderId(newBreadcrumb[newBreadcrumb.length - 1].id);
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
        alert("폴더 생성 실패");
      }
    } catch {
      alert("폴더 생성 중 오류가 발생했습니다");
    }
  };

  // ========== 파일 ==========

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
      if (xhr.status === 201) fetchFiles();
      else alert("업로드 실패");
      setUploading(false);
      setUploadProgress(0);
    });
    xhr.open("POST", "/api/files/upload");
    xhr.send(formData);
  };

  const handleFileClick = async (file: FileItem) => {
    // 최신 태그 정보 포함해서 파일 상세 로드
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
      } else {
        alert("다운로드 실패");
      }
    } catch {
      alert("다운로드 중 오류가 발생했습니다");
    }
  };

  const handleFileDelete = async () => {
    if (!selectedFile || !confirm("정말 삭제하시겠습니까?")) return;
    try {
      const res = await fetch(`/api/files/${selectedFile.id}`, { method: "DELETE" });
      if (res.ok) {
        setShowFileDetail(false);
        setSelectedFile(null);
        fetchFiles();
      } else {
        alert("삭제 실패");
      }
    } catch {
      alert("삭제 중 오류가 발생했습니다");
    }
  };

  // ========== 태그 ==========

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

      if (res.ok) {
        // API가 업데이트된 file을 반환하면 바로 반영
        if (data.file) {
          setSelectedFile(data.file);
          // 파일 목록도 업데이트
          setFiles((prev) =>
            prev.map((f) => (f.id === data.file.id ? data.file : f))
          );
        }
        setTagInput("");
        setTagSuggestions([]);
        fetchTags(); // 전체 태그 목록 갱신
      } else {
        alert(data.error || "태그 추가 실패");
      }
    } catch {
      alert("태그 추가 중 오류가 발생했습니다");
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
        setFiles((prev) =>
          prev.map((f) => (f.id === data.file.id ? data.file : f))
        );
      }
    } catch {
      console.error("태그 삭제 실패");
    }
  };

  // ========== 공유 ==========

  const handleOpenShareModal = (
    type: "FILE" | "FOLDER",
    item: FileItem | Folder
  ) => {
    setShareType(type);
    if (type === "FILE") setSelectedFile(item as FileItem);
    else setSelectedFolder(item as Folder);
    setShareEmail("");
    setSharePermission("VIEW");
    setShowShareModal(true);
  };

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shareEmail.trim()) {
      alert("이메일을 입력하세요");
      return;
    }

    const resourceId =
      shareType === "FILE" ? selectedFile?.id : selectedFolder?.id;
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
        alert(`✅ ${data.message || "공유가 완료되었습니다!"}`);
        setShowShareModal(false);
        setShareEmail("");
      } else {
        // 서버에서 오는 실제 오류 메시지 표시
        alert(`❌ ${data.error || "공유 실패"}`);
      }
    } catch {
      alert("공유 중 오류가 발생했습니다");
    } finally {
      setShareLoading(false);
    }
  };

  if (status === "loading") {
    return <div className="min-h-screen flex items-center justify-center">로딩 중...</div>;
  }
  if (!session) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold">☁️ Personal Cloud</h1>
              <nav className="flex gap-4 text-sm">
                <Link href="/dashboard" className="text-blue-600 font-medium">파일</Link>
                <Link href="/posts" className="text-gray-600 hover:text-gray-900">게시판</Link>
                <Link href="/search" className="text-gray-600 hover:text-gray-900">🔍 검색</Link>
                <Link href="/chat" className="text-gray-600 hover:text-gray-900">💬 채팅</Link>
              </nav>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">{session.user?.name}</span>
              <button
                onClick={() => signOut()}
                className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
              >
                로그아웃
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Breadcrumb */}
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center gap-1 text-sm">
          {breadcrumb.map((crumb, index) => (
            <div key={index} className="flex items-center gap-1">
              {index > 0 && <span className="text-gray-400">/</span>}
              <button
                onClick={() => handleBreadcrumbClick(index)}
                className={`hover:text-blue-700 ${
                  index === breadcrumb.length - 1
                    ? "text-gray-700 font-medium"
                    : "text-blue-600"
                }`}
              >
                {crumb.name}
              </button>
            </div>
          ))}
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* 액션 버튼 */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setShowFolderModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
          >
            📁 새 폴더
          </button>
          <label className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 cursor-pointer text-sm">
            📤 파일 업로드
            <input type="file" onChange={handleFileUpload} className="hidden" disabled={uploading} />
          </label>
        </div>

        {/* 업로드 진행률 */}
        {uploading && (
          <div className="mb-4">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="text-xs text-gray-600 mt-1">{uploadProgress.toFixed(0)}%</p>
          </div>
        )}

        {/* 폴더 목록 */}
        {folders.length > 0 && (
          <div className="mb-6">
            <h2 className="text-base font-semibold mb-3">📁 내 폴더</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {folders.map((folder) => (
                <div key={folder.id} className="p-4 bg-white border rounded-lg shadow-sm hover:shadow-md transition group">
                  <div className="flex justify-between items-center">
                    <button onClick={() => handleFolderClick(folder)} className="flex-1 text-left flex items-center gap-2">
                      <span className="text-2xl">📁</span>
                      <div>
                        <p className="font-medium text-sm">{folder.name}</p>
                        <p className="text-xs text-gray-500">
                          {folder._count.children}개 폴더, {folder._count.files}개 파일
                        </p>
                      </div>
                    </button>
                    <button
                      onClick={() => handleOpenShareModal("FOLDER", folder)}
                      className="opacity-0 group-hover:opacity-100 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition"
                    >
                      공유
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 파일 목록 */}
        <div>
          <h2 className="text-base font-semibold mb-3">파일</h2>
          {loading ? (
            <p className="text-gray-500 text-sm">로딩 중...</p>
          ) : files.length === 0 ? (
            <p className="text-gray-500 text-sm">파일이 없습니다</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {files.map((file) => (
                <div key={file.id} className="group relative cursor-pointer" onClick={() => handleFileClick(file)}>
                  <div className="aspect-square bg-white border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition">
                    {file.thumbnailUrl ? (
                      <img src={file.thumbnailUrl} alt={file.originalName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-100">
                        <span className="text-4xl">📄</span>
                      </div>
                    )}
                  </div>
                  <p className="mt-1 text-xs truncate">{file.originalName}</p>
                  {/* 태그 표시 */}
                  {file.fileTags && file.fileTags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {file.fileTags.slice(0, 2).map((ft) => (
                        <span key={ft.tag.id} className="px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
                          {ft.tag.name}
                        </span>
                      ))}
                      {file.fileTags.length > 2 && (
                        <span className="text-xs text-gray-400">+{file.fileTags.length - 2}</span>
                      )}
                    </div>
                  )}
                  {/* 공유 버튼 (호버 시) */}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleOpenShareModal("FILE", file); }}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                  >
                    공유
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* ===== 폴더 생성 모달 ===== */}
      {showFolderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4" onClick={() => setShowFolderModal(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">새 폴더 만들기</h3>
            <form onSubmit={handleCreateFolder}>
              <input type="text" name="name" placeholder="폴더 이름" className="w-full px-3 py-2 border rounded-md mb-4" autoFocus />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowFolderModal(false)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md">취소</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">생성</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== 파일 상세 모달 ===== */}
      {showFileDetail && selectedFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4" onClick={() => setShowFileDetail(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">파일 상세</h3>

            {/* 미리보기 */}
            {selectedFile.mimeType.startsWith("image/") && selectedFile.thumbnailUrl && (
              <div className="mb-4 text-center">
                <img src={selectedFile.thumbnailUrl} alt={selectedFile.originalName} className="max-w-full max-h-64 mx-auto rounded" />
              </div>
            )}

            {/* 파일 정보 */}
            <div className="space-y-1 mb-4 text-sm">
              <p><strong>파일명:</strong> {selectedFile.originalName}</p>
              <p><strong>크기:</strong> {(Number(selectedFile.size) / 1024 / 1024).toFixed(2)} MB</p>
              <p><strong>타입:</strong> {selectedFile.mimeType}</p>
              <p><strong>업로드:</strong> {new Date(selectedFile.createdAt).toLocaleString("ko-KR")}</p>
            </div>

            {/* 태그 섹션 */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <strong className="text-sm">태그</strong>
                <button
                  onClick={() => { setShowTagInput(!showTagInput); setTagInput(""); setTagSuggestions([]); }}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  {showTagInput ? "취소" : "+ 태그 추가"}
                </button>
              </div>

              {/* 현재 태그 목록 */}
              <div className="flex flex-wrap gap-2 mb-2 min-h-[28px]">
                {selectedFile.fileTags && selectedFile.fileTags.length > 0 ? (
                  selectedFile.fileTags.map((ft) => (
                    <span key={ft.tag.id} className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs flex items-center gap-1">
                      {ft.tag.name}
                      <button onClick={() => handleRemoveTag(ft.tag.id)} className="text-red-400 hover:text-red-600 ml-1 font-bold">×</button>
                    </span>
                  ))
                ) : (
                  <p className="text-xs text-gray-400">태그가 없습니다</p>
                )}
              </div>

              {/* 태그 입력창 */}
              {showTagInput && (
                <div className="relative">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => handleTagInputChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && tagInput.trim()) {
                        e.preventDefault();
                        handleAddTag(tagInput);
                      }
                    }}
                    placeholder="태그 입력 후 Enter"
                    className="w-full px-3 py-2 border rounded-md text-sm"
                    disabled={tagLoading}
                    autoFocus
                  />
                  {tagLoading && <span className="absolute right-3 top-2 text-xs text-gray-400">추가 중...</span>}
                  {/* 자동완성 */}
                  {tagSuggestions.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-32 overflow-y-auto">
                      {tagSuggestions.map((tag) => (
                        <button key={tag.id} onClick={() => handleAddTag(tag.name)} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100">
                          {tag.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 버튼 */}
            <div className="flex justify-end gap-2">
              <button onClick={handleFileDownload} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm">다운로드</button>
              <button onClick={handleFileDelete} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm">삭제</button>
              <button onClick={() => setShowFileDetail(false)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md text-sm">닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== 공유 모달 ===== */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4" onClick={() => setShowShareModal(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">
              {shareType === "FILE" ? "📄 파일" : "📁 폴더"} 공유
            </h3>
            <form onSubmit={handleShare}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">공유할 사용자 이메일</label>
                <input
                  type="email"
                  value={shareEmail}
                  onChange={(e) => setShareEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="w-full px-3 py-2 border rounded-md text-sm"
                  required
                  autoFocus
                />
                <p className="text-xs text-gray-400 mt-1">※ 이미 가입된 사용자만 공유 가능합니다</p>
              </div>
              <div className="mb-5">
                <label className="block text-sm font-medium mb-1">권한</label>
                <select
                  value={sharePermission}
                  onChange={(e) => setSharePermission(e.target.value as "VIEW" | "EDIT")}
                  className="w-full px-3 py-2 border rounded-md text-sm"
                >
                  <option value="VIEW">보기</option>
                  <option value="EDIT">수정</option>
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowShareModal(false)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md text-sm">취소</button>
                <button type="submit" disabled={shareLoading} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 text-sm">
                  {shareLoading ? "공유 중..." : "공유"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
