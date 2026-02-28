"use client";
// src/hooks/useSocket.ts
// ✅ 완전히 재작성: useSocket (기본 소켓) + useChatRoom (채팅 + WebRTC)
// WebRTC 음성/영상 통화 지원

import { useEffect, useRef, useState, useCallback } from "react";
import { io, type Socket } from "socket.io-client";
import { useSession } from "next-auth/react";

// ══════════════════════════════════════════════════════════
// 싱글턴 소켓 (전역 1개만 유지)
// ══════════════════════════════════════════════════════════
let _globalSocket: Socket | null = null;
let _globalUserId: string | null = null;

function getOrCreateSocket(userId: string): Socket {
  if (_globalSocket && _globalUserId === userId && _globalSocket.connected) {
    return _globalSocket;
  }

  // 기존 소켓 정리
  if (_globalSocket) {
    _globalSocket.disconnect();
    _globalSocket = null;
  }

  const socketUrl =
    typeof window !== "undefined" ? window.location.origin : "";

  const socket = io(socketUrl, {
    path: "/api/socket/io",
    auth: { userId },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1500,
  });

  _globalSocket = socket;
  _globalUserId = userId;

  socket.on("connect", () =>
    console.log("✅ Socket connected:", socket.id)
  );
  socket.on("disconnect", (reason) =>
    console.log("❌ Socket disconnected:", reason)
  );
  socket.on("connect_error", (err) =>
    console.error("❌ Socket error:", err.message)
  );

  return socket;
}

// ══════════════════════════════════════════════════════════
// ICE 서버 설정 (STUN + 무료 TURN)
// ══════════════════════════════════════════════════════════
const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
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
  {
    urls: "turn:openrelay.metered.ca:443?transport=tcp",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
];

// ══════════════════════════════════════════════════════════
// useSocket — 기본 소켓 훅
// ══════════════════════════════════════════════════════════
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

