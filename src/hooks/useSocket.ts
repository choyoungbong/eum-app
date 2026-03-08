"use client";
// src/hooks/useSocket.ts — 완전 재작성
// 핵심 수정:
// [FIX-1] socket을 useState로 관리 → 리렌더 보장 (ref 스냅샷 문제 해결)
// [FIX-2] socketRef로 항상 최신 socket 참조 (createPC 클로저 문제 해결)
// [FIX-3] chat:join을 chatRoomId가 있을 때만 emit
// [기존] remoteDescSetRef, ICE 버퍼링, call:ended 이벤트명 유지

import { useEffect, useRef, useState, useCallback } from "react";
import { io, type Socket } from "socket.io-client";
import { useSession } from "next-auth/react";
import { toast } from "@/components/Toast";

// ── 모듈 레벨 싱글톤 ──────────────────────────────────────
let _socket: Socket | null = null;
let _userId: string | null = null;

export function getOrCreateSocket(userId: string): Socket {
  if (_socket?.connected && _userId === userId) return _socket;

  if (_socket) {
    _socket.disconnect();
    _socket = null;
  }

  const socket = io(
    typeof window !== "undefined" ? window.location.origin : "",
    {
      path: "/api/socket/io",
      auth: { userId },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1500,
    }
  );

  _socket = socket;
  _userId = userId;
  return socket;
}

export function getSocket(): Socket | null {
  return _socket;
}

// ── ICE 서버 ──────────────────────────────────────────────
const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  {
    urls: "turn:openrelay.metered.ca:80",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
  {
    urls: "turn:openrelay.metered.ca:443",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
];

// ── 미디어 에러 메시지 ────────────────────────────────────
function getMediaErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError")
      return "마이크 또는 카메라를 찾을 수 없습니다. 장치를 연결하거나 권한을 확인해주세요.";
    if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError")
      return "마이크/카메라 권한이 거부되었습니다. 브라우저 설정에서 허용해주세요.";
    if (err.name === "NotReadableError" || err.name === "TrackStartError")
      return "마이크/카메라가 다른 앱에서 사용 중입니다. 앱을 닫고 다시 시도해주세요.";
  }
  return "미디어 장치에 접근할 수 없습니다. 장치와 권한을 확인해주세요.";
}

async function getMediaStreamSafe(
  callType: "VOICE" | "VIDEO"
): Promise<{ stream: MediaStream; actualType: "VOICE" | "VIDEO" }> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: callType === "VIDEO",
    });
    return { stream, actualType: callType };
  } catch (err) {
    // 영상통화인데 카메라 없으면 음성으로 fallback
    if (
      callType === "VIDEO" &&
      err instanceof Error &&
      (err.name === "NotFoundError" || err.name === "DevicesNotFoundError")
    ) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        toast.error?.("카메라를 찾을 수 없어 음성 통화로 전환합니다.");
        return { stream, actualType: "VOICE" };
      } catch (fallbackErr) {
        throw fallbackErr;
      }
    }
    throw err;
  }
}

// ── useSocket ─────────────────────────────────────────────
export function useSocket() {
  const { data: session } = useSession();

  // [FIX-1] socket을 state로 관리 → 변경 시 리렌더 보장
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!session?.user?.id) return;

    const s = getOrCreateSocket(session.user.id);

    const onConnect = () => {
      setIsConnected(true);
      setSocket(s); // [FIX-1] 연결 완료 시 state 세팅
    };
    const onDisconnect = () => setIsConnected(false);

    s.on("connect", onConnect);
    s.on("disconnect", onDisconnect);
    s.on("connect_error", (e) => console.error("❌ Socket error:", e.message));

    // 이미 연결돼 있으면 즉시 세팅
    if (s.connected) {
      setSocket(s);
      setIsConnected(true);
    }

    return () => {
      s.off("connect", onConnect);
      s.off("disconnect", onDisconnect);
    };
  }, [session?.user?.id]);

  return { socket, isConnected };
}

