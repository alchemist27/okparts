import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { doc, setDoc, getDoc } from "firebase/firestore";
import type {
  RegisterNotificationRequest,
  RegisterNotificationResponse,
  UserNotification,
} from "@/lib/types/notifications";

// 전화번호 형식 검증 (한국 휴대폰 번호)
function validatePhoneNumber(phone: string): boolean {
  // 하이픈 제거
  const cleaned = phone.replace(/-/g, "");
  // 010, 011, 016, 017, 018, 019로 시작하는 10-11자리 숫자
  const phoneRegex = /^01[0-9]\d{7,8}$/;
  return phoneRegex.test(cleaned);
}

// 전화번호 정규화 (하이픈 제거)
function normalizePhoneNumber(phone: string): string {
  return phone.replace(/-/g, "");
}

// 키워드 등록 API
export async function POST(request: NextRequest) {
  console.log("\n========== [Notification Register] 키워드 등록 시작 ==========");

  try {
    // Request body 파싱
    const body: RegisterNotificationRequest = await request.json();
    const { phone, name, keywords, consent_sms } = body;

    console.log("[Notification Register] 요청 데이터:", {
      phone,
      name,
      keywordCount: keywords?.length,
      consent_sms,
    });

    // 필수 필드 검증
    if (!phone || !name || !keywords || consent_sms === undefined) {
      console.error("[Notification Register] 필수 필드 누락");
      return NextResponse.json(
        {
          success: false,
          message: "필수 필드가 누락되었습니다 (phone, name, keywords, consent_sms)",
        } as RegisterNotificationResponse,
        { status: 400 }
      );
    }

    // 전화번호 형식 검증
    if (!validatePhoneNumber(phone)) {
      console.error("[Notification Register] 잘못된 전화번호 형식:", phone);
      return NextResponse.json(
        {
          success: false,
          message: "올바른 휴대폰 번호를 입력해주세요 (예: 010-1234-5678)",
        } as RegisterNotificationResponse,
        { status: 400 }
      );
    }

    // 키워드 검증
    if (!Array.isArray(keywords) || keywords.length === 0) {
      console.error("[Notification Register] 키워드가 없음");
      return NextResponse.json(
        {
          success: false,
          message: "최소 1개의 키워드를 입력해주세요",
        } as RegisterNotificationResponse,
        { status: 400 }
      );
    }

    if (keywords.length > 10) {
      console.error("[Notification Register] 키워드 개수 초과:", keywords.length);
      return NextResponse.json(
        {
          success: false,
          message: "키워드는 최대 10개까지 등록 가능합니다",
        } as RegisterNotificationResponse,
        { status: 400 }
      );
    }

    // 키워드 중복 제거 및 공백 제거
    const cleanedKeywords = Array.from(
      new Set(keywords.map((k) => k.trim()).filter((k) => k.length > 0))
    );

    if (cleanedKeywords.length === 0) {
      console.error("[Notification Register] 유효한 키워드 없음");
      return NextResponse.json(
        {
          success: false,
          message: "유효한 키워드를 입력해주세요",
        } as RegisterNotificationResponse,
        { status: 400 }
      );
    }

    // SMS 수신 동의 확인
    if (!consent_sms) {
      console.error("[Notification Register] SMS 수신 동의 안함");
      return NextResponse.json(
        {
          success: false,
          message: "SMS 수신 동의가 필요합니다",
        } as RegisterNotificationResponse,
        { status: 400 }
      );
    }

    // 전화번호 정규화 (Document ID로 사용)
    const normalizedPhone = normalizePhoneNumber(phone);

    // 기존 데이터 확인
    const userDocRef = doc(db, "users_notifications", normalizedPhone);
    const existingDoc = await getDoc(userDocRef);

    const now = new Date().toISOString();

    if (existingDoc.exists()) {
      // 기존 사용자 업데이트
      const existingData = existingDoc.data() as UserNotification;

      console.log("[Notification Register] 기존 사용자 업데이트:", normalizedPhone);

      const updatedData: UserNotification = {
        ...existingData,
        name,
        keywords: cleanedKeywords,
        consent_sms,
        updatedAt: now,
      };

      await setDoc(userDocRef, updatedData);

      console.log("[Notification Register] 업데이트 성공");
      console.log("========== [Notification Register] 키워드 등록 완료 ==========\n");

      return NextResponse.json(
        {
          success: true,
          message: "키워드가 업데이트되었습니다",
          data: updatedData,
        } as RegisterNotificationResponse,
        { status: 200 }
      );
    } else {
      // 새 사용자 생성
      console.log("[Notification Register] 새 사용자 생성:", normalizedPhone);

      const newData: UserNotification = {
        phone: normalizedPhone,
        name,
        keywords: cleanedKeywords,
        consent_sms,
        last_notified: {},
        createdAt: now,
      };

      await setDoc(userDocRef, newData);

      console.log("[Notification Register] 생성 성공");
      console.log("========== [Notification Register] 키워드 등록 완료 ==========\n");

      return NextResponse.json(
        {
          success: true,
          message: "키워드가 등록되었습니다",
          data: newData,
        } as RegisterNotificationResponse,
        { status: 201 }
      );
    }
  } catch (error: any) {
    console.error("\n========== [Notification Register] 에러 발생 ==========");
    console.error("[Notification Register] 에러 메시지:", error.message);
    console.error("[Notification Register] 에러 스택:", error.stack);
    console.error("=======================================================\n");

    return NextResponse.json(
      {
        success: false,
        message: "키워드 등록에 실패했습니다",
      } as RegisterNotificationResponse,
      { status: 500 }
    );
  }
}
