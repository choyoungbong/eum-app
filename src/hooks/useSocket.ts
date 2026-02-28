"use client";
// src/hooks/useSocket.ts
// ✅ 완전 재작성: useSocket (기본) + useChatRoom (채팅+WebRTC)

import { useEffect, useRef, useState, useCallback } from "react";
import { io, type Socket } from "socket.io-client";
import { useSession } from "next-auth/react";

// ── 싱글톤 소켓 ──────────────────────────────────────────
let _socket: Socket | null = null;
let _userId: string | null = null;

function getOrCreateSocket(userId: string): Socket {
  if (_socket && _userId === userId && _socket.connected) return _socket;
  if (_socket) { _socket.disconnect(); _socket = null; }

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

// ── ICE 서버 ─────────────────────────────────────────────
const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "turn:openrelay.metered.ca:80",   username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turn:openrelay.metered.ca:443",  username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" },
];

// ══════════════════════════════════════════════════════════
// useSocket — 기본 소켓 훅 (chat/page.tsx 등에서 사용)
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

  const [socketMessages, setSocketMessages] = useState<any[]>([]);
  const [typingUsers, setTypingUsers]       = useState<Set<string>>(new Set());

  const [incomingCall, setIncomingCall] = useState<{
    callId: string; callerId: string; chatRoomId: string;
    callType: "VOICE" | "VIDEO"; offer: RTCSessionDescriptionInit;
  } | null>(null);
  const [localStream,  setLocalStream]  = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [callStatus, setCallStatus]     = useState<"idle"|"calling"|"incoming"|"connected"|"ended">("idle");

  const pcRef                 = useRef<RTCPeerConnection | null>(null);
  const localStreamRef        = useRef<MediaStream | null>(null);
  const iceBufRef             = useRef<RTCIceCandidateInit[]>([]);
  const remoteDescSetRef      = useRef(false);
  const callTargetRef         = useRef<string | null>(null);

  // ── 채팅방 입장 ────────────────────────────────────────
  useEffect(() => {
    if (!socket || !chatRoomId) return;
    const join = () => socket.emit("chat:join", chatRoomId);
    if (socket.connected) join();
    socket.on("connect", join);
    return () => { socket.off("connect", join); };
  }, [socket, chatRoomId]);

  // ── 메시지/타이핑 ──────────────────────────────────────
  useEffect(() => {
    if (!socket) return;
    const onMsg = (data: any) =>
      setSocketMessages((p) => p.some((m) => m.id === data.id) ? p : [...p, data]);
    const onTyping = ({ userId, isTyping }: { userId: string; isTyping: boolean }) =>
      setTypingUsers((p) => { const n = new Set(p); isTyping ? n.add(userId) : n.delete(userId); return n; });

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
  const createPC = useCallback((targetId: string): RTCPeerConnection => {
    pcRef.current?.close();
    iceBufRef.current = [];
    remoteDescSetRef.current = false;

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS, iceCandidatePoolSize: 10 });

    pc.onicecandidate = (e) => {
      if (e.candidate && socket)
        socket.emit("call:ice-candidate", { otherUserId: targetId, candidate: e.candidate.toJSON() });
    };
    pc.oniceconnectionstatechange = () => {
      const s = pc.iceConnectionState;
      if (s === "connected" || s === "completed") setCallStatus("connected");
      if (s === "failed") { cleanupCall(); setCallStatus("idle"); }
    };
    pc.ontrack = (e) => {
      if (e.streams?.[0]) {
        setRemoteStream(e.streams[0]);
      } else {
        const ms = new MediaStream();
        ms.addTrack(e.track);
        setRemoteStream(ms);
      }
    };
    pcRef.current = pc;
    return pc;
  }, [socket]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 정리 ───────────────────────────────────────────────
  const cleanupCall = useCallback(() => {
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

    const onIncoming = (data: any) => { setIncomingCall(data); setCallStatus("incoming"); };

    const onAccepted = async ({ answer }: { answer: RTCSessionDescriptionInit }) => {
      const pc = pcRef.current;
      if (!pc) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        await flushIce();
        setCallStatus("connected");
      } catch { cleanupCall(); setCallStatus("idle"); }
    };

    const onRejected = () => { cleanupCall(); setCallStatus("idle"); };

    const onEnded = () => {
      setCallStatus("ended");
      cleanupCall();
      setTimeout(() => setCallStatus("idle"), 2000);
    };

    const onIce = async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
      if (!candidate || !pcRef.current) return;
      if (remoteDescSetRef.current) {
        try { await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
      } else {
        iceBufRef.current.push(candidate);
      }
    };

    socket.on("call:incoming",     onIncoming);
    socket.on("call:accepted",     onAccepted);
    socket.on("call:rejected",     onRejected);
    socket.on("call:ended",        onEnded);
    socket.on("call:user-offline", onRejected);
    socket.on("call:ice-candidate", onIce);
    return () => {
      socket.off("call:incoming",     onIncoming);
      socket.off("call:accepted",     onAccepted);
      socket.off("call:rejected",     onRejected);
      socket.off("call:ended",        onEnded);
      socket.off("call:user-offline", onRejected);
      socket.off("call:ice-candidate", onIce);
    };
  }, [socket, flushIce, cleanupCall]);

  // ── 통화 걸기 ──────────────────────────────────────────
  const initiateCall = useCallback(async (callType: "VOICE" | "VIDEO", otherUserId: string) => {
    if (!socket || callStatus !== "idle") return;
    try {
      setCallStatus("calling");
      callTargetRef.current = otherUserId;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: callType === "VIDEO" });
      localStreamRef.current = stream;
      setLocalStream(stream);
      const pc = createPC(otherUserId);
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: callType === "VIDEO" });
      await pc.setLocalDescription(offer);
      socket.emit("call:start", { receiverId: otherUserId, chatRoomId, callType, offer: pc.localDescription });
    } catch {
      alert("카메라/마이크 접근 실패\n브라우저 권한을 확인해주세요");
      cleanupCall();
      setCallStatus("idle");
    }
  }, [socket, callStatus, chatRoomId, createPC, cleanupCall]);

  // ── 통화 수락 ──────────────────────────────────────────
  const acceptCall = useCallback(async () => {
    if (!incomingCall || !socket) return;
    try {
      setCallStatus("connected");
      callTargetRef.current = incomingCall.callerId;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: incomingCall.callType === "VIDEO" });
      localStreamRef.current = stream;
      setLocalStream(stream);
      const pc = createPC(incomingCall.callerId);
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));
      await flushIce();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("call:accept", { callerId: incomingCall.callerId, answer: pc.localDescription });
      setIncomingCall(null);
    } catch {
      alert("카메라/마이크 접근 실패\n브라우저 권한을 확인해주세요");
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

  const endCall = useCallback((otherUserId?: string) => {
    const id = otherUserId || callTargetRef.current;
    if (id && socket) socket.emit("call:end", { otherUserId: id });
    cleanupCall();
    setCallStatus("idle");
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

  return {
    socket, isConnected,
    socketMessages, typingUsers,
    incomingCall, localStream, remoteStream, callStatus,
    initiateCall, acceptCall, rejectCall, endCall,
    toggleMute, toggleCamera,
  };
}
