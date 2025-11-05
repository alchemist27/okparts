import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { collection, getDocs, doc, getDoc, updateDoc, addDoc } from "firebase/firestore";
import type { UserNotification, NotificationLog } from "@/lib/types/notifications";
import { getSmsTemplate, checkMessageLength } from "@/lib/sms-templates";

// 키워드 매칭 함수
function matchKeywords(productName: string, keywords: string[]): string[] {
  const matched: string[] = [];
  const lowerProductName = productName.toLowerCase();

  for (const keyword of keywords) {
    const lowerKeyword = keyword.toLowerCase().trim();
    if (lowerProductName.includes(lowerKeyword)) {
      matched.push(keyword);
    }
  }

  return matched;
}

// SMS 발송 함수 (실제 카페24 API 또는 Mock)
async function sendSMS(
  phone: string,
  productName: string,
  keywords: string[],
  cafe24Client?: any,
  productNo?: string
): Promise<boolean> {
  // 템플릿을 사용하여 메시지 생성
  const mallId = process.env.NEXT_PUBLIC_CAFE24_MALL_ID || "okayparts";
  const message = getSmsTemplate("basic", {
    keywords,
    productName,
    productNo,
    mallId,
  });

  // 메시지 길이 체크
  const messageCheck = checkMessageLength(message);
  console.log(`[SMS] 메시지 타입: ${messageCheck.type}, 길이: ${messageCheck.length}byte`);

  if (!messageCheck.isValid) {
    console.error(`[SMS] 메시지가 너무 깁니다: ${messageCheck.length}byte`);
    throw new Error(`메시지 길이 초과: ${messageCheck.length}byte`);
  }

  // 환경변수에서 발신자 번호 ID 확인
  const senderNo = process.env.CAFE24_SMS_SENDER_NO;

  if (!senderNo || !cafe24Client) {
    // Mock 모드 (환경변수 없거나 클라이언트 없음)
    console.log("\n📱 ========== [SMS Mock 발송] ==========");
    console.log(`📞 수신자: ${phone}`);
    console.log(`🚗 상품명: ${productName}`);
    console.log(`🔑 매칭 키워드: ${keywords.join(", ")}`);
    console.log(`💬 메시지 내용:`);
    console.log(`   ${message}`);
    console.log(`⚠️  Mock 모드: CAFE24_SMS_SENDER_NO 환경변수가 설정되지 않았습니다`);
    console.log("========================================\n");
    return true;
  }

  // 실제 SMS 발송
  try {
    console.log("\n📱 ========== [실제 SMS 발송] ==========");
    console.log(`📞 수신자: ${phone}`);
    console.log(`🚗 상품명: ${productName}`);
    console.log(`🔑 매칭 키워드: ${keywords.join(", ")}`);
    console.log(`💬 메시지 내용:`);
    console.log(`   ${message}`);

    const result = await cafe24Client.sendSMS({
      sender_no: senderNo,
      recipients: [phone],
      content: message,
      type: messageCheck.type, // SMS 또는 LMS 자동 선택
    });

    console.log(`✅ SMS 발송 성공:`, result);
    console.log("========================================\n");
    return true;
  } catch (error: any) {
    console.error("\n❌ ========== [SMS 발송 실패] ==========");
    console.error(`에러 메시지: ${error.message}`);
    console.error("=========================================\n");
    throw error;
  }
}

