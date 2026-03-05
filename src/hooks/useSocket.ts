"use client";
// src/hooks/useSocket.ts
// ✅ 개선판: 소켓 싱글톤 통합 + 통화 착신음 + 그룹채팅 안전 처리

import { useEffect, useRef, useState, useCallback } from "react";
import { io, type Socket } from "socket.io-client";
import { useSession } from "next-auth/react";

// ── 전역 싱글톤 소켓 (모든 훅이 공유) ─────────────────────
// socket-client.ts도 이 인스턴스를 사용하도록 export
let _socket: Socket | null = null;
let _userId: string | null = null;

export function getOrCreateSocket(userId: string): Socket {
  // 🔒 reconnect 상태든 아니든 같은 유저면 무조건 재사용
  if (_socket && _userId === userId) {
    return _socket;
  }
  if (_socket) {
    _socket.disconnect();
    _socket = null;
  }

  const socket = io(typeof window !== "undefined" ? window.location.origin : "", {
    path: "/api/socket/io",
    auth: { userId },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1500,
  });
  _socket = socket;
  _userId = userId;

  socket.on("connect",       () => console.log("✅ Socket connected:", socket.id));
  socket.on("disconnect",    (r) => console.log("❌ Socket disconnected:", r));
  socket.on("connect_error", (e) => console.error("❌ Socket error:", e.message));
  return socket;
}

/** 현재 싱글톤 소켓 반환 (연결 안 된 경우 null) */
export function getSocket(): Socket | null {
  return _socket;
}

// ── ICE 서버 ─────────────────────────────────────────────
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

// ── 통화 착신음 유틸 ──────────────────────────────────────
let _ringAudio: HTMLAudioElement | null = null;

function playRingtone() {
  if (typeof window === "undefined") return;
  try {
    if (!_ringAudio) {
      // Web Audio API로 벨소리 합성 (외부 파일 불필요)
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const buf = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < ch.length; i++) {
        const t = i / ctx.sampleRate;
        const burst = t % 0.5 < 0.3 ? 1 : 0;
        ch[i] = Math.sin(2 * Math.PI * 440 * t) * 0.5 * burst;
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.connect(ctx.destination);
      src.start();
      // AudioContext를 _ringAudio 대신 저장
      (_ringAudio as any) = { ctx, src, stop: () => { src.stop(); ctx.close(); } };
    }
  } catch {
    // 실패해도 무시
  }
}

function stopRingtone() {
  if (_ringAudio) {
    try { (_ringAudio as any).stop(); } catch {}
    _ringAudio = null;
  }
}

