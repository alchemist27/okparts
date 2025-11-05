import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { collection, query, where, getDocs, updateDoc, doc } from "firebase/firestore";

export async function POST(request: NextRequest) {
  console.log("\n========== [ADMIN] 계정 상태 업데이트 시작 ==========");

  try {
    const body = await request.json();
    const { userId, status } = body;

    console.log("[ADMIN Step 1] 요청 데이터:", { userId, status });

    if (!userId || !status) {
      return NextResponse.json(
        { error: "userId와 status는 필수입니다" },
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

    console.log("[ADMIN Step 3] 현재 계정 정보:", {
      id: supplierDoc.id,
      userId: supplierData.userId,
      companyName: supplierData.companyName,
      currentStatus: supplierData.status,
    });

    // 상태 업데이트
    console.log("[ADMIN Step 4] 상태 업데이트:", status);
    await updateDoc(doc(db, "suppliers", supplierDoc.id), {
      status: status,
      updatedAt: new Date().toISOString(),
    });

    console.log("[ADMIN Step 5] 업데이트 완료!");
    console.log("========== [ADMIN] 계정 상태 업데이트 종료 ==========\n");

    return NextResponse.json({
      success: true,
      message: `${userId} 계정의 상태가 ${status}로 변경되었습니다`,
      data: {
        id: supplierDoc.id,
        userId: supplierData.userId,
        companyName: supplierData.companyName,
        previousStatus: supplierData.status,
        newStatus: status,
      }
    });

  } catch (error: any) {
    console.error("\n========== [ADMIN] 오류 발생 ==========");
    console.error("[ADMIN] 에러:", error.message);
    console.error("=======================================\n");

    return NextResponse.json(
      { error: "상태 업데이트 중 오류가 발생했습니다", details: error.message },
      { status: 500 }
    );
  }
}