// 테스트용 Webhook 처리 (Mock 데이터 사용)
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  console.log("\n========== [Webhook Test] 테스트 시작 ==========");

  try {
    // Request body에서 테스트 상품명 받기 (옵션)
    let body: any = {};
    try {
      body = await request.json();
    } catch (e) {
      // body 없으면 기본값 사용
    }

    const testProductName = body.productName || "현대 쏘렌토 2023년식 헤드라이트 좌측";
    const testProductNo = body.productNo || "999999";

    console.log("[Webhook Test] Mock 상품 데이터:");
    console.log(`  - 상품 번호: ${testProductNo}`);
    console.log(`  - 상품명: ${testProductName}`);

    // 1. 모든 사용자 키워드 조회
    console.log("\n[Webhook Test] Step 1: 등록된 사용자 조회");
    const usersRef = collection(db, "users_notifications");
    const usersSnapshot = await getDocs(usersRef);

    console.log(`[Webhook Test] 등록된 사용자 수: ${usersSnapshot.docs.length}명`);

    if (usersSnapshot.docs.length === 0) {
      console.log("[Webhook Test] 등록된 사용자 없음 - 종료");
      return NextResponse.json({
        success: false,
        message: "등록된 사용자가 없습니다",
      });
    }

    // 사용자 목록 출력
    console.log("[Webhook Test] 등록된 사용자 목록:");
    usersSnapshot.docs.forEach((doc, index) => {
      const userData = doc.data() as UserNotification;
      console.log(`  ${index + 1}. ${userData.name} (${userData.phone})`);
      console.log(`     키워드: ${userData.keywords.join(", ")}`);
      console.log(`     수신동의: ${userData.consent_sms ? "✅" : "❌"}`);
    });

    // 1-1. 카페24 API 클라이언트 초기화 (SMS 발송용)
    let cafe24Client: any = null;
    const senderNo = process.env.CAFE24_SMS_SENDER_NO;

    if (senderNo) {
      try {
        console.log("\n[Webhook Test] Step 1-1: 카페24 API 클라이언트 초기화");
        const { Cafe24ApiClient } = await import("@/lib/cafe24");
        const mallId = process.env.NEXT_PUBLIC_CAFE24_MALL_ID;

        if (mallId) {
          const installDocRef = doc(db, "installs", mallId);
          const installDoc = await getDoc(installDocRef);

          if (installDoc.exists()) {
            const installData = installDoc.data();

            const onTokenRefresh = async (newAccessToken: string, newRefreshToken: string, expiresAt: string) => {
              await updateDoc(installDocRef, {
                accessToken: newAccessToken,
                refreshToken: newRefreshToken,
                expiresAt: expiresAt,
                updatedAt: new Date().toISOString(),
              });
            };

            cafe24Client = new Cafe24ApiClient(mallId, installData.accessToken, {
              refreshToken: installData.refreshToken,
              clientId: process.env.CAFE24_CLIENT_ID,
              clientSecret: process.env.CAFE24_CLIENT_SECRET,
              onTokenRefresh,
            });

            console.log("[Webhook Test] 카페24 클라이언트 초기화 성공 (실제 SMS 발송 모드)");
          }
        }
      } catch (error: any) {
        console.error("[Webhook Test] 카페24 클라이언트 초기화 실패:", error.message);
        console.log("[Webhook Test] Mock 모드로 진행합니다");
      }
    } else {
      console.log("[Webhook Test] CAFE24_SMS_SENDER_NO 없음 - Mock 모드로 진행");
    }

    // 2. 키워드 매칭 및 SMS 발송
    console.log("\n[Webhook Test] Step 2: 키워드 매칭 및 SMS 발송");
    const matchedUsers: Array<{ phone: string; name: string; keywords: string[] }> = [];
    const sentPhones: string[] = [];
    const skippedUsers: Array<{ phone: string; reason: string }> = [];

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data() as UserNotification;

      // SMS 수신 동의 확인
      if (!userData.consent_sms) {
        console.log(`\n❌ [${userData.name}] 건너뛰기: 수신 동의 안함`);
        skippedUsers.push({ phone: userData.phone, reason: "수신 동의 안함" });
        continue;
      }

      // 키워드 매칭
      const matchedKeywords = matchKeywords(testProductName, userData.keywords);

      if (matchedKeywords.length === 0) {
        console.log(`\n⚪ [${userData.name}] 건너뛰기: 매칭 키워드 없음`);
        console.log(`   등록 키워드: ${userData.keywords.join(", ")}`);
        skippedUsers.push({ phone: userData.phone, reason: "매칭 키워드 없음" });
        continue;
      }

      console.log(`\n✅ [${userData.name}] 매칭 성공!`);
      console.log(`   매칭된 키워드: ${matchedKeywords.join(", ")}`);

      // 중복 발송 체크
      const alreadySent = userData.last_notified[testProductNo];
      if (alreadySent) {
        console.log(`   ⚠️  이미 발송됨: ${alreadySent}`);
        skippedUsers.push({ phone: userData.phone, reason: `이미 발송 (${alreadySent})` });
        continue;
      }

      // SMS 발송
      try {
        const success = await sendSMS(userData.phone, testProductName, matchedKeywords, cafe24Client, testProductNo);

        if (success) {
          matchedUsers.push({
            phone: userData.phone,
            name: userData.name,
            keywords: matchedKeywords,
          });
          sentPhones.push(userData.phone);

          // Firestore에 발송 이력 저장
          const userDocRef = doc(db, "users_notifications", userData.phone);
          await updateDoc(userDocRef, {
            [`last_notified.${testProductNo}`]: new Date().toISOString(),
          });

          console.log(`   ✅ SMS 발송 성공 및 이력 저장 완료`);
        }
      } catch (smsError: any) {
        console.error(`   ❌ SMS 발송 실패:`, smsError.message);
        skippedUsers.push({ phone: userData.phone, reason: `발송 실패: ${smsError.message}` });
      }
    }

    // 3. 로그 저장
    console.log("\n[Webhook Test] Step 3: 처리 로그 저장");
    const logData: NotificationLog = {
      webhook_event_id: `test_${Date.now()}`,
      product_no: testProductNo,
      product_name: testProductName,
      matched_keywords: matchedUsers.flatMap((u) => u.keywords),
      sent_to: sentPhones,
      processed_at: new Date().toISOString(),
      success: true,
    };

    const logsRef = collection(db, "notification_logs");
    const logDoc = await addDoc(logsRef, logData);
    console.log(`[Webhook Test] 로그 저장 완료: ${logDoc.id}`);

    // 4. 결과 요약
    const elapsed = Date.now() - startTime;
    console.log("\n========== [Webhook Test] 테스트 결과 요약 ==========");
    console.log(`⏱️  처리 시간: ${elapsed}ms`);
    console.log(`👥 전체 사용자: ${usersSnapshot.docs.length}명`);
    console.log(`✅ SMS 발송 성공: ${sentPhones.length}명`);
    console.log(`❌ 건너뛴 사용자: ${skippedUsers.length}명`);

    if (matchedUsers.length > 0) {
      console.log("\n📤 발송 성공 목록:");
      matchedUsers.forEach((user, index) => {
        console.log(`  ${index + 1}. ${user.name} (${user.phone})`);
        console.log(`     키워드: ${user.keywords.join(", ")}`);
      });
    }

    if (skippedUsers.length > 0) {
      console.log("\n⏭️  건너뛴 사용자 목록:");
      skippedUsers.forEach((user, index) => {
        console.log(`  ${index + 1}. ${user.phone} - ${user.reason}`);
      });
    }

    console.log("====================================================\n");

    return NextResponse.json({
      success: true,
      message: `테스트 완료: ${sentPhones.length}명에게 발송`,
      data: {
        processing_time_ms: elapsed,
        total_users: usersSnapshot.docs.length,
        sent_count: sentPhones.length,
        skipped_count: skippedUsers.length,
        matched_users: matchedUsers,
        skipped_users: skippedUsers,
        log_id: logDoc.id,
      },
    });
  } catch (error: any) {
    const elapsed = Date.now() - startTime;
    console.error("\n========== [Webhook Test] 에러 발생 ==========");
    console.error("[Webhook Test] 에러 메시지:", error.message);
    console.error("[Webhook Test] 에러 스택:", error.stack);
    console.error(`[Webhook Test] 실패 시간: ${elapsed}ms`);
    console.error("==============================================\n");

    return NextResponse.json(
      {
        success: false,
        message: "테스트 실패",
        error: error.message,
      },
      { status: 500 }
    );
  }
}

// GET 요청으로 간단한 정보 확인
export async function GET(request: NextRequest) {
  console.log("[Webhook Test] GET 요청 - 사용자 통계 조회");

  try {
    const usersRef = collection(db, "users_notifications");
    const usersSnapshot = await getDocs(usersRef);

    const users = usersSnapshot.docs.map((doc) => {
      const data = doc.data() as UserNotification;
      return {
        phone: data.phone,
        name: data.name,
        keywords: data.keywords,
        consent_sms: data.consent_sms,
      };
    });

    return NextResponse.json({
      status: "ok",
      total_users: users.length,
      users: users,
      test_endpoint: "/api/webhook/test",
      usage: "POST /api/webhook/test with optional body: { productName: string, productNo: string }",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error.message,
      },
      { status: 500 }
    );
  }
}
