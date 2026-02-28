import { useEffect, useState, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { toast } from "@/components/Toast";
import { useSession } from "next-auth/react";

export const useSocket = (chatRoomId?: string) => {
  const { data: session } = useSession();

  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [socketMessages, setSocketMessages] = useState<any[]>([]);

  const [callStatus, setCallStatus] = useState<
    "idle" | "calling" | "incoming" | "connected"
  >("idle");

  const [incomingCall, setIncomingCall] = useState<any>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const peerConnection = useRef<RTCPeerConnection | null>(null);

  useEffect(() => {
    if (!session?.user?.id) return;

    const s = io({
      path: "/api/socket/io",
      query: { userId: session.user.id },
    });

    s.on("connect", () => {
      setIsConnected(true);
      if (chatRoomId) {
        s.emit("room:join", { chatRoomId });
      }
    });

    s.on("disconnect", () => {
      setIsConnected(false);
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
        await peerConnection.current.setRemoteDescription(
          new RTCSessionDescription(answer)
        );
        setCallStatus("connected");
      }
    });

    s.on("call:ice-candidate", async ({ candidate }) => {
      if (peerConnection.current) {
        await peerConnection.current.addIceCandidate(
          new RTCIceCandidate(candidate)
        );
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

    return () => {
      s.disconnect();
    };
  }, [chatRoomId, session?.user?.id]);

  const resetCallState = useCallback(() => {
    if (localStream) localStream.getTracks().forEach((t) => t.stop());
    setLocalStream(null);
    setRemoteStream(null);
    setCallStatus("idle");
    setIncomingCall(null);
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }
  }, [localStream]);

  const initiateCall = useCallback(
    async (type: "VOICE" | "VIDEO", otherUserId: string) => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: type === "VIDEO",
        });

        setLocalStream(stream);
        setCallStatus("calling");

        const pc = new RTCPeerConnection({
          iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
        });

        stream.getTracks().forEach((track) =>
          pc.addTrack(track, stream)
        );

        pc.onicecandidate = (e) => {
          if (e.candidate)
            socket?.emit("call:ice-candidate", {
              otherUserId,
              candidate: e.candidate,
            });
        };

        pc.ontrack = (e) => setRemoteStream(e.streams[0]);

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        peerConnection.current = pc;

        socket?.emit("call:initiate", {
          chatRoomId,
          receiverId: otherUserId,
          callType: type,
          offer,
        });
      } catch (err) {
        toast.error("미디어 장치 접근 실패");
      }
    },
    [socket, chatRoomId]
  );

  return {
    socketMessages,
    socket,
    isConnected,
    incomingCall,
    localStream,
    remoteStream,
    callStatus,
    initiateCall,
  };
};