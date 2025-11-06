import { NextRequest, NextResponse } from "next/server";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, addDoc, query, where, getDocs } from "firebase/firestore";
import { hashPassword, generateToken } from "@/lib/auth";
import { SignupRequest, AuthResponse } from "@/types";
import { Cafe24ApiClient } from "@/lib/cafe24";
import { doc, getDoc } from "firebase/firestore";

export async function POST(request: NextRequest) {
  console.log("\n========== [SIGNUP] 회원가입 시작 ==========");

  try {
    const body = await request.json();
    console.log("[SIGNUP Step 1] 요청 데이터 수신:", {
      accountType: body.accountType,
      userId: body.userId,
      name: body.name,
      companyName: body.companyName,
      phone: body.phone,
      hasBusinessNumber: !!body.businessNumber,
      hasPresidentName: !!body.presidentName,
      // 계좌 정보는 보류
      // hasBankInfo: !!(body.bankCode && body.bankAccountNo && body.bankAccountName)
    });

    const {
      accountType,
      userId,
      password,
      companyName,
      name,
      phone,
      businessNumber,
      presidentName,
      // 계좌 정보는 보류
      // bankCode,
      // bankAccountNo,
      // bankAccountName
    } = body;

    // 유효성 검사
    if (!userId || !password || !name || !phone || !accountType) {
      console.error("[SIGNUP] 필수 필드 누락");
      return NextResponse.json(
        { error: "모든 필수 필드를 입력해주세요" },
        { status: 400 }
      );
    }

    // 아이디 형식 검사 (영문 소문자, 숫자만)
    if (!/^[a-z0-9]+$/.test(userId)) {
      console.error("[SIGNUP] 아이디 형식 오류");
      return NextResponse.json(
        { error: "아이디는 영문 소문자와 숫자만 사용 가능합니다" },
        { status: 400 }
      );
    }

    if (accountType === "business" && (!companyName || !businessNumber || !presidentName)) {
      console.error("[SIGNUP] 사업자회원 필수 필드 누락");
      return NextResponse.json(
        { error: "사업자 정보를 모두 입력해주세요" },
        { status: 400 }
      );
    }

    // Firebase 초기화
    console.log("[SIGNUP Step 2] Firebase 초기화");
    let firestore;
    if (getApps().length === 0) {
      const app = initializeApp({
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      });
      firestore = getFirestore(app);
    } else {
      firestore = getFirestore(getApps()[0]);
    }

    // 아이디 중복 체크
    console.log("[SIGNUP Step 3] 아이디 중복 체크:", userId);
    const suppliersRef = collection(firestore, "suppliers");
    const q = query(suppliersRef, where("userId", "==", userId));
    const existingSuppliers = await getDocs(q);

    if (!existingSuppliers.empty) {
      console.error("[SIGNUP] 아이디 중복:", userId);
      return NextResponse.json(
        {
          error: "이미 사용 중인 아이디입니다",
          details: "다른 아이디를 입력해주세요. 이미 가입된 계정이 있다면 로그인을 이용해주세요."
        },
        { status: 400 }
      );
    }

    // 비밀번호 해시
    console.log("[SIGNUP Step 4] 비밀번호 해싱");
    const hashedPassword = await hashPassword(password);

    // Firestore에 저장 (active 상태로 생성, 카페24 연동 실패 시 롤백으로 삭제됨)
    console.log("[SIGNUP Step 5] Firestore에 계정 생성 (status: active)");
    const supplierData = {
      accountType,
      userId,
      password: hashedPassword,
      companyName: companyName || name,
      name,
      phone,
      businessNumber: businessNumber || null,
      presidentName: presidentName || null,
      // [프로모션] 모든 회원 0% 수수료 적용 (기존: 사업자 10%, 개인 0%)
      commission: "0.00",
      // commission: accountType === "business" ? "10.00" : "0.00",
      // 계좌 정보는 보류
      // bankCode,
      // bankAccountNo,
      // bankAccountName,
      status: "active",
      cafe24SupplierNo: null,
      cafe24UserId: null,
      createdAt: new Date().toISOString(),
    };

    const supplierDoc = await addDoc(suppliersRef, supplierData);
    console.log("[SIGNUP Step 5] Firestore 계정 생성 완료, ID:", supplierDoc.id);

    // 카페24 연동
    let supplierCode: string | null = null;
    try {
      console.log("\n[SIGNUP Step 6] 카페24 공급사 생성 시작");

      // 카페24 토큰 가져오기
      const mallId = process.env.NEXT_PUBLIC_CAFE24_MALL_ID;
      if (!mallId) {
        throw new Error("Mall ID not configured");
      }

      const installDocRef = doc(firestore, "installs", mallId);
      const installDoc = await getDoc(installDocRef);
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
        console.log("[SIGNUP] Firestore 토큰 업데이트 완료");
      };

      const cafe24Client = new Cafe24ApiClient(mallId, installData.accessToken, {
        refreshToken: installData.refreshToken,
        clientId: process.env.CAFE24_CLIENT_ID,
        clientSecret: process.env.CAFE24_CLIENT_SECRET,
        onTokenRefresh,
      });

      // 카페24 공급사 생성 데이터
      const cafe24SupplierData: any = {
        supplier_name: companyName || name,
        use_supplier: "T",
        trading_type: "C",
        supplier_type: "BS",
        status: "A",
        business_item: "중고부품",
        payment_type: "P",
        // [프로모션] 모든 회원 0% 수수료 적용 (기존: 사업자 10%, 개인 0%)
        commission: "0.00",
        // commission: accountType === "business" ? "10.00" : "0.00",
        payment_period: "A",
        payment_method: "30",
        payment_start_date: 9,
        payment_end_date: 30,
        phone: phone,
        country_code: "KOR",
        zipcode: "00000",
        address1: "주소 미입력",
        address2: "",
        // 계좌 정보는 보류
        // bank_code: bankCode,
        // bank_account_no: bankAccountNo,
        // bank_account_name: bankAccountName,
        manager_information: [{
          no: 1,
          name: name,
          phone: phone
        }]
      };

      // 사업자회원만 추가 정보
      if (accountType === "business") {
        // 사업자등록번호를 하이픈 포함 형식으로 전송 (예: 118-81-20586)
        console.log("[SIGNUP Step 6-0] 사업자등록번호 처리:", {
          businessNumber: businessNumber,
          format: "하이픈 포함 형식으로 전송"
        });

        cafe24SupplierData.company_registration_no = businessNumber;
        cafe24SupplierData.company_name = companyName;
        cafe24SupplierData.president_name = presidentName;
      }

      console.log("[SIGNUP Step 6-1] 카페24 공급사 생성 요청:", {
        supplier_name: cafe24SupplierData.supplier_name,
        accountType,
        commission: cafe24SupplierData.commission,
        company_registration_no: cafe24SupplierData.company_registration_no,
        // 계좌 정보는 보류
        // bank_code: cafe24SupplierData.bank_code,
        // bank_account_name: cafe24SupplierData.bank_account_name
      });
      console.log("[SIGNUP Step 6-1] 전체 cafe24SupplierData:", JSON.stringify(cafe24SupplierData, null, 2));

      const cafe24SupplierResponse = await cafe24Client.createSupplier(cafe24SupplierData);
      supplierCode = cafe24SupplierResponse.supplier?.supplier_code;

      if (!supplierCode) {
        throw new Error("카페24 공급사 코드를 받지 못했습니다");
      }

      console.log("[SIGNUP Step 6-2] 카페24 공급사 생성 완료, 코드:", supplierCode);

      // 카페24 공급사 계좌 정보 업데이트 - 보류
      // console.log("[SIGNUP Step 6-3] 카페24 공급사 계좌 정보 업데이트 시작");
      // try {
      //   await cafe24Client.updateSupplier(supplierCode, {
      //     bank_code: bankCode,
      //     bank_account_no: bankAccountNo,
      //     bank_account_name: bankAccountName,
      //   });
      //   console.log("[SIGNUP Step 6-3] 카페24 공급사 계좌 정보 업데이트 완료");
      // } catch (bankUpdateError: any) {
      //   console.error("[SIGNUP Step 6-3] 계좌 정보 업데이트 실패:", bankUpdateError.message);
      //   console.error("[SIGNUP] 경고: 공급사는 생성되었으나 계좌 정보 업데이트 실패");
      //   // 계좌 정보 업데이트 실패는 치명적이지 않으므로 계속 진행
      // }

      // 카페24 공급사 사용자 생성
      console.log("[SIGNUP Step 7] 카페24 공급사 사용자 생성 시작");

      const cafe24UserResponse = await cafe24Client.createSupplierUser(supplierCode, {
        user_id: userId,
        user_name: name,
        password: password, // 원본 비밀번호 사용
        phone: phone
      });

      console.log("[SIGNUP Step 7] 카페24 사용자 생성 완료, ID:", userId);

      // 카페24 공급사 사용자 접속 비밀번호 업데이트
      console.log("[SIGNUP Step 7-1] 카페24 공급사 사용자 접속 비밀번호 업데이트 시작");

      await cafe24Client.updateSupplierUser(userId, {
        password: password, // 원본 비밀번호로 접속 비밀번호 설정
      });

      console.log("[SIGNUP Step 7-1] 카페24 사용자 접속 비밀번호 업데이트 완료");

      // Firestore에 카페24 연동 정보 업데이트
      console.log("[SIGNUP Step 8] Firestore에 카페24 연동 정보 업데이트");
      const { updateDoc } = await import("firebase/firestore");
      await updateDoc(doc(firestore, "suppliers", supplierDoc.id), {
        cafe24SupplierNo: supplierCode,
        cafe24UserId: userId,
        updatedAt: new Date().toISOString(),
      });

      console.log("[SIGNUP Step 8] 카페24 연동 정보 업데이트 완료");

    } catch (cafe24Error: any) {
      console.error("\n[SIGNUP] 카페24 연동 실패:", cafe24Error.message);
      console.error("[SIGNUP] 카페24 에러 상세:", cafe24Error);

      // 카페24 연동 실패 시 Firestore 데이터 삭제 (롤백)
      try {
        console.log("[SIGNUP] 카페24 연동 실패로 인한 Firestore 데이터 롤백 시작");
        console.log("[SIGNUP] 삭제할 Firestore 문서 ID:", supplierDoc.id);

        const { deleteDoc } = await import("firebase/firestore");
        await deleteDoc(doc(firestore, "suppliers", supplierDoc.id));

        console.log("[SIGNUP] Firestore 데이터 삭제 완료 - 사용자는 동일 아이디로 재시도 가능");
      } catch (deleteError: any) {
        console.error("[SIGNUP] Firestore 데이터 삭제 실패:", deleteError.message);
        console.error("[SIGNUP] 경고: 미승인 계정이 Firestore에 남아있을 수 있음 (문서 ID:", supplierDoc.id, ")");
      }

      // 에러 타입별 처리
      const errorMessage = cafe24Error.message || "";

      // 사업자번호 유효성 에러
      const isBusinessNumberError = errorMessage.includes("Invalid Business Registration Number")
        || errorMessage.includes("company_registration_no");

      if (isBusinessNumberError) {
        console.error("[SIGNUP] 사업자번호 유효성 검증 실패 - 사용자에게 안내 메시지 전송");
        return NextResponse.json(
          {
            error: "유효한 사업자등록번호를 입력해주세요",
            details: "입력하신 사업자등록번호가 국세청에 등록되지 않았거나 유효하지 않습니다. 실제 운영 중인 사업자등록번호를 입력해주세요."
          },
          { status: 400 }
        );
      }

      // 비밀번호 형식 에러
      const isPasswordError = errorMessage.includes("Password cannot contain more than four consecutive characters")
        || errorMessage.includes("parameter.password")
        || errorMessage.includes("Password should be");

      if (isPasswordError) {
        console.error("[SIGNUP] 비밀번호 형식 오류:", errorMessage);
        return NextResponse.json(
          {
            error: "비밀번호 형식이 올바르지 않습니다",
            details: "비밀번호는 영문 소문자와 숫자를 조합하여 10~16자로 입력해주세요. 동일하거나 연속된 문자 4개 이상은 사용할 수 없습니다."
          },
          { status: 400 }
        );
      }

      // 타임아웃 에러
      const isTimeoutError = errorMessage.includes("Timeout") || errorMessage.includes("timeout");

      if (isTimeoutError) {
        console.error("[SIGNUP] 카페24 API 타임아웃:", errorMessage);
        return NextResponse.json(
          {
            error: "회원가입 처리 중 시간이 초과되었습니다",
            details: "카페24 서버 응답이 지연되고 있습니다. 잠시 후 다시 시도해주세요. (Firestore 계정은 자동 삭제되었습니다)"
          },
          { status: 408 }
        );
      }

      return NextResponse.json(
        {
          error: "카페24 연동 중 오류가 발생했습니다",
          details: "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요. (Firestore 계정은 자동 삭제되었습니다)"
        },
        { status: 500 }
      );
    }

    // JWT 토큰 생성
    console.log("[SIGNUP Step 9] JWT 토큰 생성");
    const token = generateToken({
      supplierId: supplierDoc.id,
      email: userId,
    });

    const response: AuthResponse = {
      token,
      supplier: {
        id: supplierDoc.id,
        email: userId,
        companyName: companyName || name,
        phone: phone,
        status: "active",
        cafe24SupplierNo: supplierCode,
        createdAt: supplierData.createdAt,
      },
    };

    console.log("[SIGNUP Step 10] 회원가입 완료!");
    console.log("========== [SIGNUP] 회원가입 종료 ==========\n");

    return NextResponse.json(response, { status: 201 });

  } catch (error: any) {
    console.error("\n========== [SIGNUP] 치명적 오류 ==========");
    console.error("[SIGNUP] 에러 메시지:", error.message);
    console.error("[SIGNUP] 에러 스택:", error.stack);
    console.error("==========================================\n");

    return NextResponse.json(
      { error: "회원가입 처리 중 오류가 발생했습니다", details: error.message },
      { status: 500 }
    );
  }
}
