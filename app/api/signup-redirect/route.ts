import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { collection, addDoc, query, where, getDocs, doc, updateDoc, getDoc } from "firebase/firestore";
import { hashPassword, generateToken } from "@/lib/auth";
import { Cafe24ApiClient } from "@/lib/cafe24";

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

    console.log("[Signup Redirect] 원본 추출 정보:", {
      business_number: businessNumber,
      president_name: presidentName,
      phone: phone,
    });

    // 회원 유형 결정 (사업자번호가 있으면 사업자회원, 없으면 개인회원)
    const accountType = (businessNumber && businessNumber.trim().length > 0) ? "business" : "individual";

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
        console.log("[Signup Redirect] ⚠️ 추가정보 일부 누락 - 더미 데이터로 보완");
        console.log("[Signup Redirect] 보완된 정보:", {
          businessNumber,
          presidentName,
          phone,
        });
      }
    }

    console.log("[Signup Redirect] 회원 유형:", accountType);
    if (accountType === "business") {
      console.log("[Signup Redirect] 사업자 판매자로 가입 진행");
    } else {
      console.log("[Signup Redirect] 개인 판매자로 가입 진행");
    }

    // userId 생성 (영문 소문자 + 숫자만)
    const sanitizeUserId = (input: string): string => {
      const baseId = input.includes('@') ? input.split('@')[0] : input;
      return baseId.toLowerCase().replace(/[^a-z0-9]/g, '');
    };

    // memberId 우선, 없으면 email 사용
    const userIdInput = customer.member_id || customer.email;
    const userId = sanitizeUserId(userIdInput);
    if (userId.length < 4) {
      throw new Error(`생성된 userId가 너무 짧습니다: ${userId}`);
    }

    console.log("[Signup Redirect] userId 생성:", userId, "(출처:", customer.member_id ? "member_id" : "email", ")");

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
    // companyName: 회사명 또는 개인명

    // 비밀번호 해시
    const hashedPassword = await hashPassword(randomPassword);

    // Firestore에 계정 생성
    const supplierData = {
      accountType,
      userId,
      password: hashedPassword,
      companyName: accountType === "individual" ? companyName : companyName,
      name: accountType === "individual" ? companyName : presidentName, // 개인회원: 개인명, 사업자회원: 대표자명
      phone: phone || "",
      businessNumber: accountType === "business" ? businessNumber : null,
      presidentName: accountType === "business" ? presidentName : null,
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

    // 카페24 공급사 생성
    let supplierCode: string | null = null;
    try {
      console.log("\n[Signup Redirect] 카페24 공급사 생성 시작");

      // 카페24 토큰 가져오기
      const mallId = process.env.NEXT_PUBLIC_CAFE24_MALL_ID;
      if (!mallId) {
        throw new Error("Mall ID not configured");
      }

      const installDocRef = doc(db, "installs", mallId);
      const installDoc = await getDoc(installDocRef);
      if (!installDoc.exists()) {
        throw new Error("카페24 앱이 설치되지 않았습니다");
      }

      const installData = installDoc.data();

      // 토큰 갱신 시 Firestore 업데이트 콜백
      const onTokenRefresh = async (newAccessToken: string, newRefreshToken: string, expiresAt: string) => {
        await updateDoc(installDocRef, {
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
          expiresAt: expiresAt,
          updatedAt: new Date().toISOString(),
        });
        console.log("[Signup Redirect] Firestore 토큰 업데이트 완료");
      };

      const cafe24Client = new Cafe24ApiClient(mallId, installData.accessToken, {
        refreshToken: installData.refreshToken,
        clientId: process.env.CAFE24_CLIENT_ID,
        clientSecret: process.env.CAFE24_CLIENT_SECRET,
        onTokenRefresh,
      });

      // 카페24 공급사 생성 데이터
      const cafe24SupplierData: any = {
        supplier_name: companyName || "공급사",
        use_supplier: "T",
        trading_type: "C",
        supplier_type: "BS",
        status: "A",
        business_item: "중고부품",
        payment_type: "P",
        commission: "0.00",
        payment_period: "A",
        payment_method: "30",
        payment_start_date: 9,
        payment_end_date: 30,
        phone: phone || "010-0000-0000",
        country_code: "KOR",
        zipcode: "00000",
        address1: "주소 미입력",
        address2: "",
        manager_information: [{
          no: 1,
          name: presidentName || companyName || "담당자",
          phone: phone || "010-0000-0000"
        }]
      };

      // 사업자회원만 추가 정보
      if (accountType === "business" && businessNumber) {
        console.log("[Signup Redirect] 사업자등록번호 처리:", {
          businessNumber: businessNumber,
          format: "하이픈 포함 형식으로 전송"
        });

        cafe24SupplierData.company_registration_no = businessNumber;
        cafe24SupplierData.company_name = companyName;
        cafe24SupplierData.president_name = presidentName;
      }

      console.log("[Signup Redirect] 카페24 공급사 생성 요청:", {
        supplier_name: cafe24SupplierData.supplier_name,
        accountType,
        commission: cafe24SupplierData.commission,
        company_registration_no: cafe24SupplierData.company_registration_no,
      });

      const cafe24SupplierResponse = await cafe24Client.createSupplier(cafe24SupplierData);
      supplierCode = cafe24SupplierResponse.supplier?.supplier_code;

      if (!supplierCode) {
        throw new Error("카페24 공급사 코드를 받지 못했습니다");
      }

      console.log("[Signup Redirect] 카페24 공급사 생성 완료, 코드:", supplierCode);

      // Firestore에 카페24 연동 정보 업데이트
      console.log("[Signup Redirect] Firestore에 카페24 연동 정보 업데이트");
      await updateDoc(doc(db, "suppliers", supplierDoc.id), {
        cafe24SupplierNo: supplierCode,
        cafe24UserId: null,
        cafe24UserStatus: "pending",
        updatedAt: new Date().toISOString(),
      });

      console.log("[Signup Redirect] 카페24 연동 정보 업데이트 완료 (공급사 코드:", supplierCode, ")");

    } catch (cafe24Error: any) {
      console.error("\n[Signup Redirect] 카페24 공급사 생성 실패:", cafe24Error.message);
      console.error("[Signup Redirect] 카페24 에러 상세:", cafe24Error);

      // 카페24 연동 실패 시 Firestore 데이터 삭제 (롤백)
      try {
        console.log("[Signup Redirect] 카페24 연동 실패로 인한 Firestore 데이터 롤백 시작");
        const { deleteDoc } = await import("firebase/firestore");
        await deleteDoc(doc(db, "suppliers", supplierDoc.id));
        console.log("[Signup Redirect] ✅ Firestore 데이터 삭제 완료 - 사용자는 동일 아이디로 재시도 가능");
      } catch (deleteError: any) {
        console.error("[Signup Redirect] ❌ Firestore 데이터 삭제 실패:", deleteError.message);
        console.error("[Signup Redirect] 경고: 미승인 계정이 Firestore에 남아있을 수 있음 (문서 ID:", supplierDoc.id, ")");
      }

      // 에러 메시지 생성 및 리디렉션
      const errorMessage = cafe24Error.message || "카페24 공급사 생성 중 오류가 발생했습니다";
      return NextResponse.redirect(
        new URL(`/signup?error=${encodeURIComponent(errorMessage)}`, request.url)
      );
    }

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
