"use client";

import { memo } from "react";

interface Message {
  id?: string;
  content?: string;
  type?: string;
  createdAt?: string;
  senderId?: string;
  userId?: string;
  sender?: { id: string; name: string };
  file?: { url: string; originalName?: string; name?: string };
}

interface MessageBubbleProps {
  msg: Message;
  isMe: boolean;
  senderName: string;
  showDateDivider: boolean;
  dateLabel: string;
}

// ✅ React.memo — props가 바뀌지 않으면 리렌더링 완전 차단
// 새 메시지가 와도 기존 메시지 버블은 전혀 재렌더링되지 않음
const MessageBubble = memo(function MessageBubble({
  msg,
  isMe,
  senderName,
  showDateDivider,
  dateLabel,
}: MessageBubbleProps) {
  const timeStr = (() => {
    if (!msg.createdAt) return "";
    const date = new Date(msg.createdAt);
    return isNaN(date.getTime())
      ? ""
      : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  })();

  return (
    <>
      {/* 날짜 구분선 */}
      {showDateDivider && (
        <div className="flex items-center gap-2 my-4">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400 px-2">{dateLabel}</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>
      )}

      <div className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
        <div className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
          {!isMe && (
            <span className="text-[10px] text-gray-400 mb-1 ml-1">{senderName}</span>
          )}
          <div
            className={`p-3 px-4 rounded-2xl max-w-[80vw] sm:max-w-[60%] text-[14px] shadow-sm ${
              isMe
                ? "bg-blue-600 text-white rounded-tr-none"
                : "bg-white border border-gray-200 text-black rounded-tl-none"
            }`}
          >
            {msg.type === "FILE" && msg.file ? (
              <a
                href={msg.file.url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                📎 {msg.file.originalName || msg.file.name}
              </a>
            ) : (
              <p className="whitespace-pre-wrap break-words">{msg.content}</p>
            )}
            <div
              className={`text-[9px] mt-1 opacity-60 ${isMe ? "text-right" : "text-left"}`}
            >
              {timeStr}
            </div>
          </div>
        </div>
      </div>
    </>
  );
});

export default MessageBubble;
