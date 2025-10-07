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
      hasPresidentName: !!body.presidentName
    });

    const {
      accountType,
      userId,
      password,
      companyName,
      name,
      phone,
      businessNumber,
      presidentName
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
        { error: "이미 사용 중인 아이디입니다" },
        { status: 400 }
      );
    }

    // 비밀번호 해시
    console.log("[SIGNUP Step 4] 비밀번호 해싱");
    const hashedPassword = await hashPassword(password);

    // Firestore에 임시 저장 (pending 상태)
    console.log("[SIGNUP Step 5] Firestore에 임시 계정 생성 (status: pending)");
    const supplierData = {
      accountType,
      userId,
      password: hashedPassword,
      companyName: companyName || name,
      name,
      phone,
      businessNumber: businessNumber || null,
      presidentName: presidentName || null,
      commission: accountType === "business" ? "10.00" : "0.00",
      status: "pending",
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

      const installDoc = await getDoc(doc(firestore, "installs", mallId));
      if (!installDoc.exists()) {
        throw new Error("카페24 앱이 설치되지 않았습니다");
      }

      const installData = installDoc.data();
      const cafe24Client = new Cafe24ApiClient(mallId, installData.accessToken);

      // 카페24 공급사 생성 데이터
      const cafe24SupplierData: any = {
        supplier_name: companyName || name,
        use_supplier: "T",
        trading_type: "D",
        supplier_type: "WS",
        status: "A",
        business_item: "중고부품",
        payment_type: "D",
        commission: accountType === "business" ? "10.00" : "0.00",
        payment_period: "A",
        payment_method: "30",
        payment_start_date: 9,
        payment_end_date: 30,
        phone: phone,
        country_code: "KOR",
        zipcode: "00000",
        address1: "주소 미입력",
        address2: "",
        manager_information: [{
          no: 1,
          name: name,
          phone: phone,
          email: email
        }]
      };

      // 사업자회원만 추가 정보
      if (accountType === "business") {
        cafe24SupplierData.company_registration_no = businessNumber;
        cafe24SupplierData.company_name = companyName;
        cafe24SupplierData.president_name = presidentName;
      }

      console.log("[SIGNUP Step 6-1] 카페24 공급사 생성 요청:", {
        supplier_name: cafe24SupplierData.supplier_name,
        accountType,
        commission: cafe24SupplierData.commission
      });

      const cafe24SupplierResponse = await cafe24Client.createSupplier(cafe24SupplierData);
      supplierCode = cafe24SupplierResponse.supplier?.supplier_code;

      if (!supplierCode) {
        throw new Error("카페24 공급사 코드를 받지 못했습니다");
      }

      console.log("[SIGNUP Step 6-2] 카페24 공급사 생성 완료, 코드:", supplierCode);

      // 카페24 공급사 사용자 생성
      console.log("[SIGNUP Step 7] 카페24 공급사 사용자 생성 시작");

      const cafe24UserResponse = await cafe24Client.createSupplierUser(supplierCode, {
        user_id: userId,
        user_name: name,
        password: password, // 원본 비밀번호 사용
        phone: phone,
        email: `${userId}@okparts.local` // 임시 이메일 생성
      });

      console.log("[SIGNUP Step 7] 카페24 사용자 생성 완료, ID:", userId);

      // Firestore 업데이트 (active 상태)
      console.log("[SIGNUP Step 8] Firestore 계정 활성화");
      const { updateDoc } = await import("firebase/firestore");
      await updateDoc(doc(firestore, "suppliers", supplierDoc.id), {
        status: "active",
        cafe24SupplierNo: supplierCode,
        cafe24UserId: userId,
        updatedAt: new Date().toISOString(),
      });

      console.log("[SIGNUP Step 8] 계정 활성화 완료");

    } catch (cafe24Error: any) {
      console.error("\n[SIGNUP] 카페24 연동 실패:", cafe24Error.message);
      console.error("[SIGNUP] 카페24 에러 상세:", cafe24Error);

      // 카페24 연동 실패 시에도 앱 내부 계정은 유지 (pending 상태)
      console.log("[SIGNUP] 앱 내부 계정은 pending 상태로 유지됨");

      return NextResponse.json(
        {
          error: "카페24 연동 중 오류가 발생했습니다",
          details: cafe24Error.message,
          note: "계정은 생성되었으나 승인 대기 중입니다"
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
