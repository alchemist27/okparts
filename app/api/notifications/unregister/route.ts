import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { doc, deleteDoc, getDoc } from "firebase/firestore";
import type {
  UnregisterNotificationRequest,
  UnregisterNotificationResponse,
} from "@/lib/types/notifications";

// 전화번호 정규화 (하이픈 제거)
function normalizePhoneNumber(phone: string): string {
  return phone.replace(/-/g, "");
}

// 키워드 해제 API
export async function DELETE(request: NextRequest) {
  console.log("\n========== [Notification Unregister] 키워드 해제 시작 ==========");

  try {
    // Request body 파싱
    const body: UnregisterNotificationRequest = await request.json();
    const { phone } = body;

    console.log("[Notification Unregister] 요청 데이터:", { phone });

    // 전화번호 필수 확인
    if (!phone) {
      console.error("[Notification Unregister] 전화번호 누락");
      return NextResponse.json(
        {
          success: false,
          message: "전화번호가 필요합니다",
        } as UnregisterNotificationResponse,
        { status: 400 }
      );
    }

    // 전화번호 정규화
    const normalizedPhone = normalizePhoneNumber(phone);

    // Firestore에서 문서 존재 확인
    const userDocRef = doc(db, "users_notifications", normalizedPhone);
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) {
      console.log("[Notification Unregister] 등록된 정보 없음:", normalizedPhone);
      return NextResponse.json(
        {
          success: false,
          message: "등록된 키워드가 없습니다",
        } as UnregisterNotificationResponse,
        { status: 404 }
      );
    }

    // Firestore에서 삭제
    await deleteDoc(userDocRef);

    console.log("[Notification Unregister] 삭제 성공:", normalizedPhone);
    console.log("========== [Notification Unregister] 키워드 해제 완료 ==========\n");

    return NextResponse.json(
      {
        success: true,
        message: "키워드 알림이 해제되었습니다",
      } as UnregisterNotificationResponse,
      { status: 200 }
    );
  } catch (error: any) {
    console.error("\n========== [Notification Unregister] 에러 발생 ==========");
    console.error("[Notification Unregister] 에러 메시지:", error.message);
    console.error("[Notification Unregister] 에러 스택:", error.stack);
    console.error("==========================================================\n");

    return NextResponse.json(
      {
        success: false,
        message: "키워드 해제에 실패했습니다",
      } as UnregisterNotificationResponse,
      { status: 500 }
    );
  }
}
