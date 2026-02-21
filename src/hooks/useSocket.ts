import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useSession } from "next-auth/react";

export function useSocket() {
  const { data: session } = useSession();
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!session?.user?.id) return;

    const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3000", {
      auth: { userId: session.user.id },
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      setIsConnected(true);
      fetch("/api/users/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isOnline: true }),
      });
    });

    socket.on("disconnect", () => setIsConnected(false));
    socketRef.current = socket;

    return () => {
      if (socket) {
        fetch("/api/users/presence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isOnline: false }),
        });
        socket.disconnect();
      }
    };
  }, [session?.user?.id]);

  return { socket: socketRef.current, isConnected };
}

export function useChatRoom(chatRoomId: string | null) {
  const { socket, isConnected } = useSocket();
  const [messages, setMessages] = useState<any[]>([]);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [incomingCall, setIncomingCall] = useState<any>(null);

  // WebRTC 상태
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    if (!socket || !chatRoomId) return;

    socket.emit("chat:join", chatRoomId);

    const handleNewMessage = (message: any) => {
      setMessages((prev) => {
        if (prev.find((m) => m.id === message.id)) return prev;
        return [...prev, message];
      });
    };

    const handleTyping = (data: { userId: string }) => {
      setTypingUsers((prev) => new Set(prev).add(data.userId));
    };

    const handleTypingStop = (data: { userId: string }) => {
      setTypingUsers((prev) => {
        const next = new Set(prev);
        next.delete(data.userId);
        return next;
      });
    };

    socket.on("message:new", handleNewMessage);
    socket.on("typing:user", handleTyping);
    socket.on("typing:stop", handleTypingStop);

    return () => {
      socket.emit("chat:leave", chatRoomId);
      socket.off("message:new", handleNewMessage);
      socket.off("typing:user", handleTyping);
      socket.off("typing:stop", handleTypingStop);
    };
  }, [socket, chatRoomId]);

  // ==================== WebRTC ====================

  const createPeerConnection = (otherUserId: string) => {
    const config: RTCConfiguration = {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    };

    const pc = new RTCPeerConnection(config);

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit("call:ice-candidate", {
          otherUserId,
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      console.log("📹 Remote track received");
      setRemoteStream(event.streams[0]);
    };

    pc.onconnectionstatechange = () => {
      console.log("🔗 Connection state:", pc.connectionState);
    };

    peerConnectionRef.current = pc;
    return pc;
  };

  // 통화 시작 (발신자)
  const initiateCall = async (callType: "VOICE" | "VIDEO", receiverId: string) => {
    try {
      console.log("📞 Initiating call:", callType);

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

      console.log("✅ Call request sent");
    } catch (error) {
      console.error("❌ Failed to initiate call:", error);
      alert("카메라/마이크 권한이 필요합니다.");
    }
  };

  // 수신된 통화 처리
  useEffect(() => {
    if (!socket) return;

    const handleIncomingCall = (data: any) => {
      console.log("📞 Incoming call:", data);
      setIncomingCall(data);
    };

    const handleCallAccepted = async (data: any) => {
      console.log("✅ Call accepted:", data);
      if (peerConnectionRef.current && data.answer) {
        await peerConnectionRef.current.setRemoteDescription(
          new RTCSessionDescription(data.answer)
        );
      }
    };

    const handleCallRejected = () => {
      console.log("❌ Call rejected");
      endCall();
      alert("상대방이 통화를 거절했습니다.");
    };

    const handleCallEnded = () => {
      console.log("📴 Call ended by other user");
      endCall();
    };

    const handleIceCandidate = async (data: any) => {
      if (peerConnectionRef.current && data.candidate) {
        try {
          await peerConnectionRef.current.addIceCandidate(
            new RTCIceCandidate(data.candidate)
          );
        } catch (error) {
          console.error("❌ Error adding ICE candidate:", error);
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
      console.log("✅ Accepting call");

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
      console.log("✅ Call accepted and answer sent");
    } catch (error) {
      console.error("❌ Failed to accept call:", error);
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
    console.log("❌ Call rejected");
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
    console.log("📴 Call ended");
  };

  const sendMessage = (message: any) => {
    // 메시지는 API로 전송
  };

  const startTyping = () => {
    if (socket && chatRoomId) socket.emit("typing:start", { chatRoomId });
  };

  const stopTyping = () => {
    if (socket && chatRoomId) socket.emit("typing:stop", { chatRoomId });
  };

  return {
    messages,
    setMessages,
    typingUsers,
    sendMessage,
    startTyping,
    stopTyping,
    isConnected,
    incomingCall,
    localStream,
    remoteStream,
    initiateCall,
    acceptCall,
    rejectCall,
    endCall,
  };
}
