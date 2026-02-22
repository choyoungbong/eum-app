"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useSession } from "next-auth/react";

export function useSocket() {
  const { data: session } = useSession();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!session?.user?.id) return;

    // ✅ 개선: 하드코딩된 localhost를 제거하고 현재 도메인을 사용
    const socketUrl = typeof window !== "undefined" ? window.location.origin : "https://eum-app-production.up.railway.app";
    
    const socket = io(socketUrl, {
      auth: { userId: session.user.id },
      transports: ["websocket", "polling"], // ✅ 모바일 호환성을 위해 polling 허용
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on("connect", () => console.log("✅ 실시간 서버 연결 성공:", socket.id));
    socket.on("connect_error", (err) => console.error("❌ 소켓 연결 에러:", err.message));

    return () => {
      socket.disconnect();
    };
  }, [session?.user?.id]);

  return { socket: socketRef.current };
}

export function useChatRoom(chatRoomId: string | null) {
  const { socket } = useSocket();
  const [socketMessages, setSocketMessages] = useState<any[]>([]);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());

  // WebRTC 상태
  const [incomingCall, setIncomingCall] = useState<any>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  // 채팅방 입장 및 메시지 수신 (기본 기능 유지)
  useEffect(() => {
    if (!socket || !chatRoomId) return;

    socket.emit("chat:join", chatRoomId);

    const handleMessage = (data: any) => {
      setSocketMessages((prev) => [...prev, data]);
    };

    const handleTyping = ({ userId, isTyping }: any) => {
      setTypingUsers((prev) => {
        const next = new Set(prev);
        if (isTyping) next.add(userId);
        else next.delete(userId);
        return next;
      });
    };

    socket.on("message:receive", handleMessage);
    socket.on("typing:update", handleTyping);

    // WebRTC 시그널링 이벤트 리스너
    socket.on("call:incoming", (data) => {
      console.log("📞 통화 요청 수신:", data);
      setIncomingCall(data);
    });

    socket.on("call:accepted", async ({ answer }) => {
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
      }
    });

    socket.on("call:rejected", () => {
      alert("상대방이 통화를 거절했습니다.");
      endCall();
    });

    socket.on("call:ended", () => {
      console.log("📴 통화 종료됨");
      endCall();
    });

    socket.on("call:ice-candidate", async ({ candidate }) => {
      if (peerConnectionRef.current && candidate) {
        try {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error("ICE Candidate 추가 실패", e);
        }
      }
    });

    return () => {
      socket.off("message:receive", handleMessage);
      socket.off("typing:update", handleTyping);
      socket.off("call:incoming");
      socket.off("call:accepted");
      socket.off("call:rejected");
      socket.off("call:ended");
      socket.off("call:ice-candidate");
    };
  }, [socket, chatRoomId]);

  // PeerConnection 생성 함수
  const createPeerConnection = (otherUserId: string) => {
    // ✅ 모바일/PC 간 연결 호환성을 위해 구글 STUN 서버 사용
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit("call:ice-candidate", { otherUserId, candidate: event.candidate });
      }
    };

    pc.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
    };

    peerConnectionRef.current = pc;
    return pc;
  };

  // 통화 걸기
  const initiateCall = async (otherUserId: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);

      const pc = createPeerConnection(otherUserId);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket?.emit("call:start", { receiverId: otherUserId, offer });
    } catch (error) {
      console.error("통화 시작 실패:", error);
      alert("카메라 또는 마이크 권한을 허용해주세요.");
    }
  };

  // 통화 수락
  const acceptCall = async () => {
    if (!incomingCall) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);

      const pc = createPeerConnection(incomingCall.callerId);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket?.emit("call:accept", { callerId: incomingCall.callerId, answer });
      setIncomingCall(null);
    } catch (error) {
      console.error("통화 수락 오류:", error);
    }
  };

  const rejectCall = () => {
    if (!incomingCall) return;
    socket?.emit("call:reject", { callerId: incomingCall.callerId });
    setIncomingCall(null);
  };

  const endCall = (otherUserId?: string) => {
    if (otherUserId && socket) socket.emit("call:end", { otherUserId });
    if (localStream) localStream.getTracks().forEach(t => t.stop());
    if (remoteStream) remoteStream.getTracks().forEach(t => t.stop());
    if (peerConnectionRef.current) peerConnectionRef.current.close();
    peerConnectionRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setIncomingCall(null);
  };

  return {
    socketMessages,
    typingUsers,
    socket,
    incomingCall,
    localStream,
    remoteStream,
    initiateCall,
    acceptCall,
    rejectCall,
    endCall,
  };
}