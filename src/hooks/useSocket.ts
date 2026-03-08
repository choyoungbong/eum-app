"use client";
// src/hooks/useSocket.ts
// ✅ v2 수정판:
// [FIX-1] getUserMedia NotFoundError → toast 에러 + 조용히 실패하지 않음
// [FIX-2] 디바이스 없을 때 fallback: 음성통화는 audio만, 영상은 audio만으로 재시도
// [FIX-3] 에러 종류별 한국어 메시지 (NotFoundError / NotAllowedError / 기타)
// [기존 BUG-1~4 수정 모두 유지]

import { useEffect, useRef, useState, useCallback } from "react";
import { io, type Socket } from "socket.io-client";
import { useSession } from "next-auth/react";
import { toast } from "@/components/Toast";

let _socket: Socket | null = null;
let _userId: string | null = null;

export function getOrCreateSocket(userId: string): Socket {
  if (_socket && _userId === userId) return _socket;

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

  socket.on("connect", () => console.log("✅ Socket connected:", socket.id));
  socket.on("disconnect", (r) => console.log("❌ Socket disconnected:", r));
  socket.on("connect_error", (e) => console.error("❌ Socket error:", e.message));

  return socket;
}

export function getSocket(): Socket | null {
  return _socket;
}

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

// ✅ [FIX-1] getUserMedia 에러 → 한국어 메시지 변환
function getMediaErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
      return "마이크 또는 카메라를 찾을 수 없습니다. 장치를 연결하거나 권한을 확인해주세요.";
    }
    if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
      return "마이크/카메라 권한이 거부되었습니다. 브라우저 설정에서 허용해주세요.";
    }
    if (err.name === "NotReadableError" || err.name === "TrackStartError") {
      return "마이크/카메라가 다른 앱에서 사용 중입니다. 앱을 닫고 다시 시도해주세요.";
    }
    if (err.name === "OverconstrainedError") {
      return "요청한 미디어 설정을 지원하지 않는 장치입니다.";
    }
    if (err.name === "SecurityError") {
      return "보안 오류: HTTPS 환경에서만 통화 기능을 사용할 수 있습니다.";
    }
  }
  return "미디어 장치에 접근할 수 없습니다. 장치와 권한을 확인해주세요.";
}

// ✅ [FIX-2] getUserMedia with fallback
// 영상통화 시 카메라 없으면 audio만으로 재시도
async function getMediaStreamSafe(
  callType: "VOICE" | "VIDEO"
): Promise<{ stream: MediaStream; actualType: "VOICE" | "VIDEO" }> {
  // 1차 시도: 요청한 그대로
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: callType === "VIDEO",
    });
    return { stream, actualType: callType };
  } catch (err) {
    // 영상통화인데 카메라 없는 경우 → audio만으로 재시도
    if (
      callType === "VIDEO" &&
      err instanceof Error &&
      (err.name === "NotFoundError" || err.name === "DevicesNotFoundError")
    ) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });
        toast.error?.("카메라를 찾을 수 없어 음성 통화로 전환합니다.");
        return { stream, actualType: "VOICE" };
      } catch (fallbackErr) {
        throw fallbackErr; // 오디오도 실패하면 포기
      }
    }
    throw err;
  }
}

export function useSocket() {
  const { data: session } = useSession();
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!session?.user?.id) return;

    const socket = getOrCreateSocket(session.user.id);
    socketRef.current = socket;
    setIsConnected(socket.connected);

    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, [session?.user?.id]);

  return { socket: socketRef.current, isConnected };
}