// ══════════════════════════════════════════════════════════
// useSocket — 기본 소켓 훅 (chat/page.tsx, providers 등에서 사용)
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

    const onConnect    = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);
    socket.on("connect",    onConnect);
    socket.on("disconnect", onDisconnect);

    return () => {
      socket.off("connect",    onConnect);
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

  const [socketMessages, setSocketMessages] = useState<any[]>([]);
  const [typingUsers, setTypingUsers]       = useState<Set<string>>(new Set());

  const [incomingCall, setIncomingCall] = useState<{
    callId: string;
    callerId: string;
    chatRoomId: string;
    callType: "VOICE" | "VIDEO";
    offer: RTCSessionDescriptionInit;
  } | null>(null);
  const [localStream,  setLocalStream]  = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [callStatus, setCallStatus]     = useState<
    "idle" | "calling" | "incoming" | "connected" | "ended"
  >("idle");

  const pcRef            = useRef<RTCPeerConnection | null>(null);
  const localStreamRef   = useRef<MediaStream | null>(null);
  const iceBufRef        = useRef<RTCIceCandidateInit[]>([]);
  const remoteDescSetRef = useRef(false);
  const callTargetRef    = useRef<string | null>(null);

  // ── 채팅방 입장 ────────────────────────────────────────
  useEffect(() => {
    if (!socket || !chatRoomId) return;
    const join = () => socket.emit("chat:join", chatRoomId);
    if (socket.connected) join();
    socket.on("connect", join);
    return () => {
      socket.off("connect", join);
      // 언마운트 시 채팅방 퇴장
      socket.emit("chat:leave", chatRoomId);
    };
  }, [socket, chatRoomId]);

  // ── 메시지/타이핑 ──────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const onMsg = (data: any) =>
      setSocketMessages((p) =>
        p.some((m) => m.id === data.id) ? p : [...p, data]
      );

    const onTyping = ({
      userId,
      isTyping,
    }: { userId: string; isTyping: boolean }) =>
      setTypingUsers((p) => {
        const n = new Set(p);
        isTyping ? n.add(userId) : n.delete(userId);
        return n;
      });

    socket.on("message:receive", onMsg);
    socket.on("message:new",     onMsg);
    socket.on("typing:update",      onTyping);
    socket.on("chat:typing:update", onTyping);

    return () => {
      socket.off("message:receive", onMsg);
      socket.off("message:new",     onMsg);
      socket.off("typing:update",      onTyping);
      socket.off("chat:typing:update", onTyping);
    };
  }, [socket]);

  // ── ICE 버퍼 플러시 ────────────────────────────────────
  const flushIce = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc) return;
    for (const c of iceBufRef.current) {
      try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
    }
    iceBufRef.current = [];
    remoteDescSetRef.current = true;
  }, []);

  // ── PeerConnection 생성 ────────────────────────────────
  const createPC = useCallback(
    (targetId: string): RTCPeerConnection => {
      pcRef.current?.close();
      iceBufRef.current = [];
      remoteDescSetRef.current = false;

      const pc = new RTCPeerConnection({
        iceServers: ICE_SERVERS,
        iceCandidatePoolSize: 10,
      });

      pc.onicecandidate = (e) => {
        if (e.candidate && socket)
          socket.emit("call:ice-candidate", {
            otherUserId: targetId,
            candidate: e.candidate.toJSON(),
          });
      };

      pc.oniceconnectionstatechange = () => {
        const state = pc.iceConnectionState;
        console.log("ICE state:", state);
      
        if (state === "connected" || state === "completed") {
          setCallStatus("connected");
        }
      
        // 🔥 failed 시 바로 종료하지 말고 restart
        if (state === "failed") {
          console.log("ICE failed → restartIce()");
          try {
            pc.restartIce();
          } catch (e) {
            console.error("ICE restart error:", e);
          }
        }
      
        // 🔥 disconnected는 5초 유예
        if (state === "disconnected") {
          setTimeout(() => {
            if (pc.iceConnectionState === "disconnected") {
              console.log("ICE still disconnected → cleanup");
              cleanupCall();
              setCallStatus("idle");
            }
          }, 5000);
        }
      };

      pc.ontrack = (event) => {
        console.log("Remote track received");
      
        setRemoteStream((prev) => {
          const stream = prev ?? new MediaStream();
          event.streams.forEach((s) => {
            s.getTracks().forEach((track) => {
              if (!stream.getTracks().some(t => t.id === track.id)) {
                stream.addTrack(track);
              }
            });
          });
          return stream;
        });
      };

      pcRef.current = pc;
      return pc;
    },
    [socket] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // ── 정리 ───────────────────────────────────────────────
  const cleanupCall = useCallback(() => {
    stopRingtone();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    iceBufRef.current = [];
    remoteDescSetRef.current = false;
    callTargetRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setIncomingCall(null);
  }, []);

  // ── WebRTC 소켓 이벤트 ────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const onIncoming = (data: any) => {
      setIncomingCall(data);
      setCallStatus("incoming");
      playRingtone(); // 🔔 착신음 재생
    };

    const onAccepted = async ({
      answer,
    }: { answer: RTCSessionDescriptionInit }) => {
      const pc = pcRef.current;
      if (!pc) return;
      stopRingtone();
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        await flushIce();
        setCallStatus("connected");
      } catch {
        cleanupCall();
        setCallStatus("idle");
      }
    };

    const onRejected = () => {
      stopRingtone();
      cleanupCall();
      setCallStatus("idle");
    };

    const onEnded = () => {
      stopRingtone();
      setCallStatus("ended");
      cleanupCall();
      setTimeout(() => setCallStatus("idle"), 2000);
    };

    const onIce = async ({
      candidate,
    }: { candidate: RTCIceCandidateInit }) => {
      if (!candidate || !pcRef.current) return;
      if (remoteDescSetRef.current) {
        try {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch {}
      } else {
        iceBufRef.current.push(candidate);
      }
    };

    socket.on("call:incoming",      onIncoming);
    socket.on("call:accepted",      onAccepted);
    socket.on("call:rejected",      onRejected);
    socket.on("call:ended",         onEnded);
    socket.on("call:user-offline",  onRejected);
    socket.on("call:ice-candidate", onIce);

    return () => {
      socket.off("call:incoming",      onIncoming);
      socket.off("call:accepted",      onAccepted);
      socket.off("call:rejected",      onRejected);
      socket.off("call:ended",         onEnded);
      socket.off("call:user-offline",  onRejected);
      socket.off("call:ice-candidate", onIce);
    };
  }, [socket, flushIce, cleanupCall]);

  // ── 통화 걸기 ──────────────────────────────────────────
  const initiateCall = useCallback(
    async (callType: "VOICE" | "VIDEO", otherUserId: string | undefined) => {
      // 🔒 안전 가드: otherUserId 없으면 중단
      if (!socket || callStatus !== "idle" || !otherUserId) return;
      try {
        setCallStatus("calling");
        callTargetRef.current = otherUserId;
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

        socket.emit("call:start", {
          receiverId: otherUserId,
          chatRoomId,
          callType,
          offer: pc.localDescription,
        });
      } catch (err: any) {
        console.error("🔥 initiateCall ERROR:", err);
      
        alert(
          "통화 시작 오류\n\n" +
          "이름: " + err?.name + "\n" +
          "메시지: " + err?.message
        );
      
        cleanupCall();
        setCallStatus("idle");
      }
    },
    [socket, callStatus, chatRoomId, createPC, cleanupCall]
  );

  // ── 통화 수락 ──────────────────────────────────────────
  const acceptCall = useCallback(async () => {
    if (!incomingCall || !socket) return;
    stopRingtone();
    try {
      setCallStatus("connected");
      callTargetRef.current = incomingCall.callerId;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: incomingCall.callType === "VIDEO",
      });
      localStreamRef.current = stream;
      setLocalStream(stream);

      const pc = createPC(incomingCall.callerId);
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));

      await pc.setRemoteDescription(
        new RTCSessionDescription(incomingCall.offer)
      );
      await flushIce();

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit("call:accept", {
        callerId: incomingCall.callerId,
        answer: pc.localDescription,
      });
      setIncomingCall(null);
    } catch (err: any) {
      console.error("🔥 initiateCall ERROR:", err);
    
      alert(
        "통화 시작 오류\n\n" +
        "이름: " + err?.name + "\n" +
        "메시지: " + err?.message
      );
    
      cleanupCall();
      setCallStatus("idle");
    }
  }, [incomingCall, socket, createPC, flushIce, cleanupCall]);

  const rejectCall = useCallback(() => {
    if (!incomingCall || !socket) return;
    stopRingtone();
    socket.emit("call:reject", { callerId: incomingCall.callerId });
    setIncomingCall(null);
    setCallStatus("idle");
  }, [incomingCall, socket]);

  const endCall = useCallback(
    (otherUserId?: string) => {
      const id = otherUserId || callTargetRef.current;
      if (id && socket) socket.emit("call:end", { otherUserId: id });
      cleanupCall();
      setCallStatus("idle");
    },
    [socket, cleanupCall]
  );

  const toggleMute = useCallback((): boolean => {
    const t = localStreamRef.current?.getAudioTracks()[0];
    if (!t) return false;
    t.enabled = !t.enabled;
    return !t.enabled; // true = muted
  }, []);

  const toggleCamera = useCallback((): boolean => {
    const t = localStreamRef.current?.getVideoTracks()[0];
    if (!t) return false;
    t.enabled = !t.enabled;
    return !t.enabled; // true = camera off
  }, []);

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
