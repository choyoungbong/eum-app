// src/lib/socket-client.ts
// ✅ 개선판: 소켓 싱글톤을 hooks/useSocket.ts로 통합
// useUploadProgress 훅 포함 (UploadProgressOverlay.tsx에서 사용)

"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { getOrCreateSocket } from "@/hooks/useSocket";

// ── 전역 소켓 연결 훅 (providers에서 한 번만 사용) ─────────
export function useSocketConnection() {
  const { data: session, status } = useSession();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.id) return;
    const socket = getOrCreateSocket(session.user.id);

    const onConnect    = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    socket.on("connect",    onConnect);
    socket.on("disconnect", onDisconnect);
    if (socket.connected) setConnected(true);

    return () => {
      socket.off("connect",    onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, [status, session?.user?.id]);

  return connected;
}

// ── 실시간 알림 훅 ────────────────────────────────────────
export function useSocketNotifications(
  onNew: (n: { type: string; message: string; createdAt: string }) => void
) {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.id) return;
    const socket = getOrCreateSocket(session.user.id);
    socket.on("notification:new", onNew);
    return () => { socket.off("notification:new", onNew); };
  }, [onNew, status, session?.user?.id]);
}

// ── 채팅 타이핑 인디케이터 훅 ─────────────────────────────
interface TypingState {
  [userId: string]: boolean;
}

export function useTypingIndicator(roomId: string | null) {
  const { data: session } = useSession();
  const [typingUsers, setTypingUsers] = useState<TypingState>({});

  useEffect(() => {
    if (!roomId || !session?.user?.id) return;
    const socket = getOrCreateSocket(session.user.id);
    socket.emit("chat:join", roomId);

    const handler = ({ userId, isTyping }: { userId: string; isTyping: boolean }) => {
      setTypingUsers((prev) => ({ ...prev, [userId]: isTyping }));
    };

    socket.on("typing:update", handler);
    return () => {
      socket.emit("chat:leave", roomId);
      socket.off("typing:update", handler);
    };
  }, [roomId, session?.user?.id]);

  const startTyping = useCallback(() => {
    if (!roomId || !session?.user?.id) return;
    getOrCreateSocket(session.user.id).emit("typing:start", { chatRoomId: roomId });
  }, [roomId, session?.user?.id]);

  const stopTyping = useCallback(() => {
    if (!roomId || !session?.user?.id) return;
    getOrCreateSocket(session.user.id).emit("typing:stop", { chatRoomId: roomId });
  }, [roomId, session?.user?.id]);

  const typingUserIds = Object.entries(typingUsers)
    .filter(([, v]) => v)
    .map(([k]) => k);

  return { typingUserIds, startTyping, stopTyping };
}

// ── 업로드 진행률 훅 ──────────────────────────────────────
// UploadProgressOverlay.tsx에서 사용
interface UploadItem {
  fileId: string;
  filename: string;
  progress: number;
  done: boolean;
}

export function useUploadProgress() {
  const { data: session } = useSession();
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const timersRef = useRef<Record<string, NodeJS.Timeout>>({});

  useEffect(() => {
    if (!session?.user?.id) return;
    const socket = getOrCreateSocket(session.user.id);

    const onProgress = ({ fileId, progress, filename }: {
      fileId: string;
      progress: number;
      filename: string;
    }) => {
      setUploads((prev) => {
        const exists = prev.find((u) => u.fileId === fileId);
        if (exists) {
          return prev.map((u) =>
            u.fileId === fileId ? { ...u, progress: Math.round(progress), filename } : u
          );
        }
        return [...prev, { fileId, filename, progress: Math.round(progress), done: false }];
      });
    };

    const onDone = ({ fileId, filename }: { fileId: string; filename: string }) => {
      setUploads((prev) =>
        prev.map((u) => u.fileId === fileId ? { ...u, progress: 100, done: true } : u)
      );
      // 3초 후 자동 제거
      clearTimeout(timersRef.current[fileId]);
      timersRef.current[fileId] = setTimeout(() => {
        setUploads((prev) => prev.filter((u) => u.fileId !== fileId));
        delete timersRef.current[fileId];
      }, 3000);
    };

    socket.on("upload:progress:update", onProgress);
    socket.on("upload:done:update",     onDone);

    return () => {
      socket.off("upload:progress:update", onProgress);
      socket.off("upload:done:update",     onDone);
    };
  }, [session?.user?.id]);

  // 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      Object.values(timersRef.current).forEach(clearTimeout);
    };
  }, []);

  return { uploads };
}
