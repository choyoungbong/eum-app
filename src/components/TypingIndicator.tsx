"use client";
// src/components/TypingIndicator.tsx
// 채팅방 하단에 배치 — 상대방 타이핑 시 표시

interface Props {
  typingUserNames: string[]; // useTypingIndicator에서 userId를 이름으로 변환한 배열
}

export default function TypingIndicator({ typingUserNames }: Props) {
  if (typingUserNames.length === 0) return null;

  const label =
    typingUserNames.length === 1
      ? `${typingUserNames[0]}님이 입력 중`
      : `${typingUserNames.slice(0, 2).join(", ")}님이 입력 중`;

  return (
    <div className="flex items-center gap-2 px-4 py-1.5 animate-fade-in">
      {/* 세 점 애니메이션 */}
      <div className="flex items-center gap-0.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-slate-500 animate-bounce"
            style={{ animationDelay: `${i * 0.15}s`, animationDuration: "0.9s" }}
          />
        ))}
      </div>
      <span className="text-xs text-gray-400 dark:text-slate-500 italic">{label}...</span>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// 채팅방 페이지에서 사용 예시
// ──────────────────────────────────────────────────────────
//
// const { typingUserIds, startTyping, stopTyping } = useTypingIndicator(roomId);
//
// // roomMembers: { id, name }[] 형태로 채팅방 멤버 목록
// const typingNames = typingUserIds
//   .filter(id => id !== session.user.id)
//   .map(id => roomMembers.find(m => m.id === id)?.name ?? "사용자");
//
// // 인풋에 이벤트 연결
// <input
//   onChange={(e) => { setValue(e.target.value); startTyping(); }}
//   onBlur={stopTyping}
//   onKeyDown={(e) => { if (e.key === "Enter") stopTyping(); }}
// />
// <TypingIndicator typingUserNames={typingNames} />
