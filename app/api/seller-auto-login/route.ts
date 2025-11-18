import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { collection, addDoc, query, where, getDocs, doc, updateDoc } from "firebase/firestore";
import { hashPassword, generateToken } from "@/lib/auth";

// 카페24 플로팅 버튼 클릭 시 자동 로그인 처리
// 기존 회원이면 자동 로그인, 신규 회원이면 자동 가입 후 로그인
export async function GET(request: NextRequest) {
  console.log("\n========== [Seller Auto Login] 카페24 자동 로그인 시작 ==========");

  try {
    const searchParams = request.nextUrl.searchParams;
    const memberId = searchParams.get("member_id");
    const email = searchParams.get("email");
    const name = searchParams.get("name"); // 카페24에서 전달하는 name 필드

    // URL 파라미터로 전달된 extra 필드
    const extraFromUrl = {
      extra_1: searchParams.get("extra_1"), // 사업자번호
      extra_2: searchParams.get("extra_2"), // 사업자대표
      extra_3: searchParams.get("extra_3"), // 연락처
    };

    console.log("[Seller Auto Login] 파라미터:", {
      member_id: memberId,
      email: email,
      name: name,
      extra_from_url: extraFromUrl,
    });

    if (!memberId && !email) {
      return NextResponse.json(
        { error: "회원 정보가 없습니다" },
        { status: 400 }
      );
    }

    // 사업자 정보 추출
    let businessNumber = extraFromUrl.extra_1;
    let presidentName = extraFromUrl.extra_2;
    let phone = extraFromUrl.extra_3;
    const companyName = name || memberId || email?.split('@')[0] || ""; // 회사명은 name 우선 사용

    console.log("[Seller Auto Login] 원본 추출 정보:", {
      business_number: businessNumber,
      president_name: presidentName,
      phone: phone,
      company_name: companyName,
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
        console.log("[Seller Auto Login] ⚠️ 추가정보 일부 누락 - 더미 데이터로 보완");
        console.log("[Seller Auto Login] 보완된 정보:", {
          business_number: businessNumber,
          president_name: presidentName,
          phone: phone,
        });
      }
    }

    console.log("[Seller Auto Login] 회원 유형:", accountType);
    if (accountType === "business") {
      console.log("[Seller Auto Login] 사업자 판매자로 가입 진행");
    } else {
      console.log("[Seller Auto Login] 개인 판매자로 가입 진행");
    }

    // userId 생성 (영문 소문자 + 숫자만)
    const sanitizeUserId = (input: string): string => {
      const baseId = input.includes('@') ? input.split('@')[0] : input;
      return baseId.toLowerCase().replace(/[^a-z0-9]/g, '');
    };

    // memberId 우선, 없으면 email 사용
    const userIdInput = memberId || email;
    if (!userIdInput) {
      throw new Error("이메일 또는 회원 ID가 필요합니다");
    }

    const userId = sanitizeUserId(userIdInput);
    if (userId.length < 4) {
      throw new Error(`생성된 userId가 너무 짧습니다: ${userId}`);
    }

    console.log("[Seller Auto Login] userId 생성:", userId, "(출처:", memberId ? "member_id" : "email", ")");

    // 기존 회원 확인
    const suppliersRef = collection(db, "suppliers");
    const emailQuery = query(suppliersRef, where("userId", "==", userId));
    const existingSuppliers = await getDocs(emailQuery);

    if (!existingSuppliers.empty) {
      console.log("[Seller Auto Login] 기존 회원 확인, 자동 로그인 처리");
      const existingSupplier = existingSuppliers.docs[0];
      const token = generateToken({
        supplierId: existingSupplier.id,
        email: userId,
      });
      console.log("[Seller Auto Login] JWT 토큰 생성 완료, 로그인 페이지로 리디렉션");
      console.log("========== [Seller Auto Login] 기존 회원 자동 로그인 완료 ==========\n");

      return NextResponse.redirect(
        new URL(`/login?token=${token}&auto=true`, request.url)
      );
    }

    // 신규 회원 - 자동 가입 진행
    console.log("[Seller Auto Login] 신규 회원, 자동 가입 진행");

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
    console.log("[Seller Auto Login] 랜덤 비밀번호 생성 완료");

    // 비밀번호 해시
    const hashedPassword = await hashPassword(randomPassword);

    // Firestore에 계정 생성
    const supplierData = {
      accountType,
      userId,
      password: hashedPassword,
      companyName: accountType === "individual" ? name : companyName,
      name: accountType === "individual" ? name : (presidentName || name), // 개인회원: name, 사업자회원: 대표자명
      phone: phone || "",
      businessNumber: accountType === "business" ? businessNumber : null,
      presidentName: accountType === "business" ? (presidentName || name) : null,
      commission: "0.00",
      status: "active",
      cafe24SupplierNo: null,
      cafe24UserId: null,
      cafe24UserStatus: "not_started",
      cafe24UserRetryCount: 0,
      cafe24UserLastAttempt: null,
      cafe24UserPassword: randomPassword,
      cafe24CustomerNo: "", // customer_id는 없으므로 빈 문자열
      signupSource: "cafe24_floating_button",
      createdAt: new Date().toISOString(),
    };

    const supplierDoc = await addDoc(suppliersRef, supplierData);
    console.log("[Seller Auto Login] Firestore 계정 생성 완료, ID:", supplierDoc.id);

    // 카페24 연동
    let supplierCode: string | null = null;
    try {
      console.log("\n[Seller Auto Login] 카페24 공급사 생성 시작");

      // 카페24 토큰 가져오기
      const mallId = process.env.NEXT_PUBLIC_CAFE24_MALL_ID;
      if (!mallId) {
        throw new Error("Mall ID not configured");
      }

      const installDocRef = doc(db, "installs", mallId);
      const { getDoc: getDocImport } = await import("firebase/firestore");
      const installDoc = await getDocImport(installDocRef);
      if (!installDoc.exists()) {
        throw new Error("카페24 앱이 설치되지 않았습니다");
      }

      const installData = installDoc.data();

      // 토큰 갱신 시 Firestore 업데이트 콜백
      const onTokenRefresh = async (newAccessToken: string, newRefreshToken: string, expiresAt: string) => {
        const { updateDoc } = await import("firebase/firestore");
        await updateDoc(installDocRef, {
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
          expiresAt: expiresAt,
          updatedAt: new Date().toISOString(),
        });
        console.log("[Seller Auto Login] Firestore 토큰 업데이트 완료");
      };

      const { Cafe24ApiClient } = await import("@/lib/cafe24");
      const cafe24Client = new Cafe24ApiClient(mallId, installData.accessToken, {
        refreshToken: installData.refreshToken,
        clientId: process.env.CAFE24_CLIENT_ID,
        clientSecret: process.env.CAFE24_CLIENT_SECRET,
        onTokenRefresh,
      });

      // 카페24 공급사 생성 데이터
      const cafe24SupplierData: any = {
        supplier_name: accountType === "individual" ? name : companyName,
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
        phone: phone || "",
        country_code: "KOR",
        zipcode: "00000",
        address1: "주소 미입력",
        address2: "",
        manager_information: [{
          no: 1,
          name: accountType === "individual" ? name : (presidentName || name),
          phone: phone || ""
        }]
      };

      // 사업자회원만 추가 정보
      if (accountType === "business") {
        cafe24SupplierData.company_registration_no = businessNumber;
        cafe24SupplierData.company_name = companyName;
        cafe24SupplierData.president_name = presidentName || name;
      }

      console.log("[Seller Auto Login] 카페24 공급사 생성 요청:", {
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

      console.log("[Seller Auto Login] 카페24 공급사 생성 완료, 코드:", supplierCode);

      // 카페24 사용자 생성은 백그라운드로 처리
      console.log("[Seller Auto Login] 카페24 사용자 생성은 백그라운드로 처리 (pending 상태)");

      // Firestore에 카페24 연동 정보 업데이트
      console.log("[Seller Auto Login] Firestore에 카페24 연동 정보 업데이트");
      const { updateDoc } = await import("firebase/firestore");
      await updateDoc(doc(db, "suppliers", supplierDoc.id), {
        cafe24SupplierNo: supplierCode,
        cafe24UserId: null, // 백그라운드에서 생성 예정
        cafe24UserStatus: "pending", // 백그라운드 처리 대기
        updatedAt: new Date().toISOString(),
      });

      console.log("[Seller Auto Login] 카페24 연동 정보 업데이트 완료");

    } catch (cafe24Error: any) {
      console.error("\n[Seller Auto Login] 카페24 연동 실패:", cafe24Error.message);
      console.error("[Seller Auto Login] 카페24 에러 상세:", cafe24Error);

      // 카페24 연동 실패 시 Firestore 데이터 삭제 (롤백)
      try {
        console.log("[Seller Auto Login] 카페24 연동 실패로 인한 Firestore 데이터 롤백 시작");
        const { deleteDoc } = await import("firebase/firestore");
        const docRef = doc(db, "suppliers", supplierDoc.id);
        await deleteDoc(docRef);
        console.log("[Seller Auto Login] ✅ Firestore 데이터 삭제 완료");
      } catch (deleteError: any) {
        console.error("[Seller Auto Login] ❌ Firestore 데이터 삭제 실패:", deleteError.message);
      }

      // 에러 타입별 처리
      const errorMessage = cafe24Error.message || "";

      // 사업자번호 유효성 에러
      const isBusinessNumberError = errorMessage.includes("Invalid Business Registration Number")
        || errorMessage.includes("company_registration_no");

      if (isBusinessNumberError) {
        console.error("[Seller Auto Login] 사업자번호 유효성 검증 실패");
        return NextResponse.json(
          {
            error: "유효한 사업자등록번호를 입력해주세요",
            details: "입력하신 사업자등록번호가 국세청에 등록되지 않았거나 유효하지 않습니다."
          },
          { status: 400 }
        );
      }

      // 타임아웃 에러
      const isTimeoutError = errorMessage.includes("Timeout") || errorMessage.includes("timeout");

      if (isTimeoutError) {
        console.error("[Seller Auto Login] 카페24 API 타임아웃:", errorMessage);
        return NextResponse.json(
          {
            error: "처리 중 시간이 초과되었습니다",
            details: "카페24 서버 응답이 지연되고 있습니다. 잠시 후 다시 시도해주세요."
          },
          { status: 408 }
        );
      }

      return NextResponse.json(
        {
          error: "카페24 연동 중 오류가 발생했습니다",
          details: "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
        },
        { status: 500 }
      );
    }

    // JWT 토큰 생성
    console.log("[Seller Auto Login] JWT 토큰 생성");
    const token = generateToken({
      supplierId: supplierDoc.id,
      email: userId,
    });

    // 자동 로그인 URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin;
    const loginUrl = `${baseUrl}/login?token=${token}`;

    // Firestore에 자동 로그인 정보 저장
    const { updateDoc } = await import("firebase/firestore");
    await updateDoc(doc(db, "suppliers", supplierDoc.id), {
      autoLoginToken: token,
      autoLoginUrl: loginUrl,
      autoLoginTokenCreatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    console.log("[Seller Auto Login] 자동 로그인 URL 생성 완료");
    console.log("[Seller Auto Login] TODO: 이메일 발송 - 로그인 URL 및 임시 비밀번호");
    console.log("  - 수신자:", email || memberId);
    console.log("  - 로그인 URL:", loginUrl);
    console.log("  - 임시 비밀번호:", randomPassword);

    console.log("========== [Seller Auto Login] 신규 회원 자동 가입 완료, 로그인 페이지로 리디렉션 ==========\n");

    // 자동 로그인 페이지로 리디렉션
    return NextResponse.redirect(
      new URL(`/login?token=${token}&welcome=true`, request.url)
    );

  } catch (error: any) {
    console.error("\n========== [Seller Auto Login] 에러 발생 ==========");
    console.error("[Seller Auto Login] 에러 메시지:", error.message);
    console.error("[Seller Auto Login] 에러 스택:", error.stack);
    console.error("=================================================\n");

    // 에러 페이지로 리디렉션
    return NextResponse.redirect(
      new URL(`/signup?error=${encodeURIComponent(error.message)}`, request.url)
    );
  }
}
