import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { doc, getDoc } from "firebase/firestore";
import { verifyToken } from "@/lib/auth";

// JWT 토큰으로 현재 사용자 정보 조회
export async function GET(request: NextRequest) {
  console.log("\n========== [ME] 사용자 정보 조회 시작 ==========");

  try {
    // Authorization 헤더에서 토큰 추출
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.error("[ME] Authorization 헤더 없음 또는 형식 오류");
      return NextResponse.json(
        { error: "인증 토큰이 필요합니다" },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7); // "Bearer " 제거

    // JWT 토큰 검증
    console.log("[ME] JWT 토큰 검증 중...");
    const decoded = verifyToken(token);

    if (!decoded || !decoded.supplierId) {
      console.error("[ME] 유효하지 않은 토큰");
      return NextResponse.json(
        { error: "유효하지 않은 토큰입니다" },
        { status: 401 }
      );
    }

    console.log("[ME] 토큰 검증 완료, supplierId:", decoded.supplierId);

    // Firestore에서 사용자 정보 조회
    const supplierDocRef = doc(db, "suppliers", decoded.supplierId);
    const supplierDoc = await getDoc(supplierDocRef);

    if (!supplierDoc.exists()) {
      console.error("[ME] 사용자를 찾을 수 없음:", decoded.supplierId);
      return NextResponse.json(
        { error: "사용자를 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    const supplierData = supplierDoc.data();

    // 계정 상태 확인
    if (supplierData.status === "blocked") {
      console.error("[ME] 차단된 계정:", decoded.supplierId);
      return NextResponse.json(
        { error: "차단된 계정입니다" },
        { status: 403 }
      );
    }

    console.log("[ME] 사용자 정보 조회 성공");
    console.log("========== [ME] 조회 완료 ==========\n");

    return NextResponse.json({
      supplier: {
        id: supplierDoc.id,
        userId: supplierData.userId,
        email: supplierData.userId, // 호환성을 위해 유지
        companyName: supplierData.companyName,
        phone: supplierData.phone,
        status: supplierData.status,
        cafe24SupplierNo: supplierData.cafe24SupplierNo,
        createdAt: supplierData.createdAt,
      },
    });
  } catch (error: any) {
    console.error("\n========== [ME] 치명적 오류 ==========");
    console.error("[ME] 에러 메시지:", error.message);
    console.error("[ME] 에러 스택:", error.stack);
    console.error("======================================\n");

    return NextResponse.json(
      { error: "사용자 정보 조회 중 오류가 발생했습니다", details: error.message },
      { status: 500 }
    );
  }
}
