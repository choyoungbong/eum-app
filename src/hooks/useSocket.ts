"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { useSession } from "next-auth/react";
import { toast } from "@/components/Toast";

// ─────────────────────────────────────
// 싱글턴 소켓 (전역 1개만 유지)
// ─────────────────────────────────────
let globalSocket: Socket | null = null;
let globalUserId: string | null = null;

// ─────────────────────────────────────
// ICE 서버 설정
// ─────────────────────────────────────
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

// ─────────────────────────────────────
// useSocket — 싱글턴 소켓 연결
// ─────────────────────────────────────
export function useSocket() {
  const { data: session } = useSession();
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!session?.user?.id) return;

    // 이미 같은 유저의 소켓이 있으면 재사용
    if (globalSocket && globalUserId === session.user.id) {
      socketRef.current = globalSocket;
      setIsConnected(globalSocket.connected);
      return;
    }

    // 기존 소켓 정리
    if (globalSocket) {
      globalSocket.disconnect();
    }

    const socketUrl =
      typeof window !== "undefined"
        ? window.location.origin
        : "https://eum-app-production.up.railway.app";

    const socket = io(socketUrl, {
      auth: { userId: session.user.id },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    globalSocket = socket;
    globalUserId = session.user.id;
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("✅ 소켓 연결:", socket.id);
      setIsConnected(true);
    });

    socket.on("disconnect", (reason) => {
      console.log("❌ 소켓 해제:", reason);
      setIsConnected(false);
    });

    socket.on("connect_error", (err) => {
      console.error("❌ 소켓 연결 에러:", err.message);
      setIsConnected(false);
    });

    return () => {
      // 컴포넌트 언마운트 시 소켓은 유지 (싱글턴)
    };
  }, [session?.user?.id]);

  return { socket: socketRef.current, isConnected };
}

