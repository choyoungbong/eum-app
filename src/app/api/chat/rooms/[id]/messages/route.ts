import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendChatMessageNotification, sendFileSharedNotification } from "@/lib/fcm";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

    const chatRoomId = params.id;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const before = searchParams.get("before");

    const messages = await prisma.chatMessage.findMany({
      where: {
        chatRoomId,
        ...(before && { createdAt: { lt: new Date(before) } }),
      },
      include: {
        sender: { select: { id: true, name: true, email: true } },
        file: true,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({ messages: messages.reverse(), hasMore: messages.length === limit });
  } catch (error) {
    return NextResponse.json({ error: "조회 실패" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

    const chatRoomId = params.id;
    const { type, content, fileId } = await request.json();

    // 1. 메시지 생성
    const message = await prisma.chatMessage.create({
      data: {
        chatRoomId,
        senderId: session.user.id,
        type,
        content: type === "TEXT" ? content : null,
        fileId: type === "FILE" ? fileId : null,
      },
      include: {
        sender: { select: { name: true } },
        file: true,
      },
    });

    // 2. 알림 대상 추출 (본인 제외)
    const members = await prisma.chatRoomMember.findMany({
      where: { chatRoomId, userId: { not: session.user.id } },
      include: { user: { select: { name: true, fcmToken: true } } },
    });

    // 3. 채팅방 업데이트
    await prisma.chatRoom.update({
      where: { id: chatRoomId },
      data: { updatedAt: new Date() },
    });

    // 4. FCM 발송 (이곳에서 통합 관리)
    for (const member of members) {
      if (member.user.fcmToken) {
        const result = type === "TEXT" 
          ? await sendChatMessageNotification(member.user.fcmToken, session.user.name || "사용자", content, chatRoomId)
          : await sendFileSharedNotification(member.user.fcmToken, session.user.name || "사용자", message.file?.originalName || "파일", chatRoomId);

        // 로그 출력: 이 메시지가 로그에 두 번 찍히는지 한 번 찍히는지 확인하는 것이 핵심입니다.
        if (result.success) {
          console.log(`🚀 [FCM 전송 성공] 수신: ${member.user.name}, ID: ${result.messageId}`);
        } else {
          console.warn(`❌ [FCM 전송 실패] 수신: ${member.user.name}, 사유: ${result.error}`);
        }
      }
    }

    return NextResponse.json({ data: message }, { status: 201 });
  } catch (error) {
    console.error("전송 에러:", error);
    return NextResponse.json({ error: "전송 실패" }, { status: 500 });
  }
}