// ══════════════════════════════════════════════════════════
// useChatRoom — 채팅방 소켓 + WebRTC 통화
// ══════════════════════════════════════════════════════════
export function useChatRoom(chatRoomId: string | null) {
  const { socket, isConnected } = useSocket();

  // ── 채팅 상태 ─────────────────────────────────────────
  const [socketMessages, setSocketMessages] = useState<any[]>([]);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());

  // ── WebRTC 상태 ───────────────────────────────────────
  const [incomingCall, setIncomingCall] = useState<{
    callId: string;
    callerId: string;
    chatRoomId: string;
    callType: "VOICE" | "VIDEO";
    offer: RTCSessionDescriptionInit;
  } | null>(null);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [callStatus, setCallStatus] = useState<
    "idle" | "calling" | "incoming" | "connected" | "ended"
  >("idle");

  // ── WebRTC refs ────────────────────────────────────────
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const iceCandidateBufferRef = useRef<RTCIceCandidateInit[]>([]);
  const remoteDescSetRef = useRef(false);
  const callTargetRef = useRef<string | null>(null);

  // ── 채팅방 입장 (재연결 시 자동 재입장) ───────────────
  useEffect(() => {
    if (!socket || !chatRoomId) return;

    const join = () => {
      socket.emit("chat:join", chatRoomId);
      console.log("📥 채팅방 입장:", chatRoomId);
    };

    if (socket.connected) join();
    socket.on("connect", join);

    return () => {
      socket.off("connect", join);
    };
  }, [socket, chatRoomId]);

  // ── 메시지 / 타이핑 이벤트 ───────────────────────────
  useEffect(() => {
    if (!socket) return;

    const handleMessage = (data: any) => {
      setSocketMessages((prev) =>
        prev.some((m) => m.id === data.id) ? prev : [...prev, data]
      );
    };

    const handleTyping = ({ userId, isTyping }: { userId: string; isTyping: boolean }) => {
      setTypingUsers((prev) => {
        const next = new Set(prev);
        isTyping ? next.add(userId) : next.delete(userId);
        return next;
      });
    };

    socket.on("message:receive", handleMessage);
    socket.on("message:new", handleMessage);
    socket.on("typing:update", handleTyping);
    socket.on("chat:typing:update", handleTyping);

    return () => {
      socket.off("message:receive", handleMessage);
      socket.off("message:new", handleMessage);
      socket.off("typing:update", handleTyping);
      socket.off("chat:typing:update", handleTyping);
    };
  }, [socket]);

  // ── 버퍼된 ICE candidate 적용 ─────────────────────────
  const flushIceCandidates = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc) return;

    console.log(`🧊 버퍼 ICE 적용: ${iceCandidateBufferRef.current.length}개`);
    for (const c of iceCandidateBufferRef.current) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(c));
      } catch (e) {
        console.error("버퍼 ICE 적용 실패:", e);
      }
    }
    iceCandidateBufferRef.current = [];
    remoteDescSetRef.current = true;
  }, []);

  // ── PeerConnection 생성 ────────────────────────────────
  const createPC = useCallback(
    (targetUserId: string): RTCPeerConnection => {
      if (pcRef.current) {
        pcRef.current.close();
      }
      iceCandidateBufferRef.current = [];
      remoteDescSetRef.current = false;

      const pc = new RTCPeerConnection({
        iceServers: ICE_SERVERS,
        iceCandidatePoolSize: 10,
      });

      // ICE candidate → 상대방에게 전달
      pc.onicecandidate = (e) => {
        if (e.candidate && socket) {
          socket.emit("call:ice-candidate", {
            otherUserId: targetUserId,
            candidate: e.candidate.toJSON(),
          });
        }
      };

      pc.oniceconnectionstatechange = () => {
        const s = pc.iceConnectionState;
        console.log("🔗 ICE state:", s);
        if (s === "connected" || s === "completed") {
          setCallStatus("connected");
        } else if (s === "failed") {
          console.warn("⚠️ ICE 연결 실패");
          cleanupCall();
          setCallStatus("idle");
        }
      };

      // ✅ 원격 트랙 수신 → remoteStream 설정 (음성 들리려면 여기가 핵심)
      pc.ontrack = (e) => {
        console.log("🎵 원격 트랙 수신:", e.track.kind);
        if (e.streams && e.streams[0]) {
          setRemoteStream(e.streams[0]);
        } else {
          // stream이 없는 경우 수동으로 구성
          const remoteMediaStream = new MediaStream();
          remoteMediaStream.addTrack(e.track);
          setRemoteStream(remoteMediaStream);
        }
      };

      pcRef.current = pc;
      return pc;
    },
    [socket] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // ── 정리 함수 ──────────────────────────────────────────
  const cleanupCall = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;

    pcRef.current?.close();
    pcRef.current = null;

    iceCandidateBufferRef.current = [];
    remoteDescSetRef.current = false;
    callTargetRef.current = null;

    setLocalStream(null);
    setRemoteStream(null);
    setIncomingCall(null);
  }, []);

  // ── WebRTC 소켓 이벤트 리스너 ─────────────────────────
  useEffect(() => {
    if (!socket) return;

    // 수신 전화
    const handleIncoming = (data: any) => {
      console.log("📞 수신 전화:", data);
      setIncomingCall(data);
      setCallStatus("incoming");
    };

    // 발신자: answer 수신 → remoteDescription 설정
    const handleAccepted = async ({ answer }: { answer: RTCSessionDescriptionInit }) => {
      console.log("✅ Answer 수신");
      const pc = pcRef.current;
      if (!pc) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        await flushIceCandidates();
        setCallStatus("connected");
      } catch (e) {
        console.error("Answer 설정 실패:", e);
        cleanupCall();
        setCallStatus("idle");
      }
    };

    // 거절
    const handleRejected = () => {
      console.log("❌ 통화 거절됨");
      setCallStatus("idle");
      cleanupCall();
    };

    // 종료
    const handleEnded = () => {
      console.log("📴 통화 종료됨");
      setCallStatus("ended");
      cleanupCall();
      setTimeout(() => setCallStatus("idle"), 2000);
    };

    // 상대방 오프라인
    const handleUserOffline = () => {
      console.log("⚠️ 상대방 오프라인");
      setCallStatus("idle");
      cleanupCall();
    };

    // ICE candidate 수신
    const handleIceCandidate = async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
      if (!candidate) return;
      const pc = pcRef.current;
      if (!pc) return;

      if (remoteDescSetRef.current) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error("ICE candidate 적용 실패:", e);
        }
      } else {
        iceCandidateBufferRef.current.push(candidate);
      }
    };

    socket.on("call:incoming", handleIncoming);
    socket.on("call:accepted", handleAccepted);
    socket.on("call:rejected", handleRejected);
    socket.on("call:ended", handleEnded);
    socket.on("call:user-offline", handleUserOffline);
    socket.on("call:ice-candidate", handleIceCandidate);

    return () => {
      socket.off("call:incoming", handleIncoming);
      socket.off("call:accepted", handleAccepted);
      socket.off("call:rejected", handleRejected);
      socket.off("call:ended", handleEnded);
      socket.off("call:user-offline", handleUserOffline);
      socket.off("call:ice-candidate", handleIceCandidate);
    };
  }, [socket, flushIceCandidates, cleanupCall]);

  // ── 통화 걸기 ──────────────────────────────────────────
  const initiateCall = useCallback(
    async (callType: "VOICE" | "VIDEO", otherUserId: string) => {
      if (!socket || callStatus !== "idle") return;

      try {
        setCallStatus("calling");
        callTargetRef.current = otherUserId;

        // 미디어 획득
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: callType === "VIDEO",
        });
        localStreamRef.current = stream;
        setLocalStream(stream);

        const pc = createPC(otherUserId);
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));

        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: callType === "VIDEO",
        });
        await pc.setLocalDescription(offer);

        console.log("📤 call:start 전송:", callType, "→", otherUserId);
        socket.emit("call:start", {
          receiverId: otherUserId,
          chatRoomId,
          callType,
          offer: pc.localDescription,
        });
      } catch (error) {
        console.error("통화 시작 실패:", error);
        alert(
          "카메라/마이크에 접근할 수 없습니다.\n브라우저 권한 설정을 확인해주세요."
        );
        setCallStatus("idle");
        cleanupCall();
      }
    },
    [socket, callStatus, chatRoomId, createPC, cleanupCall]
  );

  // ── 통화 수락 ──────────────────────────────────────────
  const acceptCall = useCallback(async () => {
    if (!incomingCall || !socket) return;

    try {
      setCallStatus("connected");
      callTargetRef.current = incomingCall.callerId;

      // 미디어 획득
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: incomingCall.callType === "VIDEO",
      });
      localStreamRef.current = stream;
      setLocalStream(stream);

      const pc = createPC(incomingCall.callerId);
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));

      // offer 설정
      await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));
      await flushIceCandidates();

      // answer 생성 & 전송
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      console.log("📤 call:accept 전송");
      socket.emit("call:accept", {
        callerId: incomingCall.callerId,
        answer: pc.localDescription,
      });

      setIncomingCall(null);
    } catch (error) {
      console.error("통화 수락 실패:", error);
      alert(
        "카메라/마이크에 접근할 수 없습니다.\n브라우저 권한 설정을 확인해주세요."
      );
      setCallStatus("idle");
      cleanupCall();
    }
  }, [incomingCall, socket, createPC, flushIceCandidates, cleanupCall]);

  // ── 통화 거절 ──────────────────────────────────────────
  const rejectCall = useCallback(() => {
    if (!incomingCall || !socket) return;
    socket.emit("call:reject", { callerId: incomingCall.callerId });
    setIncomingCall(null);
    setCallStatus("idle");
  }, [incomingCall, socket]);

  // ── 통화 종료 ──────────────────────────────────────────
  const endCall = useCallback(
    (otherUserId?: string) => {
      const targetId = otherUserId || callTargetRef.current;
      if (targetId && socket) {
        socket.emit("call:end", { otherUserId: targetId });
      }
      setCallStatus("idle");
      cleanupCall();
    },
    [socket, cleanupCall]
  );

  // ── 음소거 토글 ────────────────────────────────────────
  const toggleMute = useCallback((): boolean => {
    const stream = localStreamRef.current;
    if (!stream) return false;
    const track = stream.getAudioTracks()[0];
    if (!track) return false;
    track.enabled = !track.enabled;
    return !track.enabled; // true = 음소거 상태
  }, []);

  // ── 카메라 토글 ────────────────────────────────────────
  const toggleCamera = useCallback((): boolean => {
    const stream = localStreamRef.current;
    if (!stream) return false;
    const track = stream.getVideoTracks()[0];
    if (!track) return false;
    track.enabled = !track.enabled;
    return !track.enabled; // true = 카메라 꺼진 상태
  }, []);

  return {
    // 채팅
    socketMessages,
    typingUsers,
    socket,
    isConnected,
    // 통화 상태
    incomingCall,
    localStream,
    remoteStream,
    callStatus,
    // 통화 액션
    initiateCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleCamera,
  };
}
