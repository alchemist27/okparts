import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { collection, getDocs, doc, getDoc, updateDoc, addDoc } from "firebase/firestore";
import type { UserNotification, NotificationLog } from "@/lib/types/notifications";
import { getSmsTemplate, checkMessageLength } from "@/lib/sms-templates";

// Promise Queue for sequential webhook processing (Rate Limit 방지)
let processingQueue = Promise.resolve();

// 카페24 Webhook 페이로드 타입
interface Cafe24WebhookPayload {
  event_no: number; // 이벤트 번호 (90001 = 상품 등록)
  resource: {
    mall_id: string;
    event_shop_no: string;
    event_no: number;
    resource_type: string; // "products"
    resource_id: string; // product_no
  };
}

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

// 비동기 Webhook 처리 함수
async function processWebhookAsync(payload: Cafe24WebhookPayload) {
  const startTime = Date.now();
  console.log("\n========== [Webhook Process] 비동기 처리 시작 ==========");

  try {
    // 1. 이벤트 유효성 검증
    if (payload.event_no !== 90001) {
      console.log("[Webhook Process] 무시: 상품 등록 이벤트 아님 (event_no:", payload.event_no, ")");
      return;
    }

    const productNo = payload.resource.resource_id;
    console.log("[Webhook Process] 상품 번호:", productNo);

    // 2. 카페24 API에서 상품 정보 조회
    console.log("[Webhook Process] 카페24 상품 정보 조회 중...");

    // Cafe24 API 클라이언트 초기화
    const { Cafe24ApiClient } = await import("@/lib/cafe24");
    const mallId = process.env.NEXT_PUBLIC_CAFE24_MALL_ID;

    if (!mallId) {
      throw new Error("Mall ID not configured");
    }

    const installDocRef = doc(db, "installs", mallId);
    const installDoc = await getDoc(installDocRef);

    if (!installDoc.exists()) {
      throw new Error("Cafe24 app not installed");
    }

    const installData = installDoc.data();

    const onTokenRefresh = async (newAccessToken: string, newRefreshToken: string, expiresAt: string) => {
      await updateDoc(installDocRef, {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresAt: expiresAt,
        updatedAt: new Date().toISOString(),
      });
    };

    const cafe24Client = new Cafe24ApiClient(mallId, installData.accessToken, {
      refreshToken: installData.refreshToken,
      clientId: process.env.CAFE24_CLIENT_ID,
      clientSecret: process.env.CAFE24_CLIENT_SECRET,
      onTokenRefresh,
    });

    // 상품 정보 조회
    const productResponse = await cafe24Client.getProduct(productNo);
    const product = productResponse.product;
    const productName = product.product_name;

    console.log("[Webhook Process] 상품명:", productName);

    // 3. 모든 사용자 키워드 조회
    console.log("[Webhook Process] 등록된 사용자 키워드 조회 중...");
    const usersRef = collection(db, "users_notifications");
    const usersSnapshot = await getDocs(usersRef);

    console.log("[Webhook Process] 등록된 사용자 수:", usersSnapshot.docs.length);

    if (usersSnapshot.docs.length === 0) {
      console.log("[Webhook Process] 등록된 사용자 없음 - 종료");
      return;
    }

    // 4. 키워드 매칭 및 배치 SMS 발송 (최대 100명)
    const matchedUsers: Array<{ phone: string; keywords: string[] }> = [];
    const sentPhones: string[] = [];

    // 발송 큐 생성
    const sendQueue: Array<{ userData: UserNotification; matchedKeywords: string[] }> = [];

    // 먼저 매칭된 사용자들을 큐에 추가
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data() as UserNotification;

      // SMS 수신 동의 확인
      if (!userData.consent_sms) {
        console.log(`[Webhook Process] 건너뛰기: ${userData.phone} (수신 동의 안함)`);
        continue;
      }

      // 키워드 매칭
      const matchedKeywords = matchKeywords(productName, userData.keywords);

      if (matchedKeywords.length === 0) {
        continue;
      }

      console.log(`[Webhook Process] 매칭 성공: ${userData.phone} - 키워드: ${matchedKeywords.join(", ")}`);

      // 중복 발송 체크
      const alreadySent = userData.last_notified[productNo];
      if (alreadySent) {
        console.log(`[Webhook Process] 건너뛰기: ${userData.phone} (이미 발송됨: ${alreadySent})`);
        continue;
      }

      // 큐에 추가
      sendQueue.push({ userData, matchedKeywords });
    }

    console.log(`[Webhook Process] 발송 큐: ${sendQueue.length}명`);

    // 발송 대상이 없으면 종료
    if (sendQueue.length === 0) {
      console.log("[Webhook Process] 발송 대상 없음 - 종료");
      return;
    }

    // 배치 발송 (카페24 API는 recipients 배열로 최대 100명까지 동시 발송 가능)
    const recipientPhones = sendQueue.map(item => item.userData.phone);

    // 대표 키워드 (첫 번째 사용자의 매칭 키워드 사용 - 모든 사용자에게 동일 메시지 발송)
    const representativeKeywords = sendQueue[0].matchedKeywords;

    // 템플릿을 사용하여 메시지 생성
    const message = getSmsTemplate("basic", {
      keywords: representativeKeywords,
      productName,
      productNo,
      mallId,
    });

    // 메시지 길이 체크
    const messageCheck = checkMessageLength(message);
    console.log(`[Webhook Process] 메시지 타입: ${messageCheck.type}, 길이: ${messageCheck.length}byte`);

    if (!messageCheck.isValid) {
      console.error(`[Webhook Process] 메시지가 너무 깁니다: ${messageCheck.length}byte`);
      throw new Error(`메시지 길이 초과: ${messageCheck.length}byte`);
    }

    // 환경변수에서 발신자 번호 ID 확인
    const senderNo = process.env.CAFE24_SMS_SENDER_NO;

    if (!senderNo) {
      // Mock 모드
      console.log(`[Webhook Process] Mock 모드: ${recipientPhones.length}명에게 발송 예정`);
      console.log(`[Webhook Process] 수신자: ${recipientPhones.join(", ")}`);
      console.log(`[Webhook Process] 메시지: ${message}`);

      // Mock 모드에서도 발송 성공으로 처리
      for (const { userData, matchedKeywords } of sendQueue) {
        matchedUsers.push({
          phone: userData.phone,
          keywords: matchedKeywords,
        });
        sentPhones.push(userData.phone);

        // Firestore에 발송 이력 저장
        const userDocRef = doc(db, "users_notifications", userData.phone);
        await updateDoc(userDocRef, {
          [`last_notified.${productNo}`]: new Date().toISOString(),
        });
      }
    } else {
      // 실제 배치 SMS 발송
      try {
        console.log(`[Webhook Process] 배치 SMS 발송 시작: ${recipientPhones.length}명`);

        const result = await cafe24Client.sendSMS({
          sender_no: senderNo,
          recipients: recipientPhones,
          content: message,
          type: messageCheck.type,
        });

        console.log(`[Webhook Process] 배치 SMS 발송 성공:`, result);

        // 발송 성공한 사용자들 처리
        for (const { userData, matchedKeywords } of sendQueue) {
          matchedUsers.push({
            phone: userData.phone,
            keywords: matchedKeywords,
          });
          sentPhones.push(userData.phone);

          // Firestore에 발송 이력 저장
          const userDocRef = doc(db, "users_notifications", userData.phone);
          await updateDoc(userDocRef, {
            [`last_notified.${productNo}`]: new Date().toISOString(),
          });
        }
      } catch (smsError: any) {
        console.error(`[Webhook Process] 배치 SMS 발송 실패:`, smsError.message);
        throw smsError;
      }
    }

    // 5. 로그 저장
    const logData: NotificationLog = {
      webhook_event_id: `webhook_${Date.now()}`,
      product_no: productNo,
      product_name: productName,
      matched_keywords: matchedUsers.flatMap((u) => u.keywords),
      sent_to: sentPhones,
      processed_at: new Date().toISOString(),
      success: true,
    };

    const logsRef = collection(db, "notification_logs");
    await addDoc(logsRef, logData);

    const elapsed = Date.now() - startTime;
    console.log(`[Webhook Process] 처리 완료: ${sentPhones.length}명에게 발송 (${elapsed}ms)`);
    console.log("========== [Webhook Process] 비동기 처리 완료 ==========\n");
  } catch (error: any) {
    const elapsed = Date.now() - startTime;
    console.error("\n========== [Webhook Process] 처리 실패 ==========");
    console.error("[Webhook Process] 에러 메시지:", error.message);
    console.error("[Webhook Process] 에러 스택:", error.stack);
    console.error(`[Webhook Process] 실패 시간: ${elapsed}ms`);
    console.error("==================================================\n");

    // 실패 로그 저장
    try {
      const logData: NotificationLog = {
        webhook_event_id: `webhook_${Date.now()}`,
        product_no: payload.resource.resource_id,
        product_name: "(조회 실패)",
        matched_keywords: [],
        sent_to: [],
        processed_at: new Date().toISOString(),
        success: false,
        error_message: error.message,
      };

      const logsRef = collection(db, "notification_logs");
      await addDoc(logsRef, logData);
    } catch (logError) {
      console.error("[Webhook Process] 로그 저장 실패:", logError);
    }
  }
}