// ─────────────────────────────────────
// useChatRoom — 채팅 + WebRTC
// ─────────────────────────────────────
export function useChatRoom(chatRoomId: string | null) {
  const { socket, isConnected } = useSocket();

  const [socketMessages, setSocketMessages] = useState<any[]>([]);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());

  // WebRTC 상태
  const [incomingCall, setIncomingCall] = useState<any>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [callStatus, setCallStatus] = useState<
    "idle" | "calling" | "incoming" | "connected" | "ended"
  >("idle");

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  // ✅ ICE Candidate 버퍼 — setRemoteDescription 전에 도착한 candidate 저장
  const iceCandidateBufferRef = useRef<RTCIceCandidateInit[]>([]);
  const remoteDescSetRef = useRef(false);
  const currentCallTargetRef = useRef<string | null>(null);

  // ─── 채팅방 입장 (재연결 시에도 자동 재입장) ─────────────
  useEffect(() => {
    if (!socket || !chatRoomId) return;

    const joinRoom = () => {
      socket.emit("chat:join", chatRoomId);
      console.log("📥 채팅방 입장:", chatRoomId);
    };

    if (socket.connected) joinRoom();

    // ✅ 핵심: 소켓 재연결 시 자동으로 채팅방 재입장
    socket.on("connect", joinRoom);

    return () => {
      socket.off("connect", joinRoom);
    };
  }, [socket, chatRoomId]);

  // ─── 메시지 & 타이핑 이벤트 ────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const handleMessage = (data: any) => {
      setSocketMessages((prev) =>
        prev.some((m) => m.id === data.id) ? prev : [...prev, data]
      );
    };

    const handleTyping = ({ userId, isTyping }: any) => {
      setTypingUsers((prev) => {
        const next = new Set(prev);
        if (isTyping) next.add(userId);
        else next.delete(userId);
        return next;
      });
    };

    // ✅ API route의 "message:new" + server.js의 "message:receive" 둘 다 수신
    socket.on("message:receive", handleMessage);
    socket.on("message:new", handleMessage);
    socket.on("typing:update", handleTyping);

    return () => {
      socket.off("message:receive", handleMessage);
      socket.off("message:new", handleMessage);
      socket.off("typing:update", handleTyping);
    };
  }, [socket]);

  // ─── WebRTC 이벤트 리스너 ──────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const handleIncoming = (data: any) => {
      console.log("📞 통화 요청 수신:", data);
      setIncomingCall(data);
      setCallStatus("incoming");
    };

    const handleAccepted = async ({ answer }: any) => {
      console.log("✅ Answer 수신, RemoteDescription 설정 중...");
      const pc = peerConnectionRef.current;
      if (!pc) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        // ✅ Answer 설정 완료 후 버퍼된 ICE candidates 적용
        await flushIceCandidates();
        setCallStatus("connected");
      } catch (e) {
        console.error("Answer 설정 실패:", e);
      }
    };

    const handleRejected = () => {
      toast.info("상대방이 통화를 거절했습니다");
      setCallStatus("idle");
      cleanupCall();
    };

    // ✅ 수신: 상대방 오프라인
    const handleUserOffline = () => {
      toast.error("상대방이 오프라인 상태입니다");
      setCallStatus("idle");
      cleanupCall();
    };

    const handleEnded = () => {
      console.log("📴 통화 종료됨");
      setCallStatus("ended");
      cleanupCall();
      setTimeout(() => setCallStatus("idle"), 1500);
    };

    // ✅ 핵심: remoteDescription 설정 여부에 따라 버퍼 또는 즉시 적용
    const handleIceCandidate = async ({ candidate }: any) => {
      if (!candidate) return;
      const pc = peerConnectionRef.current;
      if (!pc) return;

      if (remoteDescSetRef.current) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
          console.log("🧊 ICE Candidate 즉시 적용:", candidate.type);
        } catch (e) {
          console.error("ICE Candidate 적용 실패:", e);
        }
      } else {
        console.log("📦 ICE Candidate 버퍼링:", candidate.type);
        iceCandidateBufferRef.current.push(candidate);
      }
    };

    socket.on("call:incoming", handleIncoming);
    socket.on("call:accepted", handleAccepted);
    socket.on("call:rejected", handleRejected);
    socket.on("call:ended", handleEnded);
    socket.on("call:ice-candidate", handleIceCandidate);
    socket.on("call:user-offline", handleUserOffline);

    return () => {
      socket.off("call:incoming", handleIncoming);
      socket.off("call:accepted", handleAccepted);
      socket.off("call:rejected", handleRejected);
      socket.off("call:ended", handleEnded);
      socket.off("call:ice-candidate", handleIceCandidate);
      socket.off("call:user-offline", handleUserOffline);
    };
  }, [socket]);

  // ─── 버퍼된 ICE Candidates 일괄 적용 ──────────────────────
  const flushIceCandidates = useCallback(async () => {
    const pc = peerConnectionRef.current;
    if (!pc) return;
    console.log(`🧊 버퍼 ICE 적용: ${iceCandidateBufferRef.current.length}개`);
    for (const candidate of iceCandidateBufferRef.current) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.error("버퍼 ICE 적용 실패:", e);
      }
    }
    iceCandidateBufferRef.current = [];
    remoteDescSetRef.current = true;
  }, []);

  // ─── PeerConnection 생성 ───────────────────────────────────
  const createPeerConnection = useCallback(
    (targetUserId: string) => {
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
      iceCandidateBufferRef.current = [];
      remoteDescSetRef.current = false;

      const pc = new RTCPeerConnection({
        iceServers: ICE_SERVERS,
        iceCandidatePoolSize: 10,
      });

      // ✅ ICE Candidate 생성 → 상대방에게 전달
      pc.onicecandidate = (event) => {
        if (event.candidate && socket) {
          console.log("📡 ICE Candidate 전송:", event.candidate.type);
          socket.emit("call:ice-candidate", {
            otherUserId: targetUserId,
            candidate: event.candidate.toJSON(),
          });
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log("🔗 ICE 상태:", pc.iceConnectionState);
        if (
          pc.iceConnectionState === "connected" ||
          pc.iceConnectionState === "completed"
        ) {
          setCallStatus("connected");
        } else if (
          pc.iceConnectionState === "failed" ||
          pc.iceConnectionState === "disconnected"
        ) {
          console.warn("⚠️ ICE 연결 실패 — TURN 서버 확인 필요");
          cleanupCall();
          setCallStatus("idle");
        }
      };

      pc.ontrack = (event) => {
        console.log("🎵 원격 트랙 수신:", event.track.kind);
        setRemoteStream(event.streams[0]);
      };

      peerConnectionRef.current = pc;
      return pc;
    },
    [socket]
  );

  // ─── 정리 함수 ─────────────────────────────────────────────
  const cleanupCall = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    iceCandidateBufferRef.current = [];
    remoteDescSetRef.current = false;
    currentCallTargetRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setIncomingCall(null);
  }, []);

  // ─── 통화 걸기 ─────────────────────────────────────────────
  // ✅ 버그 수정: callType을 첫 번째 인자로 받음 (기존: otherUserId만 받아서 "VOICE"가 receiverId로 전송되던 버그)
  const initiateCall = useCallback(
    async (callType: "VOICE" | "VIDEO", otherUserId: string) => {
      if (!socket || callStatus !== "idle") return;

      try {
        setCallStatus("calling");
        currentCallTargetRef.current = otherUserId;

        // ✅ 음성통화면 카메라 요청 안 함 (기존: 항상 video:true)
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: callType === "VIDEO",
        });

        localStreamRef.current = stream;
        setLocalStream(stream);

        const pc = createPeerConnection(otherUserId);
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: callType === "VIDEO",
        });
        await pc.setLocalDescription(offer);

        console.log("📤 Offer 전송:", callType, "→", otherUserId);
        socket.emit("call:start", {
          receiverId: otherUserId,
          chatRoomId,
          callType,
          offer: pc.localDescription,
        });
      } catch (error) {
        console.error("통화 시작 실패:", error);
        setCallStatus("idle");
        cleanupCall();
      }
    },
    [socket, callStatus, chatRoomId, createPeerConnection, cleanupCall]
  );

  // ─── 통화 수락 ─────────────────────────────────────────────
  const acceptCall = useCallback(async () => {
    if (!incomingCall || !socket) return;

    try {
      setCallStatus("connected");
      currentCallTargetRef.current = incomingCall.callerId;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: incomingCall.callType === "VIDEO",
      });

      localStreamRef.current = stream;
      setLocalStream(stream);

      const pc = createPeerConnection(incomingCall.callerId);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      await pc.setRemoteDescription(
        new RTCSessionDescription(incomingCall.offer)
      );

      // ✅ setRemoteDescription 완료 후 버퍼된 ICE 적용
      await flushIceCandidates();

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      console.log("📤 Answer 전송");
      socket.emit("call:accept", {
        callerId: incomingCall.callerId,
        answer: pc.localDescription,
      });

      setIncomingCall(null);
    } catch (error) {
      console.error("통화 수락 실패:", error);
      setCallStatus("idle");
      cleanupCall();
    }
  }, [incomingCall, socket, createPeerConnection, flushIceCandidates, cleanupCall]);

  // ─── 통화 거절 ─────────────────────────────────────────────
  const rejectCall = useCallback(() => {
    if (!incomingCall || !socket) return;
    socket.emit("call:reject", { callerId: incomingCall.callerId });
    setIncomingCall(null);
    setCallStatus("idle");
  }, [incomingCall, socket]);

  // ─── 통화 종료 ─────────────────────────────────────────────
  const endCall = useCallback(
    (otherUserId?: string) => {
      const targetId = otherUserId || currentCallTargetRef.current;
      if (targetId && socket) {
        socket.emit("call:end", { otherUserId: targetId });
      }
      setCallStatus("idle");
      cleanupCall();
    },
    [socket, cleanupCall]
  );

  // ─── 음소거 토글 ────────────────────────────────────────────
  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return false;
    const track = stream.getAudioTracks()[0];
    if (!track) return false;
    track.enabled = !track.enabled;
    return !track.enabled;
  }, []);

  return {
    socketMessages,
    typingUsers,
    socket,
    isConnected,
    incomingCall,
    localStream,
    remoteStream,
    callStatus,
    initiateCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
  };
}
