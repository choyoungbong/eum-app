"use client";
// src/app/settings/api-keys/page.tsx

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ChevronLeft, Key, Plus, Trash2, Copy, Eye, EyeOff, AlertTriangle, RefreshCw } from "lucide-react";
import { toast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmDialog";

interface ApiKey {
  id: string; name: string; keyPrefix: string;
  scopes: string[]; lastUsedAt: string | null;
  expiresAt: string | null; createdAt: string;
}

const ALL_SCOPES = [
  { value: "read:files",   label: "파일 읽기" },
  { value: "write:files",  label: "파일 쓰기" },
  { value: "read:posts",   label: "게시글 읽기" },
  { value: "write:posts",  label: "게시글 쓰기" },
  { value: "read:profile", label: "프로필 읽기" },
];

const EXPIRY_OPTIONS = [
  { label: "만료 없음", value: 0 },
  { label: "30일",      value: 30 },
  { label: "90일",      value: 90 },
  { label: "1년",       value: 365 },
];

function timeAgo(d: string | null) {
  if (!d) return "사용된 적 없음";
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "방금 전";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return new Date(d).toLocaleDateString("ko-KR");
}

export default function ApiKeysPage() {
  const { confirmDialog, openConfirm } = useConfirm();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<{ rawKey: string; name: string } | null>(null);
  const [showRawKey, setShowRawKey] = useState(false);

  // 폼 상태
  const [form, setForm] = useState({ name: "", scopes: [] as string[], expiresInDays: 0 });
  const [showForm, setShowForm] = useState(false);

  const fetchKeys = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/users/me/api-keys");
      const data = await res.json();
      setKeys(data.keys ?? []);
    } catch { toast.error("API 키를 불러오지 못했습니다"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchKeys(); }, [fetchKeys]);

  const createKey = async () => {
    if (!form.name.trim()) { toast.error("키 이름을 입력해주세요"); return; }
    if (form.scopes.length === 0) { toast.error("권한을 하나 이상 선택해주세요"); return; }
    setCreating(true);
    try {
      const res = await fetch("/api/users/me/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setNewKey({ rawKey: data.rawKey, name: data.key.name });
      setKeys((k) => [data.key, ...k]);
      setShowForm(false);
      setForm({ name: "", scopes: [], expiresInDays: 0 });
    } catch (e: any) { toast.error(e.message); }
    finally { setCreating(false); }
  };

  const deleteKey = async (id: string, name: string) => {
    const ok = await openConfirm({
      title: "API 키 삭제", message: `"${name}" 키를 삭제하면 이 키로 연동된 서비스가 작동을 멈춥니다.`,
      confirmText: "삭제", confirmVariant: "danger",
    });
    if (!ok) return;
    await fetch(`/api/users/me/api-keys/${id}`, { method: "DELETE" });
    setKeys((k) => k.filter((x) => x.id !== id));
    toast.success("API 키가 삭제되었습니다");
  };

  const toggleScope = (scope: string) =>
    setForm((f) => ({
      ...f,
      scopes: f.scopes.includes(scope) ? f.scopes.filter((s) => s !== scope) : [...f.scopes, scope],
    }));

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      {confirmDialog}

      {/* 헤더 */}
      <div className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/profile" className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
            <ChevronLeft size={20} className="text-gray-600 dark:text-slate-400" />
          </Link>
          <Key size={20} className="text-gray-800 dark:text-slate-200" />
          <h1 className="text-lg font-semibold text-gray-900 dark:text-slate-100 flex-1">API 키 관리</h1>
          <button onClick={fetchKeys} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700"><RefreshCw size={16} className="text-gray-500 dark:text-slate-400" /></button>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition">
            <Plus size={14} /> 새 키
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        {/* 생성된 키 표시 */}
        {newKey && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-600 shrink-0" />
              <p className="text-sm font-bold text-amber-700 dark:text-amber-400">지금 복사하지 않으면 다시 볼 수 없습니다!</p>
            </div>
            <p className="text-xs text-gray-600 dark:text-slate-400">"{newKey.name}" API 키가 생성되었습니다.</p>
            <div className="flex items-center gap-2 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 px-3 py-2">
              <code className="flex-1 text-xs font-mono text-gray-800 dark:text-slate-200 break-all">
                {showRawKey ? newKey.rawKey : newKey.rawKey.slice(0, 16) + "•".repeat(20)}
              </code>
              <button onClick={() => setShowRawKey(!showRawKey)} className="text-gray-400 hover:text-gray-600 shrink-0">
                {showRawKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
              <button onClick={() => { navigator.clipboard.writeText(newKey.rawKey); toast.success("복사됨"); }}
                className="text-blue-600 hover:text-blue-700 shrink-0"><Copy size={14} /></button>
            </div>
            <button onClick={() => setNewKey(null)} className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-slate-300">
              확인했습니다 ×
            </button>
          </div>
        )}

        {/* 생성 폼 */}
        {showForm && (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-5 space-y-4">
            <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100">새 API 키 생성</h3>
            <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="키 이름 (예: 내 앱)"
              className="w-full px-4 py-2.5 text-sm border border-gray-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 mb-2">권한</p>
              <div className="grid grid-cols-2 gap-2">
                {ALL_SCOPES.map((s) => (
                  <label key={s.value} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.scopes.includes(s.value)} onChange={() => toggleScope(s.value)}
                      className="w-4 h-4 rounded accent-blue-600" />
                    <span className="text-xs text-gray-700 dark:text-slate-300">{s.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 mb-2">만료</p>
              <div className="flex gap-2 flex-wrap">
                {EXPIRY_OPTIONS.map((o) => (
                  <button key={o.value} onClick={() => setForm((f) => ({ ...f, expiresInDays: o.value }))}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                      form.expiresInDays === o.value
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-400 hover:bg-gray-200"
                    }`}>{o.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowForm(false)}
                className="flex-1 py-2.5 text-sm text-gray-600 dark:text-slate-400 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 rounded-xl transition">취소</button>
              <button onClick={createKey} disabled={creating}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition disabled:opacity-50">
                {creating ? "생성 중..." : "키 생성"}
              </button>
            </div>
          </div>
        )}

        {/* 키 목록 */}
        {loading ? (
          <div className="space-y-2">{[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-4 animate-pulse h-20" />
          ))}</div>
        ) : keys.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-center">
            <Key size={32} className="text-gray-300 dark:text-slate-600 mb-3" />
            <p className="text-gray-500 dark:text-slate-400 font-medium">API 키가 없습니다</p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">외부 서비스와 연동할 API 키를 만드세요</p>
          </div>
        ) : (
          <div className="space-y-2">
            {keys.map((k) => (
              <div key={k.id} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-4 flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                  <Key size={16} className="text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">{k.name}</p>
                  <code className="text-xs text-gray-400 dark:text-slate-500 font-mono">{k.keyPrefix}••••••••••••••••</code>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {k.scopes.map((s) => (
                      <span key={s} className="text-[9px] font-semibold bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 px-1.5 py-0.5 rounded">{s}</span>
                    ))}
                  </div>
                  <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-1">
                    마지막 사용: {timeAgo(k.lastUsedAt)}
                    {k.expiresAt && ` · 만료: ${new Date(k.expiresAt).toLocaleDateString("ko-KR")}`}
                  </p>
                </div>
                <button onClick={() => deleteKey(k.id, k.name)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
