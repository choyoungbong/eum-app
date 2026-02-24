// src/lib/notification.ts
// 다른 API route에서 import해서 사용하세요.
// 예: 댓글 작성 → createNotification({ userId: post.authorId, type: "COMMENT", ... })

import { prisma } from "@/lib/db";

type NotificationType =
  | "COMMENT"
  | "SHARE"
  | "CHAT"
  | "SYSTEM"
  | "FILE_UPLOAD"
  | "CALL";

interface CreateNotificationInput {
  userId: string;      // 수신자
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;       // 클릭 시 이동할 URL (예: "/posts/abc123")
}

export async function createNotification(input: CreateNotificationInput) {
  try {
    return await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        link: input.link,
      },
    });
  } catch (error) {
    // 알림 생성 실패는 조용히 처리 (주요 기능에 영향 없어야 함)
    console.error("createNotification error:", error);
  }
}

// ──────────────────────────────────────────────
// 사용 예시
// ──────────────────────────────────────────────
//
// [댓글 알림] src/app/api/posts/[id]/comments/route.ts
// await createNotification({
//   userId: post.userId,
//   type: "COMMENT",
//   title: `${commenterName}님이 댓글을 남겼습니다`,
//   body: comment.content.slice(0, 80),
//   link: `/posts/${post.id}`,
// });
//
// [공유 알림] src/app/api/files/[id]/share/route.ts
// await createNotification({
//   userId: targetUserId,
//   type: "SHARE",
//   title: `${ownerName}님이 파일을 공유했습니다`,
//   body: file.originalName,
//   link: `/dashboard`,
// });
//
// [채팅 알림] src/app/api/chat/rooms/[id]/messages 등
// await createNotification({
//   userId: recipientId,
//   type: "CHAT",
//   title: `${senderName}님의 새 메시지`,
//   body: message.content?.slice(0, 80),
//   link: `/chat/${chatRoomId}`,
// });