export function useChatRoom(chatRoomId: string | null) {
  const { socket, isConnected } = useSocket();

  const [socketMessages, setSocketMessages] = useState<any[]>([]);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());

  const [incomingCall, setIncomingCall] = useState<any | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const [callStatus, setCallStatus] = useState<
    "idle" | "calling" | "incoming" | "connected" | "ended"
  >("idle");

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);

  const iceBufRef = useRef<RTCIceCandidateInit[]>([]);
  const remoteDescSetRef = useRef(false);
  const callTargetRef = useRef<string | null>(null);

  const createPC = useCallback(
    (targetId: string): RTCPeerConnection => {
      pcRef.current?.close();

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

      // [BUG-2 수정 유지] createPC에서 빈 stream 선점하지 않음
      remoteStreamRef.current = null;

      pc.ontrack = (event) => {
        // [BUG-4 수정 유지] event.streams[0] undefined 방어
        const incomingStream = event.streams?.[0];

        if (incomingStream) {
          remoteStreamRef.current = incomingStream;
        } else {
          if (!remoteStreamRef.current) {
            remoteStreamRef.current = new MediaStream();
          }
          remoteStreamRef.current.addTrack(event.track);
        }

        // [BUG-2 수정 유지] 트랙 도착 시 setRemoteStream → React 재렌더
        setRemoteStream(remoteStreamRef.current);
      };

      pc.onicecandidate = (e) => {
        if (e.candidate && socket) {
          socket.emit("call:ice-candidate", {
            otherUserId: targetId,
            candidate: e.candidate.toJSON(),
          });
        }
      };

      pc.oniceconnectionstatechange = () => {
        const state = pc.iceConnectionState;
        if (state === "connected" || state === "completed") {
          setCallStatus("connected");
        }
        if (state === "failed") {
          try { pc.restartIce(); } catch {}
        }
      };

      pcRef.current = pc;
      return pc;
    },
    [socket]
  );

  const flushIce = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc) return;
    for (const c of iceBufRef.current) {
      try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
    }
    iceBufRef.current = [];
  }, []);

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

  const initiateCall = useCallback(
    async (callType: "VOICE" | "VIDEO", otherUserId?: string) => {
      if (!socket || callStatus !== "idle" || !otherUserId) return;

      // ✅ [FIX-1] 먼저 디바이스 확인 — 실패해도 callStatus 변경 없이 조기 반환
      let stream: MediaStream;
      let actualCallType: "VOICE" | "VIDEO";

      try {
        const result = await getMediaStreamSafe(callType);
        stream = result.stream;
        actualCallType = result.actualType;
      } catch (err) {
        // ✅ [FIX-1] 에러 메시지를 사용자에게 표시
        toast.error?.(getMediaErrorMessage(err));
        console.error("[WebRTC] getUserMedia 실패:", err);
        return; // callStatus는 "idle" 그대로 유지
      }

      // 여기서부터는 stream 확보된 상태
      try {
        callTargetRef.current = otherUserId;
        setCallStatus("calling");

        localStreamRef.current = stream;
        setLocalStream(stream);

        const pc = createPC(otherUserId);
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        socket.emit("call:start", {
          receiverId: otherUserId,
          chatRoomId,
          callType: actualCallType,
          offer: pc.localDescription,
        });
      } catch (err) {
        console.error("[WebRTC] initiateCall 오류:", err);
        toast.error?.("통화 연결 중 오류가 발생했습니다.");
        cleanupCall();
        setCallStatus("idle");
      }
    },
    [socket, callStatus, chatRoomId, createPC, cleanupCall]
  );

  const acceptCall = useCallback(async () => {
    if (!incomingCall || !socket) return;

    const { callerId, offer, callType } = incomingCall;

    // ✅ [FIX-1] acceptCall도 동일하게 처리
    let stream: MediaStream;
    try {
      const result = await getMediaStreamSafe(callType);
      stream = result.stream;
    } catch (err) {
      toast.error?.(getMediaErrorMessage(err));
      console.error("[WebRTC] acceptCall getUserMedia 실패:", err);
      // 수신 거절 처리
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

      // [BUG-1 수정 유지]
      remoteDescSetRef.current = true;
      await flushIce();

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit("call:accept", {
        callerId,
        answer: pc.localDescription,
      });

      setIncomingCall(null);
      setCallStatus("connected");
    } catch (err) {
      console.error("[WebRTC] acceptCall 오류:", err);
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
    if (socket && callTargetRef.current) {
      socket.emit("call:end", { otherUserId: callTargetRef.current });
    }
    cleanupCall();
    setCallStatus("ended");
  }, [socket, cleanupCall]);

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

  // ── 채팅 메시지 / 타이핑 소켓 이벤트 ─────────────────
  useEffect(() => {
    if (!socket || !chatRoomId) return;

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

  // ── WebRTC 시그널링 소켓 이벤트 ───────────────────────
  useEffect(() => {
    if (!socket) return;

    socket.on("call:incoming", (data) => {
      setIncomingCall(data);
      setCallStatus("incoming");
    });

    socket.on("call:accepted", async ({ answer }) => {
      try {
        await pcRef.current?.setRemoteDescription(
          new RTCSessionDescription(answer)
        );
        // [BUG-1 수정 유지]
        remoteDescSetRef.current = true;
        await flushIce();
        setCallStatus("connected");
      } catch {}
    });

    socket.on("call:ice-candidate", async ({ candidate }) => {
      if (!pcRef.current || !remoteDescSetRef.current) {
        iceBufRef.current.push(candidate);
        return;
      }
      try {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {}
    });

    socket.on("call:rejected", () => {
      cleanupCall();
      setCallStatus("idle");
    });

    // [BUG-3 수정 유지] "call:ended"
    socket.on("call:ended", () => {
      cleanupCall();
      setCallStatus("ended");
    });

    socket.on("call:user-offline", () => {
      toast.error?.("상대방이 오프라인 상태입니다.");
      cleanupCall();
      setCallStatus("idle");
    });

    return () => {
      socket.off("call:incoming");
      socket.off("call:accepted");
      socket.off("call:ice-candidate");
      socket.off("call:rejected");
      socket.off("call:ended");
      socket.off("call:user-offline");
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