// Webhook 수신 API
export async function POST(request: NextRequest) {
  console.log("\n========== [Webhook] 카페24 Webhook 수신 ==========");

  try {
    // Webhook 페이로드 파싱
    const payload: Cafe24WebhookPayload = await request.json();

    console.log("[Webhook] 수신 데이터:", {
      event_no: payload.event_no,
      resource_type: payload.resource?.resource_type,
      resource_id: payload.resource?.resource_id,
    });

    // 즉시 200 OK 반환 (카페24 Webhook 신뢰성 확보)
    // 실제 처리는 백그라운드에서 비동기로 수행
    const response = NextResponse.json(
      {
        received: true,
        event_no: payload.event_no,
        resource_id: payload.resource?.resource_id,
      },
      { status: 200 }
    );

    console.log("[Webhook] 즉시 응답 반환 (200 OK)");
    console.log("========== [Webhook] 수신 완료 ==========\n");

    // Promise Queue에 추가하여 순차 처리 (Rate Limit 방지)
    processingQueue = processingQueue
      .then(() => {
        console.log(`[Webhook Queue] 처리 시작: ${payload.resource?.resource_id}`);
        return processWebhookAsync(payload);
      })
      .catch((error) => {
        console.error(`[Webhook Queue] 처리 실패: ${payload.resource?.resource_id}`, error);
      });

    return response;
  } catch (error: any) {
    console.error("\n========== [Webhook] 에러 발생 ==========");
    console.error("[Webhook] 에러 메시지:", error.message);
    console.error("[Webhook] 에러 스택:", error.stack);
    console.error("==========================================\n");

    // 파싱 실패 등의 경우에도 200 OK 반환 (Webhook 차단 방지)
    return NextResponse.json(
      {
        received: false,
        error: "Invalid payload",
      },
      { status: 200 }
    );
  }
}

// GET 요청 처리 (카페24 Webhook 검증용)
export async function GET(request: NextRequest) {
  console.log("[Webhook] GET 요청 수신 (Webhook 검증)");

  return NextResponse.json(
    {
      status: "ok",
      endpoint: "/api/webhook/cafe24",
      message: "Cafe24 Webhook endpoint is ready",
    },
    { status: 200 }
  );
}
