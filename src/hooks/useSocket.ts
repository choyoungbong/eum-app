import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useSession } from "next-auth/react";

export function useSocket() {
  const { data: session } = useSession();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!session?.user?.id) return;
    const socket = io("http://localhost:3000", {
      auth: { userId: session.user.id },
      transports: ["websocket"],
    });
    socketRef.current = socket;
    return () => { socket.disconnect(); };
  }, [session?.user?.id]);

  return { socket: socketRef.current };
}

export function useChatRoom(chatRoomId: string | null) {
  const { socket } = useSocket();
  const [socketMessages, setSocketMessages] = useState<any[]>([]);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());

  // ==================== WebRTC 상태 ====================
  const [incomingCall, setIncomingCall] = useState<any>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  // ==================== 기존 채팅 로직 (100% 유지) ====================
  useEffect(() => {
    if (!socket || !chatRoomId) return;

    socket.emit("chat:join", chatRoomId);

    socket.on("message:new", (msg) => {
      console.log("📩 메시지 수신!", msg);
      setSocketMessages((prev) => [...prev, msg]);
    });

    socket.on("typing:user", (data) => setTypingUsers(prev => new Set(prev).add(data.userId)));
    socket.on("typing:stop", (data) => setTypingUsers(prev => {
      const next = new Set(prev); next.delete(data.userId); return next;
    }));

    return () => {
      socket.off("message:new");
      socket.off("typing:user");
      socket.off("typing:stop");
    };
  }, [socket, chatRoomId]);

  // ==================== WebRTC 로직 ====================

  const createPeerConnection = (otherUserId: string) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit("call:ice-candidate", {
          otherUserId,
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      console.log("📹 원격 스트림 수신");
      setRemoteStream(event.streams[0]);
    };

    peerConnectionRef.current = pc;
    return pc;
  };

  // 통화 시작 (발신자)
  const initiateCall = async (callType: "VOICE" | "VIDEO", receiverId: string) => {
    try {
      console.log("📞 통화 시작:", callType);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: callType === "VIDEO",
        audio: true,
      });

      setLocalStream(stream);

      const pc = createPeerConnection(receiverId);
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket?.emit("call:request", {
        receiverId,
        chatRoomId,
        callType,
        offer,
      });

      console.log("✅ 통화 요청 전송");
    } catch (error) {
      console.error("❌ 통화 시작 실패:", error);
      alert("카메라/마이크 권한이 필요합니다.");
    }
  };

  // WebRTC 이벤트 리스너
  useEffect(() => {
    if (!socket) return;

    const handleIncomingCall = (data: any) => {
      console.log("📞 수신된 통화:", data);
      setIncomingCall(data);
    };

    const handleCallAccepted = async (data: any) => {
      console.log("✅ 통화 수락됨:", data);
      if (peerConnectionRef.current && data.answer) {
        await peerConnectionRef.current.setRemoteDescription(
          new RTCSessionDescription(data.answer)
        );
      }
    };

    const handleCallRejected = () => {
      console.log("❌ 통화 거절됨");
      endCall();
      alert("상대방이 통화를 거절했습니다.");
    };

    const handleCallEnded = () => {
      console.log("📴 상대방이 통화를 종료했습니다");
      endCall();
    };

    const handleIceCandidate = async (data: any) => {
      if (peerConnectionRef.current && data.candidate) {
        try {
          await peerConnectionRef.current.addIceCandidate(
            new RTCIceCandidate(data.candidate)
          );
        } catch (error) {
          console.error("❌ ICE Candidate 오류:", error);
        }
      }
    };

    socket.on("call:incoming", handleIncomingCall);
    socket.on("call:accepted", handleCallAccepted);
    socket.on("call:rejected", handleCallRejected);
    socket.on("call:ended", handleCallEnded);
    socket.on("call:ice-candidate", handleIceCandidate);

    return () => {
      socket.off("call:incoming", handleIncomingCall);
      socket.off("call:accepted", handleCallAccepted);
      socket.off("call:rejected", handleCallRejected);
      socket.off("call:ended", handleCallEnded);
      socket.off("call:ice-candidate", handleIceCandidate);
    };
  }, [socket]);

  // 통화 수락 (수신자)
  const acceptCall = async () => {
    if (!incomingCall) return;

    try {
      console.log("✅ 통화 수락");

      const stream = await navigator.mediaDevices.getUserMedia({
        video: incomingCall.callType === "VIDEO",
        audio: true,
      });

      setLocalStream(stream);

      const pc = createPeerConnection(incomingCall.callerId);
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      await pc.setRemoteDescription(
        new RTCSessionDescription(incomingCall.offer)
      );

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket?.emit("call:accept", {
        callerId: incomingCall.callerId,
        answer,
      });

      setIncomingCall(null);
    } catch (error) {
      console.error("❌ 통화 수락 실패:", error);
      alert("카메라/마이크 권한이 필요합니다.");
    }
  };

  // 통화 거절
  const rejectCall = () => {
    if (!incomingCall) return;

    socket?.emit("call:reject", {
      callerId: incomingCall.callerId,
    });

    setIncomingCall(null);
    console.log("❌ 통화 거절");
  };

  // 통화 종료
  const endCall = (otherUserId?: string) => {
    if (otherUserId && socket) {
      socket.emit("call:end", { otherUserId });
    }

    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
    }

    if (remoteStream) {
      remoteStream.getTracks().forEach((track) => track.stop());
      setRemoteStream(null);
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    setIncomingCall(null);
    console.log("📴 통화 종료");
  };

  return {
    socketMessages,
    typingUsers,
    socket,
    // WebRTC 추가
    incomingCall,
    localStream,
    remoteStream,
    initiateCall,
    acceptCall,
    rejectCall,
    endCall,
  };
}
