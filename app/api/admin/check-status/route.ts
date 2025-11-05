import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { collection, query, where, getDocs } from "firebase/firestore";

export async function POST(request: NextRequest) {
  console.log("\n========== [ADMIN] 계정 상태 확인 시작 ==========");

  try {
    const body = await request.json();
    const { userId } = body;

    console.log("[ADMIN Step 1] 요청 데이터:", { userId });

    if (!userId) {
      return NextResponse.json(
        { error: "userId는 필수입니다" },
        { status: 400 }
      );
    }

    // 계정 찾기
    console.log("[ADMIN Step 2] 계정 검색:", userId);
    const suppliersRef = collection(db, "suppliers");
    const q = query(suppliersRef, where("userId", "==", userId));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      console.error("[ADMIN] 계정을 찾을 수 없음:", userId);
      return NextResponse.json(
        { error: "계정을 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    const supplierDoc = snapshot.docs[0];
    const supplierData = supplierDoc.data();

    console.log("[ADMIN Step 3] 계정 정보:", {
      id: supplierDoc.id,
      userId: supplierData.userId,
      companyName: supplierData.companyName,
      status: supplierData.status,
      cafe24SupplierNo: supplierData.cafe24SupplierNo,
      cafe24UserId: supplierData.cafe24UserId,
      createdAt: supplierData.createdAt,
      updatedAt: supplierData.updatedAt,
    });

    console.log("========== [ADMIN] 계정 상태 확인 종료 ==========\n");

    return NextResponse.json({
      success: true,
      data: {
        id: supplierDoc.id,
        userId: supplierData.userId,
        accountType: supplierData.accountType,
        companyName: supplierData.companyName,
        name: supplierData.name,
        phone: supplierData.phone,
        status: supplierData.status,
        commission: supplierData.commission,
        cafe24SupplierNo: supplierData.cafe24SupplierNo,
        cafe24UserId: supplierData.cafe24UserId,
        businessNumber: supplierData.businessNumber,
        presidentName: supplierData.presidentName,
        createdAt: supplierData.createdAt,
        updatedAt: supplierData.updatedAt,
      }
    });

  } catch (error: any) {
    console.error("\n========== [ADMIN] 오류 발생 ==========");
    console.error("[ADMIN] 에러:", error.message);
    console.error("=======================================\n");

    return NextResponse.json(
      { error: "계정 조회 중 오류가 발생했습니다", details: error.message },
      { status: 500 }
    );
  }
}
