"use client";

import { useEffect } from "react";

interface FilePreviewModalProps {
  file: {
    id: string;
    originalName: string;
    mimeType: string;
    size: string;
  } | null;
  onClose: () => void;
}

export default function FilePreviewModal({ file, onClose }: FilePreviewModalProps) {
  // ESC 키로 닫기
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  if (!file) return null;

  const isImage = file.mimeType.startsWith("image/");
  const isVideo = file.mimeType.startsWith("video/");
  const isPdf = file.mimeType.includes("pdf");

  const formatFileSize = (bytes: string) => {
    const size = parseInt(bytes);
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(2)} KB`;
    if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(2)} MB`;
    return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {file.originalName}
            </h3>
            <p className="text-sm text-gray-500">
              {formatFileSize(file.size)} • {file.mimeType}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {/* 미리보기 영역 */}
        <div className="p-4 flex items-center justify-center bg-gray-100 min-h-[400px] max-h-[60vh] overflow-auto">
          {isImage && (
            <img
              src={`/api/files/${file.id}/download`}
              alt={file.originalName}
              className="max-w-full max-h-full object-contain"
            />
          )}

          {isVideo && (
            <video
              controls
              className="max-w-full max-h-full"
              src={`/api/files/${file.id}/download`}
            >
              비디오를 재생할 수 없습니다.
            </video>
          )}

          {isPdf && (
            <iframe
              src={`/api/files/${file.id}/download`}
              className="w-full h-[60vh]"
              title={file.originalName}
            />
          )}

          {!isImage && !isVideo && !isPdf && (
            <div className="text-center text-gray-500">
              <p className="text-4xl mb-4">📄</p>
              <p>미리보기를 지원하지 않는 파일 형식입니다</p>
              <p className="text-sm mt-2">다운로드하여 확인하세요</p>
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-end gap-2 p-4 border-t bg-gray-50">
          <a
            href={`/api/files/${file.id}/download`}
            download={file.originalName}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
          >
            다운로드
          </a>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-md"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}