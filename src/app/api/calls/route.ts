import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendCallNotification } from "@/lib/fcm";

// 통화 요청 생성
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: "인증이 필요합니다" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { chatRoomId, receiverId, callType } = body;

    if (!chatRoomId || !receiverId || !callType) {
      return NextResponse.json(
        { error: "필수 정보가 누락되었습니다" },
        { status: 400 }
      );
    }

    // 채팅방 멤버십 확인
    const membership = await prisma.chatRoomMember.findFirst({
      where: {
        chatRoomId,
        userId: session.user.id,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "채팅방에 참여하지 않았습니다" },
        { status: 403 }
      );
    }

    // 수신자 정보 조회 — fcmToken 불필요 (sendPushToUser가 내부에서 조회)
    const receiver = await prisma.user.findUnique({
      where: { id: receiverId },
      select: {
        id: true,
        name: true,
        isOnline: true,
      },
    });

    if (!receiver) {
      return NextResponse.json(
        { error: "수신자를 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    // 통화 기록 생성
    const call = await prisma.call.create({
      data: {
        chatRoomId,
        initiatorId: session.user.id,
        receiverId,
        type: callType,
        status: "PENDING",
      },
    });

    // FCM 푸시 알림 전송 — userId 기준으로 모든 기기에 전송
    try {
      const pushResult = await sendCallNotification(
        receiverId,
        session.user.name || "사용자",
        callType,
        call.id,
        chatRoomId
      );

      if (pushResult.success) {
        console.log(`✅ 통화 푸시 성공: ${receiver.name} (${receiver.isOnline ? "Online" : "Offline"})`);
      } else {
        console.error(`❌ 통화 푸시 실패: ${pushResult.error}`);
      }
    } catch (error) {
      console.error(`❌ 통화 푸시 예외 (${receiver.name}):`, error);
    }

    return NextResponse.json(
      {
        message: "통화 요청이 전송되었습니다",
        call,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Call request error:", error);
    return NextResponse.json(
      { error: "통화 요청 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

// 활성 통화 조회
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: "인증이 필요합니다" },
        { status: 401 }
      );
    }

    const activeCalls = await prisma.call.findMany({
      where: {
        OR: [
          { initiatorId: session.user.id },
          { receiverId: session.user.id },
        ],
        status: { in: ["PENDING", "ACCEPTED"] },
      },
      include: {
        initiator: { select: { id: true, name: true } },
        receiver: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ calls: activeCalls });
  } catch (error) {
    console.error("Active calls fetch error:", error);
    return NextResponse.json(
      { error: "통화 조회 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
