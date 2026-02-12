import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";

// 통화 상태 업데이트 (수락/거절/종료)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: "인증이 필요합니다" },
        { status: 401 }
      );
    }

    const callId = params.id;
    const body = await request.json();
    const { action } = body; // "accept", "reject", "end"

    // 통화 조회
    const call = await prisma.call.findUnique({
      where: { id: callId },
      include: {
        chatRoom: true,
      },
    });

    if (!call) {
      return NextResponse.json(
        { error: "통화를 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    // 권한 확인 (발신자 또는 수신자만)
    if (call.initiatorId !== session.user.id && call.receiverId !== session.user.id) {
      return NextResponse.json(
        { error: "권한이 없습니다" },
        { status: 403 }
      );
    }

    let updatedCall;
    let systemMessage = "";

    switch (action) {
      case "accept":
        // 수신자만 수락 가능
        if (call.receiverId !== session.user.id) {
          return NextResponse.json(
            { error: "수신자만 통화를 수락할 수 있습니다" },
            { status: 403 }
          );
        }

        updatedCall = await prisma.call.update({
          where: { id: callId },
          data: {
            status: "ACCEPTED",
            startedAt: new Date(),
          },
        });
        systemMessage = "통화가 시작되었습니다.";
        break;

      case "reject":
        // 수신자만 거절 가능
        if (call.receiverId !== session.user.id) {
          return NextResponse.json(
            { error: "수신자만 통화를 거절할 수 있습니다" },
            { status: 403 }
          );
        }

        updatedCall = await prisma.call.update({
          where: { id: callId },
          data: {
            status: "REJECTED",
            endedAt: new Date(),
          },
        });
        systemMessage = "통화가 거절되었습니다.";
        break;

      case "end":
        // 발신자 또는 수신자 둘 다 종료 가능
        const endedAt = new Date();
        const duration = call.startedAt
          ? Math.floor((endedAt.getTime() - call.startedAt.getTime()) / 1000)
          : 0;

        updatedCall = await prisma.call.update({
          where: { id: callId },
          data: {
            status: "ENDED",
            endedAt,
            duration,
          },
        });

        if (duration > 0) {
          const minutes = Math.floor(duration / 60);
          const seconds = duration % 60;
          systemMessage = `통화가 종료되었습니다. (${minutes}분 ${seconds}초)`;
        } else {
          systemMessage = "통화가 종료되었습니다.";
        }
        break;

      default:
        return NextResponse.json(
          { error: "잘못된 액션입니다" },
          { status: 400 }
        );
    }

    // 시스템 메시지 생성
    if (systemMessage) {
      await prisma.chatMessage.create({
        data: {
          chatRoomId: call.chatRoomId,
          senderId: session.user.id,
          type: "CALL_LOG",
          callId: call.id,
          content: systemMessage,
        },
      });
    }

    return NextResponse.json({
      message: systemMessage,
      call: updatedCall,
    });
  } catch (error) {
    console.error("Call update error:", error);
    return NextResponse.json(
      { error: "통화 업데이트 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

// 통화 상세 조회
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: "인증이 필요합니다" },
        { status: 401 }
      );
    }

    const callId = params.id;

    const call = await prisma.call.findUnique({
      where: { id: callId },
      include: {
        initiator: {
          select: {
            id: true,
            name: true,
            isOnline: true,
          },
        },
        receiver: {
          select: {
            id: true,
            name: true,
            isOnline: true,
          },
        },
        chatRoom: true,
      },
    });

    if (!call) {
      return NextResponse.json(
        { error: "통화를 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    // 권한 확인
    if (call.initiatorId !== session.user.id && call.receiverId !== session.user.id) {
      return NextResponse.json(
        { error: "권한이 없습니다" },
        { status: 403 }
      );
    }

    return NextResponse.json({ call });
  } catch (error) {
    console.error("Call fetch error:", error);
    return NextResponse.json(
      { error: "통화 조회 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}