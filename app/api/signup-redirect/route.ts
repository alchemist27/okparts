import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { collection, addDoc, query, where, getDocs, doc, updateDoc } from "firebase/firestore";
import { hashPassword, generateToken } from "@/lib/auth";

// 카페24 회원가입 후 리디렉션 처리
// 카페24 회원가입 완료 페이지에서 return_url로 설정
export async function GET(request: NextRequest) {
  console.log("\n========== [Signup Redirect] 카페24 회원가입 리디렉션 시작 ==========");

  try {
    const searchParams = request.nextUrl.searchParams;
    const memberId = searchParams.get("member_id");
    const email = searchParams.get("email");
    const customerId = searchParams.get("customer_id");

    // URL 파라미터로 전달된 extra 필드 (권한 불필요)
    const extraFromUrl = {
      extra_1: searchParams.get("extra_1"), // 사업자번호
      extra_2: searchParams.get("extra_2"), // 사업자대표
      extra_3: searchParams.get("extra_3"), // 연락처
    };

    console.log("[Signup Redirect] 파라미터:", {
      member_id: memberId,
      email: email,
      customer_id: customerId,
      extra_from_url: extraFromUrl,
    });

    if (!memberId && !email && !customerId) {
      return NextResponse.json(
        { error: "고객 정보가 없습니다" },
        { status: 400 }
      );
    }

    // 고객 정보 객체 (URL 파라미터 우선, 없으면 카페24 API 조회)
    let customer: any = null;
    let businessNumber: string | null = null;
    let presidentName: string | null = null;
    let phone: string | null = null;
    let companyName: string | null = null;

    // URL 파라미터에서 extra 필드 사용 (카페24 API 호출 없이 처리)
    console.log("[Signup Redirect] URL 파라미터에서 정보 추출");

    businessNumber = extraFromUrl.extra_1;
    presidentName = extraFromUrl.extra_2;
    phone = extraFromUrl.extra_3;
    companyName = memberId || email?.split('@')[0] || ""; // 회사명은 member_id 사용

    customer = {
      member_id: memberId,
      email: email,
      name: companyName,
    };

    console.log("[Signup Redirect] 추출된 정보:", {
      business_number: businessNumber,
      president_name: presidentName,
      phone: phone,
    });

    // 판매자 등록 여부 확인 (사업자번호가 있으면 판매자)
    const isSellerSignup = businessNumber && businessNumber.trim().length > 0;

    if (!isSellerSignup) {
      console.log("[Signup Redirect] 사업자번호 없음, 일반 고객으로 간주");
      // 일반 고객 - 쇼핑몰 메인으로 리디렉션
      const mallId = process.env.NEXT_PUBLIC_CAFE24_MALL_ID;
      const shopUrl = `https://${mallId}.cafe24.com`;
      return NextResponse.redirect(shopUrl);
    }

    console.log("[Signup Redirect] 사업자번호 확인 완료, 판매자 자동 가입 진행");

    // userId 생성 (영문 소문자 + 숫자만)
    const sanitizeUserId = (input: string): string => {
      const baseId = input.includes('@') ? input.split('@')[0] : input;
      return baseId.toLowerCase().replace(/[^a-z0-9]/g, '');
    };

    const userId = sanitizeUserId(customer.email || customer.member_id);
    if (userId.length < 4) {
      throw new Error(`생성된 userId가 너무 짧습니다: ${userId}`);
    }

    console.log("[Signup Redirect] userId 생성:", userId);

    // 중복 체크
    const suppliersRef = collection(db, "suppliers");
    const emailQuery = query(suppliersRef, where("userId", "==", userId));
    const existingSuppliers = await getDocs(emailQuery);

    if (!existingSuppliers.empty) {
      console.log("[Signup Redirect] 이미 존재하는 계정, 로그인 페이지로");
      const existingSupplier = existingSuppliers.docs[0];
      const token = generateToken({
        supplierId: existingSupplier.id,
        email: userId,
      });
      return NextResponse.redirect(
        new URL(`/login?token=${token}&message=already_registered`, request.url)
      );
    }

    // 랜덤 비밀번호 생성
    const generateRandomPassword = (): string => {
      const letters = 'abcdefghijklmnopqrstuvwxyz';
      const numbers = '0123456789';
      let password = '';
      for (let i = 0; i < 7; i++) {
        password += letters[Math.floor(Math.random() * letters.length)];
      }
      for (let i = 0; i < 5; i++) {
        password += numbers[Math.floor(Math.random() * numbers.length)];
      }
      return password.split('').sort(() => Math.random() - 0.5).join('');
    };

    const randomPassword = generateRandomPassword();
    console.log("[Signup Redirect] 랜덤 비밀번호 생성 완료");

    // 필드 매핑 (이미 위에서 추출됨)
    // businessNumber: 사업자번호
    // presidentName: 사업자대표
    // phone: 연락처
    // companyName: 회사명
    const accountType = "business"; // 사업자번호 있으면 무조건 사업자회원

    // 비밀번호 해시
    const hashedPassword = await hashPassword(randomPassword);

    // Firestore에 계정 생성
    const supplierData = {
      accountType,
      userId,
      password: hashedPassword,
      companyName,
      name: presidentName, // 사업자대표
      phone,
      businessNumber: businessNumber, // 사업자번호
      presidentName: presidentName, // 사업자대표
      commission: "0.00",
      status: "active",
      cafe24SupplierNo: null,
      cafe24UserId: null,
      cafe24UserStatus: "not_started",
      cafe24UserRetryCount: 0,
      cafe24UserLastAttempt: null,
      cafe24UserPassword: randomPassword,
      cafe24CustomerNo: String(customerId || ""),
      signupSource: "cafe24_redirect",
      createdAt: new Date().toISOString(),
    };

    const supplierDoc = await addDoc(suppliersRef, supplierData);
    console.log("[Signup Redirect] Firestore 계정 생성 완료, ID:", supplierDoc.id);

    // JWT 토큰 생성
    const token = generateToken({
      supplierId: supplierDoc.id,
      email: userId,
    });

    // 자동 로그인 URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin;
    const loginUrl = `${baseUrl}/login?token=${token}`;

    // Firestore에 자동 로그인 정보 저장
    await updateDoc(doc(db, "suppliers", supplierDoc.id), {
      autoLoginToken: token,
      autoLoginUrl: loginUrl,
      autoLoginTokenCreatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    console.log("[Signup Redirect] 자동 로그인 URL 생성 완료");
    console.log("[Signup Redirect] TODO: 이메일 발송 - 로그인 URL 및 임시 비밀번호");
    console.log("  - 수신자:", customer.email);
    console.log("  - 로그인 URL:", loginUrl);
    console.log("  - 임시 비밀번호:", randomPassword);

    console.log("========== [Signup Redirect] 처리 완료, 로그인 페이지로 리디렉션 ==========\n");

    // 자동 로그인 페이지로 리디렉션
    return NextResponse.redirect(
      new URL(`/login?token=${token}&welcome=true`, request.url)
    );

  } catch (error: any) {
    console.error("\n========== [Signup Redirect] 에러 발생 ==========");
    console.error("[Signup Redirect] 에러 메시지:", error.message);
    console.error("[Signup Redirect] 에러 스택:", error.stack);
    console.error("=================================================\n");

    // 에러 페이지로 리디렉션
    return NextResponse.redirect(
      new URL(`/signup?error=${encodeURIComponent(error.message)}`, request.url)
    );
  }
}
