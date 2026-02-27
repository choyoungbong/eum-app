// src/lib/socket-client.ts
// 클라이언트 사이드 소켓 싱글턴 + React 훅

import { useEffect, useRef, useState, useCallback } from "react";
import { io, type Socket } from "socket.io-client";
import { useSession } from "next-auth/react";

// ── 싱글턴 소켓 ──────────────────────────────────────────
let _socket: Socket | null = null;

export function getSocket(): Socket {
  if (!_socket) {
    _socket = io({ path: "/api/socket", transports: ["websocket", "polling"], autoConnect: false });
  }
  return _socket;
}

// ── 전역 소켓 연결 훅 (providers에서 한 번만 사용) ─────────
export function useSocketConnection() {
  const { data: session, status } = useSession();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") return;
    const socket = getSocket();

    if (!socket.connected) socket.connect();

    const onConnect    = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    socket.on("connect",    onConnect);
    socket.on("disconnect", onDisconnect);
    if (socket.connected) setConnected(true);

    return () => {
      socket.off("connect",    onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, [status]);

  return connected;
}

// ── 실시간 알림 훅 ────────────────────────────────────────
export function useSocketNotifications(
  onNew: (n: { type: string; message: string; createdAt: string }) => void
) {
  useEffect(() => {
    const socket = getSocket();
    socket.on("notification:new", onNew);
    return () => { socket.off("notification:new", onNew); };
  }, [onNew]);
}

// ── 채팅 타이핑 인디케이터 훅 ─────────────────────────────
interface TypingState {
  [userId: string]: boolean;
}
export function useTypingIndicator(roomId: string | null) {
  const [typingUsers, setTypingUsers] = useState<TypingState>({});
  const typingTimer = useRef<Record<string, NodeJS.Timeout>>({});

  useEffect(() => {
    if (!roomId) return;
    const socket = getSocket();
    socket.emit("chat:join", roomId);

    const handler = ({ userId, isTyping }: { userId: string; roomId: string; isTyping: boolean }) => {
      setTypingUsers((prev) => ({ ...prev, [userId]: isTyping }));
      // 5초 후 자동으로 타이핑 해제
      if (isTyping) {
        clearTimeout(typingTimer.current[userId]);
        typingTimer.current[userId] = setTimeout(() => {
          setTypingUsers((prev) => ({ ...prev, [userId]: false }));
        }, 5000);
      }
    };

    socket.on("chat:typing:update", handler);
    return () => {
      socket.emit("chat:leave", roomId);
      socket.off("chat:typing:update", handler);
    };
  }, [roomId]);

  const startTyping = useCallback(() => {
    if (!roomId) return;
    getSocket().emit("chat:typing:start", { roomId });
  }, [roomId]);

  const stopTyping = useCallback(() => {
    if (!roomId) return;
    getSocket().emit("chat:typing:stop", { roomId });
  }, [roomId]);

  const typingUserIds = Object.entries(typingUsers)
    .filter(([, v]) => v)
    .map(([k]) => k);

  return { typingUserIds, startTyping, stopTyping };
}

// ── 업로드 진행률 훅 ─────────────────────────────────────
interface UploadProgress {
  fileId: string;
  filename: string;
  progress: number;
}
export function useUploadProgress() {
  const [uploads, setUploads] = useState<Record<string, UploadProgress>>({});

  useEffect(() => {
    const socket = getSocket();
    const onProgress = ({ fileId, filename, progress }: UploadProgress) => {
      setUploads((prev) => ({ ...prev, [fileId]: { fileId, filename, progress } }));
    };
    const onDone = ({ fileId }: { fileId: string }) => {
      setUploads((prev) => {
        const next = { ...prev };
        delete next[fileId];
        return next;
      });
    };
    socket.on("upload:progress:update", onProgress);
    socket.on("upload:done:update",     onDone);
    return () => {
      socket.off("upload:progress:update", onProgress);
      socket.off("upload:done:update",     onDone);
    };
  }, []);

  const broadcastProgress = useCallback((fileId: string, filename: string, progress: number) => {
    getSocket().emit("upload:progress", { fileId, progress, filename });
    if (progress >= 100) getSocket().emit("upload:done", { fileId, filename });
  }, []);

  return { uploads: Object.values(uploads), broadcastProgress };
}

// ── 프레즌스 훅 ──────────────────────────────────────────
export function usePresence(userIds: string[]) {
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    const socket = getSocket();
    const handler = ({ userId, isOnline }: { userId: string; isOnline: boolean }) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        isOnline ? next.add(userId) : next.delete(userId);
        return next;
      });
    };
    socket.on("presence:update", handler);
    return () => { socket.off("presence:update", handler); };
  }, []);

  return { isOnline: (userId: string) => onlineUsers.has(userId) };
}
