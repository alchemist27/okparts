import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { collection, query, where, getDocs } from "firebase/firestore";

/**
 * 카페24 사용자 상태 확인 API
 * GET /api/admin/check-cafe24-user-status?userId=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      // userId 없으면 모든 pending 계정 조회
      const suppliersRef = collection(db, "suppliers");
      const q = query(suppliersRef, where("cafe24UserStatus", "==", "pending"));
      const snapshot = await getDocs(q);

      const pendingAccounts = snapshot.docs.map(doc => ({
        id: doc.id,
        userId: doc.data().userId,
        cafe24UserStatus: doc.data().cafe24UserStatus,
        cafe24UserId: doc.data().cafe24UserId,
        cafe24SupplierNo: doc.data().cafe24SupplierNo,
        retryCount: doc.data().cafe24UserRetryCount,
        lastAttempt: doc.data().cafe24UserLastAttempt,
      }));

      return NextResponse.json({
        success: true,
        pendingCount: pendingAccounts.length,
        accounts: pendingAccounts,
      });
    }

    // 특정 userId 조회
    const suppliersRef = collection(db, "suppliers");
    const q = query(suppliersRef, where("userId", "==", userId));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return NextResponse.json({
        success: false,
        message: "계정을 찾을 수 없습니다",
      }, { status: 404 });
    }

    const doc = snapshot.docs[0];
    const data = doc.data();

    return NextResponse.json({
      success: true,
      account: {
        id: doc.id,
        userId: data.userId,
        cafe24UserStatus: data.cafe24UserStatus,
        cafe24UserId: data.cafe24UserId,
        cafe24SupplierNo: data.cafe24SupplierNo,
        cafe24UserRetryCount: data.cafe24UserRetryCount,
        cafe24UserLastAttempt: data.cafe24UserLastAttempt,
        cafe24UserPassword: data.cafe24UserPassword ? "설정됨" : "없음",
      },
    });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}
