"use client";
// src/components/ProfileImageUpload.tsx
// 아바타 + 커버 이미지 업로드 컴포넌트

import { useState, useRef } from "react";
import { Camera, Upload, X } from "lucide-react";
import { toast } from "@/components/Toast";

type ImageType = "avatar" | "cover";

interface Props {
  currentAvatarUrl?: string | null;
  currentCoverUrl?:  string | null;
  userId: string;
  onUpdate?: (type: ImageType, url: string) => void;
  isOwnProfile?: boolean;
}

function ImageUploadButton({
  type, currentUrl, userId, onUpdate,
}: { type: ImageType; currentUrl?: string | null; userId: string; onUpdate?: (url: string) => void }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("이미지만 업로드 가능합니다"); return; }
    if (file.size > 5 * 1024 * 1024)    { toast.error("5MB 이하 이미지만 가능합니다"); return; }

    // 미리보기
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("type", type);

      const res  = await fetch("/api/users/me/avatar", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      onUpdate?.(data.publicUrl);
      toast.success(type === "avatar" ? "프로필 사진이 변경됐습니다" : "커버 이미지가 변경됐습니다");
    } catch (e: any) {
      toast.error(e.message ?? "업로드에 실패했습니다");
      setPreview(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <input ref={inputRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={loading}
        className={`group relative overflow-hidden ${
          type === "avatar"
            ? "w-24 h-24 rounded-full ring-4 ring-white dark:ring-slate-800"
            : "w-full h-36 rounded-2xl"
        } bg-gray-200 dark:bg-slate-700 transition-all hover:brightness-90`}
      >
        {/* 이미지 표시 */}
        {(preview ?? currentUrl) ? (
          <img
            src={preview ?? currentUrl!}
            alt={type}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {type === "avatar"
              ? <span className="text-4xl text-gray-400">👤</span>
              : <span className="text-gray-400 dark:text-slate-500 text-sm">커버 이미지 없음</span>}
          </div>
        )}

        {/* 호버 오버레이 */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 flex-col">
          <Camera size={type === "avatar" ? 20 : 24} className="text-white" />
          <span className="text-white text-xs font-medium">
            {loading ? "업로드 중..." : "변경"}
          </span>
        </div>

        {/* 로딩 스피너 */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        )}
      </button>
    </>
  );
}

export default function ProfileImageUpload({
  currentAvatarUrl, currentCoverUrl, userId, onUpdate, isOwnProfile = false,
}: Props) {
  const [avatarUrl, setAvatarUrl] = useState(currentAvatarUrl ?? null);
  const [coverUrl,  setCoverUrl]  = useState(currentCoverUrl  ?? null);

  if (!isOwnProfile) {
    // 읽기 전용 표시
    return (
      <div>
        <div className="relative">
          <div className="h-32 rounded-2xl overflow-hidden bg-gradient-to-br from-blue-500 to-purple-600">
            {coverUrl && <img src={coverUrl} alt="cover" className="w-full h-full object-cover" />}
          </div>
          <div className="absolute -bottom-10 left-6">
            <div className="w-20 h-20 rounded-full ring-4 ring-white dark:ring-slate-800 bg-gradient-to-br from-blue-400 to-purple-500 overflow-hidden flex items-center justify-center text-white text-2xl font-bold">
              {avatarUrl ? <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" /> : "👤"}
            </div>
          </div>
        </div>
        <div className="h-10" />
      </div>
    );
  }

  return (
    <div>
      {/* 커버 이미지 */}
      <ImageUploadButton
        type="cover"
        currentUrl={coverUrl}
        userId={userId}
        onUpdate={(url) => { setCoverUrl(url); onUpdate?.("cover", url); }}
      />

      {/* 아바타 (커버 위에 겹쳐서 표시) */}
      <div className="relative -mt-12 ml-6 inline-block">
        <ImageUploadButton
          type="avatar"
          currentUrl={avatarUrl}
          userId={userId}
          onUpdate={(url) => { setAvatarUrl(url); onUpdate?.("avatar", url); }}
        />
      </div>
      <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-2 ml-2">
        클릭하여 프로필 사진 또는 커버 이미지 변경 · 최대 5MB
      </p>
    </div>
  );
}
