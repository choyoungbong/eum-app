import { useEffect, useState, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { toast } from "@/components/Toast";

export const useSocket = (chatRoomId?: string) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false); // ✅ 추가: 연결 상태 확인용
  const [socketMessages, setSocketMessages] = useState<any[]>([]);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  
  const [callStatus, setCallStatus] = useState<"idle" | "calling" | "incoming" | "connected">("idle");
  const [incomingCall, setIncomingCall] = useState<any>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  
  const peerConnection = useRef<RTCPeerConnection | null>(null);

  useEffect(() => {
    const s = io(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000", {
      path: "/api/socket/io",
    });

    s.on("connect", () => {
      setIsConnected(true); // ✅ 연결됨
      if (chatRoomId) {
        s.emit("room:join", { chatRoomId });
      }
    });

    s.on("disconnect", () => {
      setIsConnected(false); // ✅ 연결 끊김
    });

    s.on("message:received", (msg) => {
      setSocketMessages((prev) => [...prev, msg]);
    });

    s.on("call:incoming", (data) => {
      setIncomingCall(data);
      setCallStatus("incoming");
    });

    s.on("call:accepted", async ({ answer }) => {
      if (peerConnection.current) {
        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));
        setCallStatus("connected");
      }
    });

    s.on("call:ice-candidate", async ({ candidate }) => {
      if (peerConnection.current) {
        await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
      }
    });

    s.on("call:rejected", () => {
      toast.error("통화가 거절되었습니다.");
      resetCallState();
    });

    s.on("call:ended", () => {
      toast.info("통화가 종료되었습니다.");
      resetCallState();
    });

    setSocket(s);
    return () => { s.disconnect(); };
  }, [chatRoomId]);

  const resetCallState = useCallback(() => {
    if (localStream) localStream.getTracks().forEach(t => t.stop());
    setLocalStream(null);
    setRemoteStream(null);
    setCallStatus("idle");
    setIncomingCall(null);
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }
  }, [localStream]);

  const initiateCall = useCallback(async (type: "VOICE" | "VIDEO", otherUserId: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: type === "VIDEO" });
      setLocalStream(stream);
      setCallStatus("calling");

      const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      pc.onicecandidate = (e) => {
        if (e.candidate) socket?.emit("call:ice-candidate", { otherUserId, candidate: e.candidate });
      };
      pc.ontrack = (e) => setRemoteStream(e.streams[0]);

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      peerConnection.current = pc;

      socket?.emit("call:initiate", { chatRoomId, receiverId: otherUserId, callType: type, offer });
    } catch (err) {
      toast.error("미디어 장치 접근 실패");
    }
  }, [socket, chatRoomId]);

  const acceptCall = useCallback(async () => {
    if (!incomingCall || !socket) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: incomingCall.callType === "VIDEO" });
      setLocalStream(stream);
      const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      pc.onicecandidate = (e) => {
        if (e.candidate) socket.emit("call:ice-candidate", { otherUserId: incomingCall.from, candidate: e.candidate });
      };
      pc.ontrack = (e) => setRemoteStream(e.streams[0]);

      await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      peerConnection.current = pc;

      socket.emit("call:accept", { callerId: incomingCall.from, answer });
      setCallStatus("connected");
    } catch (err) {
      toast.error("통화 연결 실패");
    }
  }, [incomingCall, socket]);

  const rejectCall = useCallback(() => {
    if (incomingCall && socket) {
      socket.emit("call:reject", { callerId: incomingCall.from });
      resetCallState();
    }
  }, [incomingCall, socket, resetCallState]);

  const endCall = useCallback((otherUserId?: string) => {
    if (socket && otherUserId) socket.emit("call:end", { otherUserId });
    resetCallState();
  }, [socket, resetCallState]);

  const toggleMute = () => {
    if (localStream) {
      const track = localStream.getAudioTracks()[0];
      track.enabled = !track.enabled;
      return !track.enabled; 
    }
    return false;
  };

  return { 
    socketMessages, 
    typingUsers, 
    socket, 
    isConnected, // ✅ 추가: 이제 page.tsx에서 이 값을 사용할 수 있습니다.
    incomingCall, 
    localStream, 
    remoteStream, 
    callStatus, 
    initiateCall, 
    acceptCall, 
    rejectCall, 
    endCall, 
    toggleMute 
  };
};