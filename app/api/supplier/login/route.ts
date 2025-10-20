import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { collection, query, where, getDocs } from "firebase/firestore";
import { comparePassword, generateToken } from "@/lib/auth";
import { LoginRequest, AuthResponse } from "@/types";

export async function POST(request: NextRequest) {
  console.log("\n========== [LOGIN] 로그인 시작 ==========");

  try {
    const body = await request.json();
    const { userId, password } = body;

    console.log("[LOGIN Step 1] 요청 데이터 수신:", { userId, hasPassword: !!password });

    // 유효성 검사
    if (!userId || !password) {
      console.error("[LOGIN] 필수 필드 누락");
      return NextResponse.json(
        { error: "아이디와 비밀번호를 입력해주세요" },
        { status: 400 }
      );
    }

    // 공급사 조회
    console.log("[LOGIN Step 2] 공급사 검색:", userId);
    const suppliersRef = collection(db, "suppliers");
    const q = query(suppliersRef, where("userId", "==", userId));
    const supplierSnapshot = await getDocs(q);

    if (supplierSnapshot.empty) {
      console.error("[LOGIN] 계정을 찾을 수 없음:", userId);
      return NextResponse.json(
        { error: "아이디 또는 비밀번호가 일치하지 않습니다" },
        { status: 401 }
      );
    }

    const supplierDoc = supplierSnapshot.docs[0];
    const supplierData = supplierDoc.data();

    console.log("[LOGIN Step 3] 계정 상태 확인:", {
      status: supplierData.status,
      id: supplierDoc.id
    });

    // 계정 상태 확인
    if (supplierData.status === "pending") {
      console.error("[LOGIN] 승인 대기중인 계정:", userId);
      return NextResponse.json(
        { error: "승인 대기 중인 계정입니다. 관리자에게 문의해주세요" },
        { status: 403 }
      );
    }

    if (supplierData.status === "blocked") {
      console.error("[LOGIN] 차단된 계정:", userId);
      return NextResponse.json(
        { error: "차단된 계정입니다. 관리자에게 문의하세요" },
        { status: 403 }
      );
    }

    // 비밀번호 확인
    console.log("[LOGIN Step 4] 비밀번호 확인");
    const isPasswordValid = await comparePassword(
      password,
      supplierData.password
    );

    if (!isPasswordValid) {
      console.error("[LOGIN] 비밀번호 불일치:", userId);
      return NextResponse.json(
        { error: "아이디 또는 비밀번호가 일치하지 않습니다" },
        { status: 401 }
      );
    }

    console.log("[LOGIN Step 5] 비밀번호 확인 완료");

    // JWT 토큰 생성
    console.log("[LOGIN Step 6] JWT 토큰 생성");
    const token = generateToken({
      supplierId: supplierDoc.id,
      email: supplierData.userId,
    });

    const response: AuthResponse = {
      token,
      supplier: {
        id: supplierDoc.id,
        email: supplierData.userId,
        companyName: supplierData.companyName,
        phone: supplierData.phone,
        status: supplierData.status,
        cafe24SupplierNo: supplierData.cafe24SupplierNo,
        createdAt: supplierData.createdAt,
      },
    };

    console.log("[LOGIN Step 7] 로그인 성공!");
    console.log("========== [LOGIN] 로그인 종료 ==========\n");

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("\n========== [LOGIN] 치명적 오류 ==========");
    console.error("[LOGIN] 에러 메시지:", error.message);
    console.error("[LOGIN] 에러 스택:", error.stack);
    console.error("==========================================\n");

    return NextResponse.json(
      { error: "로그인 처리 중 오류가 발생했습니다", details: error.message },
      { status: 500 }
    );
  }
}
