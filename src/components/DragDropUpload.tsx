"use client";
// src/components/DragDropUpload.tsx
// 대시보드 업로드 영역을 이 컴포넌트로 교체하세요

import { useState, useRef, useCallback } from "react";
import { Upload, X, CheckCircle, AlertCircle, File } from "lucide-react";
import { getFileIcon, formatFileSize } from "@/lib/client-utils";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_FILES = 10;

interface UploadFile {
  id: string;
  file: File;
  progress: number;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
}

interface Props {
  folderId?: string | null;
  onUploadComplete?: () => void;
}

export default function DragDropUpload({ folderId, onUploadComplete }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<UploadFile[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((newFiles: File[]) => {
    const valid = newFiles
      .slice(0, MAX_FILES - files.length)
      .filter((f) => {
        if (f.size > MAX_FILE_SIZE) return false;
        return true;
      })
      .map((f) => ({
        id: Math.random().toString(36).slice(2),
        file: f,
        progress: 0,
        status: "pending" as const,
      }));
    setFiles((prev) => [...prev, ...valid]);
  }, [files.length]);

  // 드래그 이벤트
  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = Array.from(e.dataTransfer.files);
    addFiles(dropped);
  };

  const removeFile = (id: string) => setFiles((f) => f.filter((x) => x.id !== id));

  const uploadFile = async (uploadFile: UploadFile) => {
    setFiles((prev) => prev.map((f) => f.id === uploadFile.id ? { ...f, status: "uploading" } : f));

    const formData = new FormData();
    formData.append("file", uploadFile.file);
    if (folderId) formData.append("folderId", folderId);

    try {
      const xhr = new XMLHttpRequest();
      await new Promise<void>((resolve, reject) => {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            setFiles((prev) => prev.map((f) => f.id === uploadFile.id ? { ...f, progress: pct } : f));
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(JSON.parse(xhr.responseText)?.error ?? "업로드 실패"));
        };
        xhr.onerror = () => reject(new Error("네트워크 오류"));
        xhr.open("POST", "/api/files/upload");
        xhr.send(formData);
      });

      setFiles((prev) => prev.map((f) => f.id === uploadFile.id ? { ...f, status: "done", progress: 100 } : f));
    } catch (err: any) {
      setFiles((prev) => prev.map((f) => f.id === uploadFile.id ? { ...f, status: "error", error: err.message } : f));
    }
  };

  const uploadAll = async () => {
    const pending = files.filter((f) => f.status === "pending");
    await Promise.all(pending.map(uploadFile));
    if (pending.length > 0) onUploadComplete?.();
  };

  const clearDone = () => setFiles((f) => f.filter((x) => x.status !== "done"));

  const hasPending = files.some((f) => f.status === "pending");
  const allDone = files.length > 0 && files.every((f) => f.status === "done" || f.status === "error");

  return (
    <div className="space-y-3">
      {/* 드롭 영역 */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center min-h-36 rounded-2xl border-2 border-dashed cursor-pointer transition-all ${
          isDragging
            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 scale-[1.01]"
            : "border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-slate-800"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => addFiles(Array.from(e.target.files ?? []))}
        />
        <Upload size={28} className={`mb-2 transition-colors ${isDragging ? "text-blue-500" : "text-gray-400 dark:text-slate-500"}`} />
        <p className={`text-sm font-semibold transition-colors ${isDragging ? "text-blue-600 dark:text-blue-400" : "text-gray-600 dark:text-slate-400"}`}>
          {isDragging ? "여기에 놓으세요!" : "파일을 드래그하거나 클릭하여 선택"}
        </p>
        <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">최대 {MAX_FILES}개 · 파일당 50MB</p>
      </div>

      {/* 파일 목록 */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((f) => (
            <div key={f.id} className="flex items-center gap-3 bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 px-3 py-2.5">
              <span className="text-xl shrink-0">{getFileIcon(f.file.type)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-900 dark:text-slate-100 truncate">{f.file.name}</p>
                <p className="text-[10px] text-gray-400 dark:text-slate-500">{formatFileSize(f.file.size)}</p>
                {/* 진행 바 */}
                {(f.status === "uploading" || f.status === "done") && (
                  <div className="mt-1.5 h-1.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-200 ${f.status === "done" ? "bg-green-500" : "bg-blue-500"}`}
                      style={{ width: `${f.progress}%` }}
                    />
                  </div>
                )}
                {f.status === "error" && (
                  <p className="text-[10px] text-red-500 mt-0.5">{f.error}</p>
                )}
              </div>
              {/* 상태 아이콘 */}
              <div className="shrink-0">
                {f.status === "done" && <CheckCircle size={16} className="text-green-500" />}
                {f.status === "error" && <AlertCircle size={16} className="text-red-500" />}
                {f.status === "uploading" && (
                  <div className="w-4 h-4 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                )}
                {f.status === "pending" && (
                  <button onClick={(e) => { e.stopPropagation(); removeFile(f.id); }} className="text-gray-400 hover:text-red-500 transition-colors">
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* 액션 버튼 */}
          <div className="flex gap-2">
            {hasPending && (
              <button
                onClick={uploadAll}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors"
              >
                업로드 시작 ({files.filter((f) => f.status === "pending").length}개)
              </button>
            )}
            {allDone && (
              <button
                onClick={clearDone}
                className="flex-1 py-2.5 text-sm font-medium text-gray-600 dark:text-slate-400 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-xl transition-colors"
              >
                목록 지우기
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
