import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { collection, getDocs, doc, getDoc, updateDoc, addDoc } from "firebase/firestore";
import type { UserNotification, NotificationLog } from "@/lib/types/notifications";
import { getSmsTemplate, checkMessageLength } from "@/lib/sms-templates";

// Promise Queue 제거 - 서버리스 환경에서 문제 발생 가능
// let processingQueue = Promise.resolve();

// 카페24 Webhook 페이로드 타입 - 상품 이벤트
interface Cafe24WebhookPayload {
  event_no: number; // 이벤트 번호 (90001 = 상품 등록)
  resource: {
    mall_id: string;
    event_shop_no: string;
    product_no: number; // 상품 번호
    product_code: string;
    product_name: string;
    created_date: string;
    updated_date: string;
    display: string;
    selling: string;
    price: string;
    category_no: string;
    // ... 기타 필드들
  };
}

// 카페24 Webhook 페이로드 타입 - 고객가입 이벤트 (90032)
interface Cafe24CustomerSignupPayload {
  event_no: number; // 90032
  resource: {
    mall_id: string;
    shop_no: string;
    member_id: string;
    email: string;
    name: string;
    customer_id: number;
    created_date: string;
    member_authentication?: string;
    extra_1?: string; // 사업자번호
    extra_2?: string; // 사업자대표
    extra_3?: string; // 연락처
    [key: string]: any; // 기타 필드
  };
}

// 키워드 매칭 함수 (띄어쓰기 무시)
function matchKeywords(productName: string, keywords: string[]): string[] {
  const matched: string[] = [];
  // 상품명에서 띄어쓰기 제거 후 소문자 변환
  const normalizedProductName = productName.toLowerCase().replace(/\s+/g, '');

  for (const keyword of keywords) {
    // 키워드에서 띄어쓰기 제거 후 소문자 변환
    const normalizedKeyword = keyword.toLowerCase().trim().replace(/\s+/g, '');

    if (normalizedProductName.includes(normalizedKeyword)) {
      matched.push(keyword);
    }
  }

  return matched;
}

