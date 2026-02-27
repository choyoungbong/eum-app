"use client";
// src/components/FileEncryptButton.tsx

import { useState } from "react";
import { Lock, LockOpen, Eye, EyeOff } from "lucide-react";
import { toast } from "@/components/Toast";

interface Props {
  fileId: string;
  isEncrypted: boolean;
  onStatusChange?: (encrypted: boolean) => void;
}

function PasswordModal({
  title, hint, onConfirm, onClose, loading,
}: {
  title: string; hint: string;
  onConfirm: (pw: string) => void;
  onClose: () => void; loading: boolean;
}) {
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-bold text-gray-900 dark:text-slate-100">{title}</h3>
        <p className="text-xs text-gray-500 dark:text-slate-400">{hint}</p>
        <div className="relative">
          <input
            autoFocus
            type={show ? "text" : "password"}
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && pw.length >= 4 && onConfirm(pw)}
            placeholder="비밀번호 입력"
            className="w-full pr-10 pl-4 py-2.5 text-sm border border-gray-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button onClick={() => setShow(!show)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
            {show ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onClose}
            className="flex-1 py-2.5 text-sm text-gray-600 dark:text-slate-400 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-xl transition">
            취소
          </button>
          <button onClick={() => onConfirm(pw)} disabled={pw.length < 4 || loading}
            className="flex-1 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition disabled:opacity-50">
            {loading ? "처리 중..." : "확인"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FileEncryptButton({ fileId, isEncrypted: initEncrypted, onStatusChange }: Props) {
  const [isEncrypted, setIsEncrypted] = useState(initEncrypted);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleConfirm = async (password: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/files/${fileId}/encrypt`, {
        method: isEncrypted ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const newState = !isEncrypted;
      setIsEncrypted(newState);
      onStatusChange?.(newState);
      toast.success(data.message);
      setShowModal(false);
    } catch (e: any) {
      toast.error(e.message || "오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {showModal && (
        <PasswordModal
          title={isEncrypted ? "파일 잠금 해제" : "파일 암호화"}
          hint={isEncrypted
            ? "설정했던 비밀번호를 입력해 암호화를 해제합니다."
            : "이 파일을 비밀번호로 보호합니다. 비밀번호를 잃어버리면 파일을 복구할 수 없습니다."}
          onConfirm={handleConfirm}
          onClose={() => setShowModal(false)}
          loading={loading}
        />
      )}
      <button
        onClick={() => setShowModal(true)}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
          isEncrypted
            ? "bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/30"
            : "bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-600"
        }`}
      >
        {isEncrypted ? <><Lock size={12} /> 잠김</> : <><LockOpen size={12} /> 암호화</>}
      </button>
    </>
  );
}
