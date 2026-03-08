"use client";
// src/app/chat/[id]/page.tsx

import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useRef, useCallback } from "react";
import { useChatRoom } from "@/hooks/useSocket";
import { toast } from "@/components/Toast";

const MESSAGE_LIMIT = 30;

export default function ChatRoomPage() {

  const { data: session } = useSession();
  const params = useParams();
  const router = useRouter();
  const chatRoomId = typeof params?.id === "string" ? params.id : "";

  const [allMessages,setAllMessages]=useState<any[]>([]);
  const [chatRoom,setChatRoom]=useState<any>(null);
  const [input,setInput]=useState("");
  const [isSending,setIsSending]=useState(false);
  const [isInitialLoading,setIsInitialLoading]=useState(true);
  const [isLoadingMore,setIsLoadingMore]=useState(false);
  const [hasMore,setHasMore]=useState(true);

  const oldestDateRef=useRef<string|null>(null);

  const scrollRef=useRef<HTMLDivElement>(null);
  const bottomRef=useRef<HTMLDivElement>(null);
  const shouldScrollBottom=useRef(true);
  const topSentinelRef=useRef<HTMLDivElement>(null);

  const localVideoRef=useRef<HTMLVideoElement>(null);
  const remoteVideoRef=useRef<HTMLVideoElement>(null);
  const remoteAudioRef=useRef<HTMLAudioElement>(null);

  const [audioMuted,setAudioMuted]=useState(false);
  const [cameraOff,setCameraOff]=useState(false);
  const [currentCallType,setCurrentCallType]=useState<"VOICE"|"VIDEO">("VOICE");

  const [callTimer,setCallTimer]=useState(0);
  const callTimerRef=useRef<NodeJS.Timeout|null>(null);

  const {
    socket,
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
  } = useChatRoom(chatRoomId);

  // ─────────────────────────────
  // 🔧 PATCH
  // stream 연결 안정화
  // ─────────────────────────────

  useEffect(()=>{

    if(localVideoRef.current && localStream){
      localVideoRef.current.srcObject = localStream
      localVideoRef.current.muted = true
      localVideoRef.current.play().catch(()=>{})
    }

  },[localStream])

  useEffect(()=>{

    if(!remoteStream) return

    if(remoteVideoRef.current){
      remoteVideoRef.current.srcObject = remoteStream
      remoteVideoRef.current.playsInline = true
      remoteVideoRef.current.autoplay = true
      remoteVideoRef.current.play().catch(()=>{})
    }

    if(remoteAudioRef.current){
      remoteAudioRef.current.srcObject = remoteStream
      remoteAudioRef.current.autoplay = true
      remoteAudioRef.current.play().catch(()=>{})
    }

  },[remoteStream])

  // ─────────────────────────────
  // 🔧 PATCH
  // call cleanup
  // ─────────────────────────────

  useEffect(()=>{

    if(callStatus==="ended"){

      if(remoteVideoRef.current)
        remoteVideoRef.current.srcObject=null

      if(remoteAudioRef.current)
        remoteAudioRef.current.srcObject=null

      if(localVideoRef.current)
        localVideoRef.current.srcObject=null

    }

  },[callStatus])

  // ─────────────────────────────
  // 🔧 PATCH
  // 페이지 unmount cleanup
  // ─────────────────────────────

  useEffect(()=>{

    return ()=>{

      if(localVideoRef.current)
        localVideoRef.current.srcObject=null

      if(remoteVideoRef.current)
        remoteVideoRef.current.srcObject=null

      if(remoteAudioRef.current)
        remoteAudioRef.current.srcObject=null

    }

  },[])

  // ─────────────────────────────
  // 기존 메시지 로딩
  // ─────────────────────────────

  useEffect(()=>{

    if(!chatRoomId) return

    let cancelled=false

    Promise.all([
      fetch(`/api/chat/rooms/${chatRoomId}/messages?limit=${MESSAGE_LIMIT}`),
      fetch(`/api/chat/rooms/${chatRoomId}`)
    ]).then(async([msgRes,roomRes])=>{

      if(cancelled) return

      if(msgRes.ok){
        const d=await msgRes.json()
        const msgs=d.messages||[]

        setAllMessages(msgs)

        if(msgs.length>0)
          oldestDateRef.current=msgs[0].createdAt

        setHasMore(msgs.length===MESSAGE_LIMIT)
      }

      if(roomRes.ok){
        const r=await roomRes.json()
        setChatRoom(r.chatRoom)
      }

    }).catch(console.error)
    .finally(()=>{
      if(!cancelled)
        setIsInitialLoading(false)
    })

    return ()=>{cancelled=true}

  },[chatRoomId])

  // ─────────────────────────────
  // 메시지 realtime
  // ─────────────────────────────

  useEffect(()=>{

    if(!socketMessages.length) return

    const msg=socketMessages[socketMessages.length-1]

    setAllMessages(p=>
      p.some(m=>m.id===msg.id)?p:[...p,msg]
    )

    shouldScrollBottom.current=true

  },[socketMessages])

  // ─────────────────────────────
  // 자동 스크롤
  // ─────────────────────────────

  useEffect(()=>{

    if(shouldScrollBottom.current){

      bottomRef.current?.scrollIntoView({
        behavior:"smooth"
      })

      shouldScrollBottom.current=false
    }

  },[allMessages])

  // ─────────────────────────────
  // 통화 타입 동기화
  // ─────────────────────────────

  useEffect(()=>{

    if(incomingCall?.callType)
      setCurrentCallType(incomingCall.callType)

  },[incomingCall])

  // ─────────────────────────────
  // 통화 타이머
  // ─────────────────────────────

  useEffect(()=>{

    if(callStatus==="connected"){

      setCallTimer(0)

      callTimerRef.current=setInterval(()=>{
        setCallTimer(t=>t+1)
      },1000)

    }else{

      if(callTimerRef.current)
        clearInterval(callTimerRef.current)

      callTimerRef.current=null
      setCallTimer(0)
    }

    return ()=>{
      if(callTimerRef.current)
        clearInterval(callTimerRef.current)
    }

  },[callStatus])

  // ─────────────────────────────
  // 통화 실행
  // ─────────────────────────────

  const handleCall=(type:"VOICE"|"VIDEO")=>{

    if(!chatRoom) return

    const other=chatRoom.members?.find(
      (m:any)=>m.user?.id!==session?.user?.id
    )

    if(!other?.user?.id) return

    setCurrentCallType(type)

    initiateCall(type,other.user.id)

  }

  // ─────────────────────────────
  // UI 계산
  // ─────────────────────────────

  const isDirect=chatRoom?.type==="DIRECT"

  const otherMember=isDirect
    ? chatRoom?.members?.find(
        (m:any)=>m.user.id!==session?.user?.id
      )
    : null

  const roomName=isDirect
    ? otherMember?.user?.name || "채팅"
    : chatRoom?.name || "그룹 채팅"

  const roomInitial=roomName[0]?.toUpperCase()||"?"

  const isVideoCall=currentCallType==="VIDEO"

  const isInCall=[
    "calling",
    "connected",
    "incoming",
    "ended"
  ].includes(callStatus)

  // ─────────────────────────────
  // 렌더
  // ─────────────────────────────

  return (

    <div className="flex flex-col h-screen bg-gray-50 dark:bg-zinc-950 overflow-hidden">

      {/* 기존 UI 그대로 유지 */}

      {/* ... 중간 메시지 UI 그대로 ... */}

      {isInCall && (

        <div className="fixed inset-0 z-[100] bg-zinc-950/98 flex flex-col items-center justify-between p-6 pb-12">

          <audio ref={remoteAudioRef} autoPlay playsInline className="hidden"/>

          {!isVideoCall && (
            <video ref={remoteVideoRef} autoPlay playsInline className="hidden"/>
          )}

          {!isVideoCall && (
            <video ref={localVideoRef} autoPlay playsInline muted className="hidden"/>
          )}

          {/* 통화 UI 그대로 유지 */}

          <div className="flex gap-6">

            <button
              onClick={()=>setAudioMuted(toggleMute())}
              className="w-14 h-14 bg-white/15 text-white rounded-full"
            >
              {audioMuted?"🔇":"🎤"}
            </button>

            {isVideoCall && (
              <button
                onClick={()=>setCameraOff(toggleCamera())}
                className="w-14 h-14 bg-white/15 text-white rounded-full"
              >
                {cameraOff?"📷":"📹"}
              </button>
            )}

            <button
              onClick={endCall}
              className="w-20 h-20 bg-red-500 text-white rounded-full"
            >
              종료
            </button>

          </div>

        </div>
      )}

    </div>
  )
}