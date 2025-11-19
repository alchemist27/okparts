import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { collection, addDoc, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { hashPassword } from "@/lib/auth";
import { Cafe24ApiClient } from "@/lib/cafe24";

// 관리자용: Firebase에 공급사 계정 수동 생성
export async function POST(request: NextRequest) {
  console.log("\n========== [Admin] 공급사 계정 수동 생성 ==========");

  try {
    const body = await request.json();
    const {
      userId,
      cafe24SupplierNo,
      phone,
      businessNumber,
      accountType = "business",
      password,
    } = body;

    console.log("[Admin] 요청 데이터:", {
      userId,
      cafe24SupplierNo,
      phone,
      businessNumber,
      accountType,
      hasPassword: !!password,
    });

    // 유효성 검사
    if (!userId || !cafe24SupplierNo) {
      return NextResponse.json(
        { error: "userId and cafe24SupplierNo are required" },
        { status: 400 }
      );
    }

    // 중복 체크
    const suppliersRef = collection(db, "suppliers");
    const q = query(suppliersRef, where("userId", "==", userId));
    const existingSuppliers = await getDocs(q);

    if (!existingSuppliers.empty) {
      console.log("[Admin] ❌ 이미 존재하는 계정:", userId);
      return NextResponse.json(
        { error: `"${userId}" 계정이 이미 존재합니다` },
        { status: 400 }
      );
    }

    // 카페24에서 공급사 정보 조회
    console.log("[Admin] 카페24에서 공급사 정보 조회 중...");
    let companyName = "";
    let presidentName = "";
    let supplierPhone = phone || "";

    try {
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

      const cafe24Client = new Cafe24ApiClient(mallId, installData.accessToken, {
        refreshToken: installData.refreshToken,
        clientId: process.env.CAFE24_CLIENT_ID,
        clientSecret: process.env.CAFE24_CLIENT_SECRET,
      });

      // 카페24 공급사 정보 조회
      const suppliersResponse = await cafe24Client.getSuppliers();
      const cafe24Supplier = suppliersResponse.suppliers?.find(
        (s: any) => s.supplier_code === cafe24SupplierNo
      );

      if (cafe24Supplier) {
        companyName = cafe24Supplier.supplier_name || "";
        presidentName = cafe24Supplier.president_name || "";
        supplierPhone = cafe24Supplier.phone || phone || "";

        console.log("[Admin] 카페24 공급사 정보 조회 성공:");
        console.log("  - 공급사명:", companyName);
        console.log("  - 대표자명:", presidentName);
        console.log("  - 연락처:", supplierPhone);
      } else {
        console.log("[Admin] ⚠️ 카페24에서 공급사를 찾을 수 없음, 기본값 사용");
        companyName = userId;
        presidentName = userId;
        supplierPhone = phone || "010-0000-0000";
      }
    } catch (cafe24Error: any) {
      console.error("[Admin] 카페24 조회 실패:", cafe24Error.message);
      console.log("[Admin] 기본값 사용");
      companyName = userId;
      presidentName = userId;
      supplierPhone = phone || "010-0000-0000";
    }

    // 비밀번호 생성 또는 사용
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

    const plainPassword = password || generateRandomPassword();
    console.log("[Admin] 비밀번호:", plainPassword);

    // 비밀번호 해시
    const hashedPassword = await hashPassword(plainPassword);

    // Firestore에 계정 생성
    const supplierData = {
      accountType,
      userId,
      password: hashedPassword,
      companyName: accountType === "business" ? companyName : userId,
      name: accountType === "business" ? presidentName : userId,
      phone: supplierPhone,
      businessNumber: accountType === "business" ? businessNumber : null,
      presidentName: accountType === "business" ? presidentName : null,
      commission: "0.00",
      status: "active",
      cafe24SupplierNo: cafe24SupplierNo,
      cafe24UserId: null,
      cafe24UserStatus: "not_started",
      cafe24UserRetryCount: 0,
      cafe24UserLastAttempt: null,
      cafe24UserPassword: plainPassword,
      signupSource: "admin_manual",
      createdAt: new Date().toISOString(),
    };

    const supplierDoc = await addDoc(suppliersRef, supplierData);
    console.log("[Admin] ✅ Firestore 계정 생성 완료, ID:", supplierDoc.id);

    console.log("\n========== [Admin] 계정 정보 ==========");
    console.log("  - Firebase ID:", supplierDoc.id);
    console.log("  - userId:", userId);
    console.log("  - 비밀번호:", plainPassword);
    console.log("  - 회사명:", companyName);
    console.log("  - 대표자명:", presidentName);
    console.log("  - 연락처:", supplierPhone);
    console.log("  - 사업자번호:", businessNumber || "없음");
    console.log("  - 공급사코드:", cafe24SupplierNo);
    console.log("  - accountType:", accountType);
    console.log("=========================================\n");

    return NextResponse.json({
      success: true,
      supplier: {
        id: supplierDoc.id,
        userId,
        password: plainPassword,
        companyName,
        presidentName,
        phone: supplierPhone,
        businessNumber,
        cafe24SupplierNo,
        accountType,
      },
    });

  } catch (error: any) {
    console.error("\n[Admin] ❌ 에러 발생:", error.message);
    console.error(error);
    console.error("=========================================\n");

    return NextResponse.json(
      { error: "Failed to create supplier", details: error.message },
      { status: 500 }
    );
  }
}
