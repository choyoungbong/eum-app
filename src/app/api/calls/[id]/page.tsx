"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { useSocket } from "@/hooks/useSocket";
import { WebRTCManager, detectNetworkType } from "@/lib/webrtc";

type CallStatus = "connecting" | "ringing" | "active" | "ended";

export default function CallPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const callId = params.id as string;

  const { socket } = useSocket();
  const [call, setCall] = useState<any>(null);
  const [callStatus, setCallStatus] = useState<CallStatus>("connecting");
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(false);
  const [networkType, setNetworkType] = useState<string>("WIFI");
  const [duration, setDuration] = useState(0);

  const webrtcRef = useRef<WebRTCManager | null>(null);
  const localAudioRef = useRef<HTMLAudioElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (session && callId) {
      fetchCall();
      initializeWebRTC();
      detectNetwork();
    }

    return () => {
      cleanup();
    };
  }, [session, callId]);

  // Socket.IO 이벤트 리스너
  useEffect(() => {
    if (!socket) return;

    // 통화 수락
    socket.on("call:accepted", async (data: any) => {
      console.log("✅ 통화 수락됨:", data);
      setCallStatus("active");
      startDurationTimer();

      // Answer 적용
      if (webrtcRef.current && data.answer) {
        await webrtcRef.current.setRemoteAnswer(data.answer);
      }
    });

    // 통화 거절
    socket.on("call:rejected", () => {
      console.log("❌ 통화 거절됨");
      alert("상대방이 통화를 거절했습니다");
      handleEndCall();
    });

    // 통화 종료
    socket.on("call:ended", () => {
      console.log("📴 통화 종료됨");
      handleEndCall();
    });

    // ICE Candidate 수신
    socket.on("call:ice-candidate", async (data: any) => {
      console.log("🧊 ICE Candidate 수신:", data);
      if (webrtcRef.current && data.candidate) {
        await webrtcRef.current.addIceCandidate(data.candidate);
      }
    });

    // 수신 통화
    socket.on("call:incoming", async (data: any) => {
      console.log("📞 수신 통화:", data);
      setCallStatus("ringing");
      
      // Offer 적용 및 Answer 생성
      if (webrtcRef.current && data.offer) {
        const answer = await webrtcRef.current.createAnswer(data.offer);
        
        // 서버에 수락 전송은 사용자가 수락 버튼 누를 때
        // Answer는 미리 생성해둠
      }
    });

    return () => {
      socket.off("call:accepted");
      socket.off("call:rejected");
      socket.off("call:ended");
      socket.off("call:ice-candidate");
      socket.off("call:incoming");
    };
  }, [socket]);

  const fetchCall = async () => {
    try {
      const res = await fetch(`/api/calls/${callId}`);
      if (res.ok) {
        const data = await res.json();
        setCall(data.call);

        // 내가 발신자인지 수신자인지 확인
        const isInitiator = data.call.initiatorId === session?.user?.id;
        
        if (isInitiator) {
          setCallStatus("connecting");
        } else {
          setCallStatus("ringing");
        }
      } else {
        alert("통화를 찾을 수 없습니다");
        router.push("/chat");
      }
    } catch (err) {
      console.error("Failed to fetch call:", err);
    }
  };

  const initializeWebRTC = async () => {
    try {
      webrtcRef.current = new WebRTCManager();

      // 로컬 스트림 시작 (음성만)
      const localStream = await webrtcRef.current.startLocalStream({
        audio: true,
        video: false, // 기본은 음성 통화
      });

      // 로컬 오디오 설정
      if (localAudioRef.current) {
        localAudioRef.current.srcObject = localStream;
      }

      // Peer Connection 생성
      webrtcRef.current.createPeerConnection(
        // ICE Candidate 콜백
        (candidate) => {
          if (socket && call) {
            const otherUserId =
              call.initiatorId === session?.user?.id
                ? call.receiverId
                : call.initiatorId;

            socket.emit("call:ice-candidate", {
              otherUserId,
              candidate,
            });
          }
        },
        // Track 수신 콜백 (상대방 스트림)
        (stream) => {
          if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = stream;
          }
        },
        // 연결 상태 변경 콜백
        (state) => {
          console.log("Connection state:", state);
          if (state === "connected") {
            setCallStatus("active");
          } else if (state === "disconnected" || state === "failed") {
            handleEndCall();
          }
        }
      );

      // 발신자인 경우 Offer 생성
      if (call && call.initiatorId === session?.user?.id) {
        const offer = await webrtcRef.current.createOffer();
        
        // Offer를 상대방에게 전송
        if (socket) {
          socket.emit("call:request", {
            receiverId: call.receiverId,
            chatRoomId: call.chatRoomId,
            callType: call.type,
            offer,
          });
        }
      }
    } catch (error) {
      console.error("WebRTC 초기화 실패:", error);
      alert("마이크 권한을 허용해주세요");
      router.push("/chat");
    }
  };

  const detectNetwork = () => {
    const type = detectNetworkType();
    setNetworkType(type);

    // 네트워크 변경 감지
    window.addEventListener("online", () => setNetworkType("WIFI"));
    window.addEventListener("offline", () => setNetworkType("OFFLINE"));
  };

  const startDurationTimer = () => {
    durationIntervalRef.current = setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);
  };

  const handleAcceptCall = async () => {
    try {
      // 서버에 수락 전송
      const res = await fetch(`/api/calls/${callId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept" }),
      });

      if (res.ok) {
        // Answer를 발신자에게 전송
        if (webrtcRef.current && socket && call) {
          const answer = await webrtcRef.current.createAnswer(call.offer);
          
          socket.emit("call:accept", {
            callerId: call.initiatorId,
            answer,
          });
        }

        setCallStatus("active");
        startDurationTimer();
      }
    } catch (error) {
      console.error("통화 수락 실패:", error);
    }
  };

  const handleRejectCall = async () => {
    try {
      await fetch(`/api/calls/${callId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject" }),
      });

      if (socket && call) {
        socket.emit("call:reject", {
          callerId: call.initiatorId,
        });
      }

      cleanup();
      router.push("/chat");
    } catch (error) {
      console.error("통화 거절 실패:", error);
    }
  };

  const handleEndCall = async () => {
    try {
      await fetch(`/api/calls/${callId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "end" }),
      });

      if (socket && call) {
        const otherUserId =
          call.initiatorId === session?.user?.id
            ? call.receiverId
            : call.initiatorId;

        socket.emit("call:end", {
          otherUserId,
        });
      }

      cleanup();
      router.push(`/chat/${call.chatRoomId}`);
    } catch (error) {
      console.error("통화 종료 실패:", error);
    }
  };

  const handleToggleMute = () => {
    if (webrtcRef.current) {
      const muted = webrtcRef.current.toggleMute();
      setIsMuted(muted);
    }
  };

  const cleanup = () => {
    if (webrtcRef.current) {
      webrtcRef.current.close();
    }

    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }

    setCallStatus("ended");
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const getOtherUser = () => {
    if (!call || !session) return null;
    return call.initiatorId === session.user.id ? call.receiver : call.initiator;
  };

  if (status === "loading" || !call) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <p className="text-white">로딩 중...</p>
      </div>
    );
  }

  const otherUser = getOtherUser();

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-900 to-blue-700 flex flex-col items-center justify-center p-4">
      {/* 숨겨진 오디오 엘리먼트 */}
      <audio ref={localAudioRef} autoPlay muted />
      <audio ref={remoteAudioRef} autoPlay />

      {/* 통화 화면 */}
      <div className="max-w-md w-full">
        {/* 상태 표시 */}
        <div className="text-center mb-8">
          <div className="w-32 h-32 mx-auto mb-4 bg-white rounded-full flex items-center justify-center text-6xl">
            👤
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            {otherUser?.name}
          </h1>
          {callStatus === "connecting" && (
            <p className="text-blue-200">연결 중...</p>
          )}
          {callStatus === "ringing" && (
            <p className="text-blue-200 animate-pulse">전화가 왔습니다</p>
          )}
          {callStatus === "active" && (
            <p className="text-blue-200">{formatDuration(duration)}</p>
          )}
        </div>

        {/* 네트워크 상태 */}
        <div className="text-center mb-8">
          <span className="px-3 py-1 bg-blue-800 text-white text-sm rounded-full">
            {networkType === "WIFI" ? "📶 Wi-Fi" : networkType === "CELLULAR" ? "📱 데이터" : "❌ 오프라인"}
          </span>
        </div>

        {/* 컨트롤 버튼 */}
        <div className="flex justify-center gap-4 mb-8">
          {callStatus === "ringing" && call.receiverId === session?.user?.id && (
            <>
              <button
                onClick={handleAcceptCall}
                className="w-16 h-16 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center text-white text-2xl"
              >
                ✓
              </button>
              <button
                onClick={handleRejectCall}
                className="w-16 h-16 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white text-2xl"
              >
                ✕
              </button>
            </>
          )}

          {callStatus === "active" && (
            <>
              <button
                onClick={handleToggleMute}
                className={`w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl ${
                  isMuted ? "bg-red-500" : "bg-gray-600 hover:bg-gray-700"
                }`}
              >
                {isMuted ? "🔇" : "🎤"}
              </button>
              <button
                onClick={handleEndCall}
                className="w-16 h-16 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white text-2xl"
              >
                📞
              </button>
            </>
          )}

          {(callStatus === "connecting" || (callStatus === "ringing" && call.initiatorId === session?.user?.id)) && (
            <button
              onClick={handleEndCall}
              className="w-16 h-16 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white text-2xl"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    </div>
  );
}