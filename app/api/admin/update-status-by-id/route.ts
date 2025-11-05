import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { doc, getDoc, updateDoc } from "firebase/firestore";

export async function POST(request: NextRequest) {
  console.log("\n========== [ADMIN] 문서 ID로 계정 상태 업데이트 시작 ==========");

  try {
    const body = await request.json();
    const { docId, status } = body;

    console.log("[ADMIN Step 1] 요청 데이터:", { docId, status });

    if (!docId || !status) {
      return NextResponse.json(
        { error: "docId와 status는 필수입니다" },
        { status: 400 }
      );
    }

    // 문서 가져오기
    console.log("[ADMIN Step 2] 문서 가져오기:", docId);
    const docRef = doc(db, "suppliers", docId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      console.error("[ADMIN] 문서를 찾을 수 없음:", docId);
      return NextResponse.json(
        { error: "문서를 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    const supplierData = docSnap.data();

    console.log("[ADMIN Step 3] 현재 계정 정보:", {
      id: docSnap.id,
      userId: supplierData.userId,
      companyName: supplierData.companyName,
      currentStatus: supplierData.status,
    });

    // 상태 업데이트
    console.log("[ADMIN Step 4] 상태 업데이트:", status);
    await updateDoc(docRef, {
      status: status,
      updatedAt: new Date().toISOString(),
    });

    console.log("[ADMIN Step 5] 업데이트 완료!");
    console.log("========== [ADMIN] 계정 상태 업데이트 종료 ==========\n");

    return NextResponse.json({
      success: true,
      message: `${supplierData.userId} 계정의 상태가 ${status}로 변경되었습니다`,
      data: {
        id: docSnap.id,
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