// userId 생성 함수 (영문 소문자 + 숫자만)
function sanitizeUserId(input: string): string {
  // @ 있으면 @ 앞부분만 사용, 없으면 전체 사용
  const baseId = input.includes('@') ? input.split('@')[0] : input;
  // 영문 소문자 + 숫자만 남김
  return baseId.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// 랜덤 비밀번호 생성 (10~16자, 영문소문자+숫자)
function generateRandomPassword(): string {
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';

  let password = '';
  // 7자리 영문소문자
  for (let i = 0; i < 7; i++) {
    password += letters[Math.floor(Math.random() * letters.length)];
  }
  // 5자리 숫자
  for (let i = 0; i < 5; i++) {
    password += numbers[Math.floor(Math.random() * numbers.length)];
  }

  // 섞기
  password = password.split('').sort(() => Math.random() - 0.5).join('');

  return password;
}

// 고객가입 Webhook 처리 함수
async function processCustomerSignupAsync(payload: Cafe24CustomerSignupPayload) {
  const startTime = Date.now();
  console.log("\n========== [Customer Signup] 고객가입 Webhook 처리 시작 ==========");

  try {
    const customer = payload.resource;
    console.log("[Customer Signup] 고객 정보:", {
      member_id: customer.member_id,
      email: customer.email,
      name: customer.name,
      extra_1: customer.extra_1, // 사업자번호
      extra_2: customer.extra_2, // 사업자대표
      extra_3: customer.extra_3, // 연락처
    });

    // 1. 회원 유형 결정 (사업자번호가 있으면 사업자회원, 없으면 개인회원)
    let businessNumber = customer.extra_1;
    const accountType = (businessNumber && businessNumber.trim().length > 0) ? "business" : "individual";

    console.log("[Customer Signup] 회원 유형:", accountType);
    if (accountType === "business") {
      console.log("[Customer Signup] 사업자 판매자로 가입 진행");
    } else {
      console.log("[Customer Signup] 개인 판매자로 가입 진행");
    }

    // 2. userId 생성 (email 또는 member_id 기반)
    const userId = sanitizeUserId(customer.email || customer.member_id);
    if (userId.length < 4) {
      throw new Error(`생성된 userId가 너무 짧습니다: ${userId}`);
    }

    console.log("[Customer Signup] userId 생성:", userId);

    // 3. 이메일 중복 체크
    const { query, where, getDocs } = await import("firebase/firestore");
    const suppliersRef = collection(db, "suppliers");
    const emailQuery = query(suppliersRef, where("userId", "==", userId));
    const existingSuppliers = await getDocs(emailQuery);

    if (!existingSuppliers.empty) {
      console.log("[Customer Signup] 건너뛰기: 이미 존재하는 계정 (userId:", userId, ")");
      return;
    }

    // 4. 랜덤 비밀번호 생성
    const randomPassword = generateRandomPassword();
    console.log("[Customer Signup] 랜덤 비밀번호 생성 완료");

    // 5. 필드 매핑
    // extra_1: 사업자번호
    // extra_2: 사업자대표
    // extra_3: 연락처
    const companyName = customer.name || ""; // 회사명 또는 개인명
    let presidentName = customer.extra_2 || customer.name; // 사업자대표
    let phone = customer.extra_3 || ""; // 연락처

    console.log("[Customer Signup] 원본 정보:", {
      accountType,
      companyName,
      businessNumber,
      presidentName,
      phone,
    });

    // 사업자회원인데 추가정보 중 하나라도 비어있으면 더미 데이터로 채우기
    if (accountType === "business") {
      let needsDummyData = false;

      if (!businessNumber || businessNumber.trim() === "") {
        businessNumber = "682-35-01496"; // 더미 사업자번호
        needsDummyData = true;
      }
      if (!presidentName || presidentName.trim() === "") {
        presidentName = companyName || "대표자"; // 회사명 또는 기본값
        needsDummyData = true;
      }
      if (!phone || phone.trim() === "") {
        phone = "010-0000-0000"; // 더미 연락처
        needsDummyData = true;
      }

      if (needsDummyData) {
        console.log("[Customer Signup] ⚠️ 추가정보 일부 누락 - 더미 데이터로 보완");
        console.log("[Customer Signup] 보완된 정보:", {
          businessNumber,
          presidentName,
          phone,
        });
      }
    }

    // 6. 비밀번호 해시
    const { hashPassword } = await import("@/lib/auth");
    const hashedPassword = await hashPassword(randomPassword);

    // 7. Firestore에 계정 생성
    const supplierData = {
      accountType,
      userId,
      password: hashedPassword,
      companyName: accountType === "individual" ? companyName : companyName,
      name: accountType === "individual" ? companyName : presidentName, // 개인회원: 개인명, 사업자회원: 대표자명
      phone,
      businessNumber: accountType === "business" ? businessNumber : null,
      presidentName: accountType === "business" ? presidentName : null,
      commission: "0.00",
      status: "active",
      cafe24SupplierNo: null, // 백그라운드에서 생성 예정
      cafe24UserId: null,
      cafe24UserStatus: "not_started",
      cafe24UserRetryCount: 0,
      cafe24UserLastAttempt: null,
      cafe24UserPassword: randomPassword,
      cafe24CustomerNo: String(customer.customer_id),
      signupSource: "cafe24_webhook", // 가입 경로
      createdAt: new Date().toISOString(),
    };

    const supplierDoc = await addDoc(suppliersRef, supplierData);
    console.log("[Customer Signup] Firestore 계정 생성 완료, ID:", supplierDoc.id);

    // 8. JWT 토큰 생성
    const { generateToken } = await import("@/lib/auth");
    const token = generateToken({
      supplierId: supplierDoc.id,
      email: userId,
    });

    console.log("[Customer Signup] JWT 토큰 생성 완료");

    // 9. 로그인 URL 생성
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const loginUrl = `${baseUrl}/login?token=${token}`;

    console.log("[Customer Signup] 자동 로그인 URL:", loginUrl);

    // 10. 로그인 정보를 Firestore에 저장 (나중에 이메일/SMS 발송용)
    await updateDoc(doc(db, "suppliers", supplierDoc.id), {
      autoLoginToken: token,
      autoLoginUrl: loginUrl,
      autoLoginTokenCreatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // TODO: 이메일 또는 SMS로 로그인 정보 발송
    // - 로그인 URL
    // - 임시 비밀번호 (또는 비밀번호 재설정 링크)
    console.log("[Customer Signup] 📧 TODO: 이메일 발송 필요");
    console.log(`  - 수신자: ${customer.email}`);
    console.log(`  - 로그인 URL: ${loginUrl}`);
    console.log(`  - 임시 비밀번호: ${randomPassword}`);

    const elapsed = Date.now() - startTime;
    console.log(`[Customer Signup] 처리 완료: ${elapsed}ms`);
    console.log("========== [Customer Signup] 처리 완료 ==========\n");

  } catch (error: any) {
    const elapsed = Date.now() - startTime;
    console.error("\n========== [Customer Signup] 처리 실패 ==========");
    console.error("[Customer Signup] 에러 메시지:", error.message);
    console.error("[Customer Signup] 에러 스택:", error.stack);
    console.error(`[Customer Signup] 실패 시간: ${elapsed}ms`);
    console.error("=================================================\n");
    throw error;
  }
}

// 비동기 Webhook 처리 함수
async function processWebhookAsync(payload: Cafe24WebhookPayload) {
  const startTime = Date.now();
  console.log("\n========== [Webhook Process] 비동기 처리 시작 ==========");

  try {
    const productNo = String(payload.resource.product_no);
    const productName = payload.resource.product_name;

    console.log("[Webhook Process] 이벤트 번호:", payload.event_no);
    console.log("[Webhook Process] 상품 번호:", productNo);
    console.log("[Webhook Process] 상품명:", productName);

    // 1. 이벤트 타입별 처리
    if (payload.event_no === 90003) {
      // 상품 삭제 이벤트
      console.log("[Webhook Process] 상품 삭제 이벤트 처리");

      // Firestore에서 해당 상품 삭제
      const { query, where, deleteDoc } = await import("firebase/firestore");
      const productsRef = collection(db, "products");
      const q = query(productsRef, where("cafe24ProductNo", "==", productNo));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        for (const docSnapshot of snapshot.docs) {
          await deleteDoc(doc(db, "products", docSnapshot.id));
          console.log(`[Webhook Process] Firestore 상품 삭제: ${docSnapshot.id}`);
        }
      } else {
        console.log("[Webhook Process] Firestore에 해당 상품 없음");
      }

      return;
    }

    if (payload.event_no === 90002) {
      // 상품 수정 이벤트
      console.log("[Webhook Process] 상품 수정 이벤트 처리");

      // Firestore에서 해당 상품 찾아서 업데이트
      const { query, where } = await import("firebase/firestore");
      const productsRef = collection(db, "products");
      const q = query(productsRef, where("cafe24ProductNo", "==", productNo));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        for (const docSnapshot of snapshot.docs) {
          const updateData: any = {
            updatedAt: new Date().toISOString(),
          };

          // 카페24에서 받은 데이터로 업데이트
          if (payload.resource.product_name) {
            updateData.name = payload.resource.product_name;
          }
          if (payload.resource.price) {
            updateData.sellingPrice = parseInt(payload.resource.price);
          }
          if (payload.resource.display) {
            updateData.display = payload.resource.display;
          }
          if (payload.resource.selling) {
            updateData.selling = payload.resource.selling;
          }

          await updateDoc(doc(db, "products", docSnapshot.id), updateData);
          console.log(`[Webhook Process] Firestore 상품 업데이트: ${docSnapshot.id}`);
          console.log(`[Webhook Process] 업데이트 데이터:`, updateData);
        }
      } else {
        console.log("[Webhook Process] Firestore에 해당 상품 없음");
      }

      return;
    }

    if (payload.event_no !== 90001) {
      console.log("[Webhook Process] 무시: 처리 대상 이벤트 아님 (event_no:", payload.event_no, ")");
      return;
    }

    // 2. 상품 등록 이벤트 처리 (기존 로직)
    console.log("[Webhook Process] 상품 등록 이벤트 - 알림 발송 시작");

    // 3. 카페24 API 클라이언트 초기화 (SMS 발송용)
    console.log("[Webhook Process] Cafe24 모듈 import 시작");
    const { Cafe24ApiClient } = await import("@/lib/cafe24");
    console.log("[Webhook Process] Cafe24 모듈 import 성공");

    const mallId = process.env.NEXT_PUBLIC_CAFE24_MALL_ID;
    console.log("[Webhook Process] Mall ID:", mallId);

    if (!mallId) {
      throw new Error("Mall ID not configured");
    }

    console.log("[Webhook Process] Firestore에서 설치 정보 조회 중...");
    const installDocRef = doc(db, "installs", mallId);
    const installDoc = await getDoc(installDocRef);
    console.log("[Webhook Process] 설치 정보 조회 완료, exists:", installDoc.exists());

    if (!installDoc.exists()) {
      throw new Error("Cafe24 app not installed");
    }

    const installData = installDoc.data();
    console.log("[Webhook Process] Access Token 존재:", !!installData.accessToken);

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

    // 4. 모든 사용자 키워드 조회
    console.log("[Webhook Process] 등록된 사용자 키워드 조회 중...");
    const usersRef = collection(db, "users_notifications");
    const usersSnapshot = await getDocs(usersRef);

    console.log("[Webhook Process] 등록된 사용자 수:", usersSnapshot.docs.length);

    if (usersSnapshot.docs.length === 0) {
      console.log("[Webhook Process] 등록된 사용자 없음 - 종료");
      return;
    }

    // 5. 키워드 매칭 및 배치 SMS 발송 (최대 100명)
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

      // 중복 발송 체크 (24시간 이내 같은 상품 발송 방지)
      console.log(`[Webhook Process] 상품 번호 체크: ${productNo}, last_notified:`, userData.last_notified);
      const lastSentTime = userData.last_notified[productNo];

      if (lastSentTime) {
        const hoursSinceLastSent = (Date.now() - new Date(lastSentTime).getTime()) / (1000 * 60 * 60);
        console.log(`[Webhook Process] 마지막 발송: ${lastSentTime} (${hoursSinceLastSent.toFixed(2)}시간 전)`);

        if (hoursSinceLastSent < 24) {
          console.log(`[Webhook Process] 건너뛰기: ${userData.phone} (24시간 이내 발송됨)`);
          continue;
        }
        console.log(`[Webhook Process] 24시간 경과 - 재발송 허용`);
      }

      console.log(`[Webhook Process] 발송 진행: ${userData.phone}`);

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
          title: messageCheck.title, // LMS일 때 제목
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

    // 6. 로그 저장
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
        product_no: String(payload.resource.product_no),
        product_name: payload.resource.product_name || "(조회 실패)",
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
    const payload: any = await request.json();

    console.log("[Webhook] 수신 데이터:", {
      event_no: payload.event_no,
      resource_type: payload.resource?.product_no ? 'product' : (payload.resource?.member_id ? 'customer' : 'unknown'),
    });

    // 이벤트 타입별 처리
    let processingPromise: Promise<void>;

    if (payload.event_no === 90032) {
      // 고객가입 이벤트
      console.log("[Webhook] 이벤트 타입: 고객가입 (90032)");
      console.log("[Webhook] 고객 정보:", {
        member_id: payload.resource?.member_id,
        email: payload.resource?.email,
        extra_1: payload.resource?.extra_1,
      });
      processingPromise = processCustomerSignupAsync(payload as Cafe24CustomerSignupPayload);
    } else if ([90001, 90002, 90003].includes(payload.event_no)) {
      // 상품 이벤트
      console.log("[Webhook] 이벤트 타입: 상품 이벤트 (", payload.event_no, ")");
      console.log("[Webhook] 상품 정보:", {
        product_no: payload.resource?.product_no,
        product_name: payload.resource?.product_name,
      });
      processingPromise = processWebhookAsync(payload as Cafe24WebhookPayload);
    } else {
      console.log("[Webhook] 알 수 없는 이벤트 타입:", payload.event_no);
      return NextResponse.json(
        {
          received: true,
          event_no: payload.event_no,
          message: "Unsupported event type",
        },
        { status: 200 }
      );
    }

    // 즉시 200 OK 반환 (카페24 Webhook 신뢰성 확보)
    const response = NextResponse.json(
      {
        received: true,
        event_no: payload.event_no,
      },
      { status: 200 }
    );

    // 백그라운드 처리 시작 (응답 전에 실행)
    console.log("[Webhook] 처리 시작...");

    // 처리 완료 대기
    await processingPromise;

    console.log("[Webhook] 처리 완료, 응답 반환");
    console.log("========== [Webhook] 수신 완료 ==========\n");

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