// ── useChatRoom ───────────────────────────────────────────
export function useChatRoom(chatRoomId: string | null) {
  const { socket, isConnected } = useSocket();

  // [FIX-2] socketRef: 항상 최신 socket을 가리킴 (클로저 캡처 문제 해결)
  const socketRef = useRef<Socket | null>(null);
  useEffect(() => { socketRef.current = socket; }, [socket]);

  const [socketMessages, setSocketMessages] = useState<any[]>([]);
  const [typingUsers, setTypingUsers]       = useState<Set<string>>(new Set());

  const [incomingCall,  setIncomingCall]  = useState<any | null>(null);
  const [localStream,   setLocalStream]   = useState<MediaStream | null>(null);
  const [remoteStream,  setRemoteStream]  = useState<MediaStream | null>(null);
  const [callStatus,    setCallStatus]    = useState<
    "idle" | "calling" | "incoming" | "connected" | "ended"
  >("idle");

  const pcRef             = useRef<RTCPeerConnection | null>(null);
  const localStreamRef    = useRef<MediaStream | null>(null);
  const remoteStreamRef   = useRef<MediaStream | null>(null);
  const iceBufRef         = useRef<RTCIceCandidateInit[]>([]);
  const remoteDescSetRef  = useRef(false);
  const callTargetRef     = useRef<string | null>(null);

  // ── createPC ────────────────────────────────────────────
  const createPC = useCallback((targetId: string): RTCPeerConnection => {
    pcRef.current?.close();

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    remoteStreamRef.current = null;

    pc.ontrack = (event) => {
      const incoming = event.streams?.[0];
      if (incoming) {
        remoteStreamRef.current = incoming;
      } else {
        if (!remoteStreamRef.current) remoteStreamRef.current = new MediaStream();
        remoteStreamRef.current.addTrack(event.track);
      }
      // 매번 새 참조로 setRemoteStream → React 재렌더 보장
      setRemoteStream(remoteStreamRef.current);
    };

    pc.onicecandidate = (e) => {
      // [FIX-2] socketRef로 항상 최신 socket 참조
      if (e.candidate && socketRef.current) {
        socketRef.current.emit("call:ice-candidate", {
          otherUserId: targetId,
          candidate: e.candidate.toJSON(),
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      if (state === "connected" || state === "completed") setCallStatus("connected");
      if (state === "failed") { try { pc.restartIce(); } catch {} }
    };

    pcRef.current = pc;
    return pc;
  }, []); // [FIX-2] 의존성에 socket 없음 — socketRef로 해결

  // ── flushIce ─────────────────────────────────────────────
  const flushIce = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc) return;
    for (const c of iceBufRef.current) {
      try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
    }
    iceBufRef.current = [];
  }, []);

  // ── cleanupCall ───────────────────────────────────────────
  const cleanupCall = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    remoteStreamRef.current = null;
    iceBufRef.current = [];
    remoteDescSetRef.current = false;
    callTargetRef.current = null;
  }, []);

  // ── initiateCall ──────────────────────────────────────────
  const initiateCall = useCallback(
    async (callType: "VOICE" | "VIDEO", otherUserId?: string) => {
      if (!socket || callStatus !== "idle" || !otherUserId) {
        console.warn("[Call] initiateCall 조건 미충족", { socket: !!socket, callStatus, otherUserId });
        return;
      }

      let stream: MediaStream;
      let actualCallType: "VOICE" | "VIDEO";
      try {
        const result = await getMediaStreamSafe(callType);
        stream = result.stream;
        actualCallType = result.actualType;
      } catch (err) {
        toast.error?.(getMediaErrorMessage(err));
        console.error("[Call] getUserMedia 실패:", err);
        return;
      }

      try {
        callTargetRef.current = otherUserId;
        setCallStatus("calling");
        localStreamRef.current = stream;
        setLocalStream(stream);

        const pc = createPC(otherUserId);
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        console.log("[Call] call:start →", otherUserId, actualCallType);
        socket.emit("call:start", {
          receiverId: otherUserId,
          chatRoomId,
          callType: actualCallType,
          offer: pc.localDescription,
        });
      } catch (err) {
        console.error("[Call] initiateCall 오류:", err);
        toast.error?.("통화 연결 중 오류가 발생했습니다.");
        cleanupCall();
        setCallStatus("idle");
      }
    },
    [socket, callStatus, chatRoomId, createPC, cleanupCall]
  );

  // ── acceptCall ────────────────────────────────────────────
  const acceptCall = useCallback(async () => {
    if (!incomingCall || !socket) return;

    const { callerId, offer, callType } = incomingCall;

    let stream: MediaStream;
    try {
      const result = await getMediaStreamSafe(callType);
      stream = result.stream;
    } catch (err) {
      toast.error?.(getMediaErrorMessage(err));
      console.error("[Call] acceptCall getUserMedia 실패:", err);
      socket.emit("call:reject", { callerId });
      setIncomingCall(null);
      setCallStatus("idle");
      return;
    }

    try {
      callTargetRef.current = callerId;
      localStreamRef.current = stream;
      setLocalStream(stream);

      const pc = createPC(callerId);
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      remoteDescSetRef.current = true;
      await flushIce();

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit("call:accept", { callerId, answer: pc.localDescription });
      setIncomingCall(null);
      setCallStatus("connected");
    } catch (err) {
      console.error("[Call] acceptCall 오류:", err);
      toast.error?.("통화 수락 중 오류가 발생했습니다.");
      cleanupCall();
      setCallStatus("idle");
    }
  }, [incomingCall, socket, createPC, flushIce, cleanupCall]);

  const rejectCall = useCallback(() => {
    if (!incomingCall || !socket) return;
    socket.emit("call:reject", { callerId: incomingCall.callerId });
    setIncomingCall(null);
    setCallStatus("idle");
  }, [incomingCall, socket]);

  const endCall = useCallback(() => {
    if (socketRef.current && callTargetRef.current) {
      socketRef.current.emit("call:end", { otherUserId: callTargetRef.current });
    }
    cleanupCall();
    setCallStatus("ended");
  }, [cleanupCall]);

  const toggleMute = useCallback((): boolean => {
    const t = localStreamRef.current?.getAudioTracks()[0];
    if (!t) return false;
    t.enabled = !t.enabled;
    return !t.enabled;
  }, []);

  const toggleCamera = useCallback((): boolean => {
    const t = localStreamRef.current?.getVideoTracks()[0];
    if (!t) return false;
    t.enabled = !t.enabled;
    return !t.enabled;
  }, []);

  // ── 채팅방 입장 / 메시지 / 타이핑 ───────────────────────
  useEffect(() => {
    if (!socket || !chatRoomId) return; // [FIX-3] chatRoomId 있을 때만

    socket.emit("chat:join", chatRoomId);

    const onMessage = (data: any) => {
      setSocketMessages((prev) =>
        prev.some((m) => m.id === data.id) ? prev : [...prev, data]
      );
    };
    const onTyping = ({ userId, isTyping }: { userId: string; isTyping: boolean }) => {
      setTypingUsers((prev) => {
        const next = new Set(prev);
        isTyping ? next.add(userId) : next.delete(userId);
        return next;
      });
    };

    socket.on("message:receive", onMessage);
    socket.on("typing:update", onTyping);

    return () => {
      socket.emit("chat:leave", chatRoomId);
      socket.off("message:receive", onMessage);
      socket.off("typing:update", onTyping);
    };
  }, [socket, chatRoomId]);

  // ── WebRTC 시그널링 이벤트 ────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const onIncoming = (data: any) => {
      console.log("[Call] call:incoming 수신", data);
      setIncomingCall(data);
      setCallStatus("incoming");
    };

    const onAccepted = async ({ answer }: { answer: RTCSessionDescriptionInit }) => {
      try {
        await pcRef.current?.setRemoteDescription(new RTCSessionDescription(answer));
        remoteDescSetRef.current = true;
        await flushIce();
        setCallStatus("connected");
      } catch (err) {
        console.error("[Call] call:accepted 처리 오류:", err);
      }
    };

    const onIceCandidate = async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
      if (!pcRef.current || !remoteDescSetRef.current) {
        iceBufRef.current.push(candidate);
        return;
      }
      try { await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
    };

    const onRejected = () => { cleanupCall(); setCallStatus("idle"); };
    const onEnded    = () => { cleanupCall(); setCallStatus("ended"); };
    const onOffline  = () => {
      toast.error?.("상대방이 오프라인 상태입니다.");
      cleanupCall();
      setCallStatus("idle");
    };

    socket.on("call:incoming",     onIncoming);
    socket.on("call:accepted",     onAccepted);
    socket.on("call:ice-candidate", onIceCandidate);
    socket.on("call:rejected",     onRejected);
    socket.on("call:ended",        onEnded);
    socket.on("call:user-offline", onOffline);

    return () => {
      socket.off("call:incoming",     onIncoming);
      socket.off("call:accepted",     onAccepted);
      socket.off("call:ice-candidate", onIceCandidate);
      socket.off("call:rejected",     onRejected);
      socket.off("call:ended",        onEnded);
      socket.off("call:user-offline", onOffline);
    };
  }, [socket, flushIce, cleanupCall]);

  return {
    socket,
    isConnected,
    socketMessages,
    typingUsers,
    incomingCall,
    localStream,
    remoteStream,
    callStatus,
    initiateCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleCamera,
  };
}