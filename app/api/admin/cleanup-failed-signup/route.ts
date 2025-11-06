import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { collection, query, where, getDocs, deleteDoc, doc } from "firebase/firestore";

/**
 * 카페24 연동 실패한 계정 정리 API
 * GET /api/admin/cleanup-failed-signup?userId=xxx
 */
export async function GET(request: NextRequest) {
  console.log("\n========== [ADMIN] 실패한 회원가입 정리 시작 ==========");

  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "userId 파라미터가 필요합니다" },
        { status: 400 }
      );
    }

    console.log("[ADMIN] 삭제 대상 userId:", userId);

    // userId로 공급사 조회
    const suppliersRef = collection(db, "suppliers");
    const q = query(suppliersRef, where("userId", "==", userId));
    const supplierSnapshot = await getDocs(q);

    if (supplierSnapshot.empty) {
      console.log("[ADMIN] 해당 userId를 가진 계정이 없음:", userId);
      return NextResponse.json({
        success: true,
        message: "이미 삭제되었거나 존재하지 않는 계정입니다",
        userId,
      });
    }

    // 모든 일치하는 계정 삭제
    const deletedDocs: string[] = [];
    for (const supplierDoc of supplierSnapshot.docs) {
      const docId = supplierDoc.id;
      const data = supplierDoc.data();

      console.log("[ADMIN] 삭제할 계정:", {
        id: docId,
        userId: data.userId,
        cafe24SupplierNo: data.cafe24SupplierNo,
        status: data.status,
        createdAt: data.createdAt,
      });

      await deleteDoc(doc(db, "suppliers", docId));
      deletedDocs.push(docId);
      console.log("[ADMIN] 계정 삭제 완료:", docId);
    }

    console.log("[ADMIN] 총", deletedDocs.length, "개 계정 삭제 완료");
    console.log("========== [ADMIN] 정리 완료 ==========\n");

    return NextResponse.json({
      success: true,
      message: `${deletedDocs.length}개 계정이 삭제되었습니다`,
      userId,
      deletedDocIds: deletedDocs,
    });
  } catch (error: any) {
    console.error("\n========== [ADMIN] 정리 중 오류 발생 ==========");
    console.error("[ADMIN] 에러:", error.message);
    console.error("===============================================\n");

    return NextResponse.json(
      { error: "계정 정리 중 오류가 발생했습니다", details: error.message },
      { status: 500 }
    );
  }
}
