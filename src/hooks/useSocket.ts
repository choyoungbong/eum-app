"use client";
// src/hooks/useSocket.ts
// ✅ 수정판:
// [BUG-1] remoteDescSetRef.current를 setRemoteDescription 직후 true로 세팅
// [BUG-2] createPC에서 빈 MediaStream 선점 제거 → ontrack에서 setRemoteStream 직접 호출
// [BUG-3] socket.on("call:end") → socket.on("call:ended") 로 서버 이벤트명과 일치
// [BUG-4] ontrack에서 event.streams[0] undefined 방어 코드 추가

import { useEffect, useRef, useState, useCallback } from "react";
import { io, type Socket } from "socket.io-client";
import { useSession } from "next-auth/react";

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

      // ✅ [BUG-2 수정] createPC에서 빈 stream 선점하지 않음
      // ontrack에서 실제 트랙이 도착할 때 setRemoteStream 호출
      remoteStreamRef.current = null;

      pc.ontrack = (event) => {
        // ✅ [BUG-4 수정] event.streams[0] undefined 방어
        const incomingStream = event.streams?.[0];

        if (incomingStream) {
          // streams[0]가 있으면 그대로 사용
          remoteStreamRef.current = incomingStream;
        } else {
          // streams 없이 track만 오는 경우 (Safari 등)
          if (!remoteStreamRef.current) {
            remoteStreamRef.current = new MediaStream();
          }
          remoteStreamRef.current.addTrack(event.track);
        }

        // ✅ [BUG-2 수정] 트랙 도착할 때마다 setRemoteStream 호출 → React 재렌더
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
      try {
        await pc.addIceCandidate(new RTCIceCandidate(c));
      } catch {}
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

      try {
        callTargetRef.current = otherUserId;
        setCallStatus("calling");

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: callType === "VIDEO",
        });

        localStreamRef.current = stream;
        setLocalStream(stream);

        const pc = createPC(otherUserId);
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        socket.emit("call:start", {
          receiverId: otherUserId,
          chatRoomId,
          callType,
          offer: pc.localDescription,
        });
      } catch (err) {
        console.error(err);
        cleanupCall();
        setCallStatus("idle");
      }
    },
    [socket, callStatus, chatRoomId, createPC, cleanupCall]
  );

  const acceptCall = useCallback(async () => {
    if (!incomingCall || !socket) return;

    try {
      const { callerId, offer, callType } = incomingCall;
      callTargetRef.current = callerId;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === "VIDEO",
      });

      localStreamRef.current = stream;
      setLocalStream(stream);

      const pc = createPC(callerId);
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));

      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      // ✅ [BUG-1 수정] setRemoteDescription 직후 true로 세팅
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
      console.error(err);
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
        // ✅ [BUG-1 수정] setRemoteDescription 직후 true로 세팅
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

    // ✅ [BUG-3 수정] "call:end" → "call:ended" (서버가 emitToUser로 보내는 이벤트명)
    socket.on("call:ended", () => {
      cleanupCall();
      setCallStatus("ended");
    });

    return () => {
      socket.off("call:incoming");
      socket.off("call:accepted");
      socket.off("call:ice-candidate");
      socket.off("call:rejected");
      socket.off("call:ended");
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