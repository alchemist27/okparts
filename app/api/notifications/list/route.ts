import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { doc, getDoc } from "firebase/firestore";
import type {
  ListNotificationResponse,
  UserNotification,
} from "@/lib/types/notifications";

// 전화번호 정규화 (하이픈 제거)
function normalizePhoneNumber(phone: string): string {
  return phone.replace(/-/g, "");
}

// 키워드 조회 API
export async function GET(request: NextRequest) {
  console.log("\n========== [Notification List] 키워드 조회 시작 ==========");

  try {
    // Query parameter에서 전화번호 추출
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get("phone");

    console.log("[Notification List] 조회 요청:", { phone });

    // 전화번호 필수 확인
    if (!phone) {
      console.error("[Notification List] 전화번호 누락");
      return NextResponse.json(
        {
          success: false,
          message: "전화번호가 필요합니다 (query parameter: phone)",
        } as ListNotificationResponse,
        { status: 400 }
      );
    }

    // 전화번호 정규화
    const normalizedPhone = normalizePhoneNumber(phone);

    // Firestore에서 조회
    const userDocRef = doc(db, "users_notifications", normalizedPhone);
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) {
      console.log("[Notification List] 등록된 정보 없음:", normalizedPhone);
      return NextResponse.json(
        {
          success: false,
          message: "등록된 키워드가 없습니다",
        } as ListNotificationResponse,
        { status: 404 }
      );
    }

    const userData = userDoc.data() as UserNotification;

    console.log("[Notification List] 조회 성공:", {
      phone: userData.phone,
      keywordCount: userData.keywords.length,
    });
    console.log("========== [Notification List] 키워드 조회 완료 ==========\n");

    return NextResponse.json(
      {
        success: true,
        data: userData,
      } as ListNotificationResponse,
      { status: 200 }
    );
  } catch (error: any) {
    console.error("\n========== [Notification List] 에러 발생 ==========");
    console.error("[Notification List] 에러 메시지:", error.message);
    console.error("[Notification List] 에러 스택:", error.stack);
    console.error("====================================================\n");

    return NextResponse.json(
      {
        success: false,
        message: "키워드 조회에 실패했습니다",
      } as ListNotificationResponse,
      { status: 500 }
    );
  }
}
