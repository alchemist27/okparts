import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { collection, query, where, getDocs, doc, updateDoc } from "firebase/firestore";
import { Cafe24ApiClient } from "@/lib/cafe24";

/**
 * 백그라운드 작업: pending 상태인 카페24 사용자 생성
 * Vercel Cron으로 5분마다 실행
 * GET /api/internal/process-pending-cafe24-users
 */
export async function GET(request: NextRequest) {
  console.log("\n========== [BACKGROUND] 카페24 사용자 생성 작업 시작 ==========");

  try {
    // pending 상태인 공급사 조회
    const suppliersRef = collection(db, "suppliers");
    const q = query(
      suppliersRef,
      where("cafe24UserStatus", "==", "pending")
    );

    const pendingSnapshot = await getDocs(q);
    console.log(`[BACKGROUND] pending 상태 계정 수: ${pendingSnapshot.docs.length}개`);

    if (pendingSnapshot.empty) {
      console.log("[BACKGROUND] 처리할 계정이 없습니다");
      return NextResponse.json({
        success: true,
        message: "처리할 계정이 없습니다",
        processed: 0,
      });
    }

    const results = {
      total: pendingSnapshot.docs.length,
      success: 0,
      failed: 0,
      retryLater: 0,
    };

    // 카페24 클라이언트 초기화
    const mallId = process.env.NEXT_PUBLIC_CAFE24_MALL_ID;
    if (!mallId) {
      throw new Error("Mall ID not configured");
    }

    const installDocRef = doc(db, "installs", mallId);
    const installDoc = await (async () => {
      const { getDoc } = await import("firebase/firestore");
      return getDoc(installDocRef);
    })();

    if (!installDoc.exists()) {
      throw new Error("Cafe24 app not installed");
    }

    const installData = installDoc.data();

    const onTokenRefresh = async (newAccessToken: string, newRefreshToken: string, expiresAt: string) => {
      await updateDoc(installDocRef, {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresAt: expiresAt,
        updatedAt: new Date().toISOString(),
      });
    };

    const cafe24Client = new Cafe24ApiClient(mallId, installData.accessToken, {
      refreshToken: installData.refreshToken,
      clientId: process.env.CAFE24_CLIENT_ID,
      clientSecret: process.env.CAFE24_CLIENT_SECRET,
      onTokenRefresh,
    });

    // 각 pending 계정 처리
    for (const supplierDoc of pendingSnapshot.docs) {
      const supplierId = supplierDoc.id;
      const data = supplierDoc.data();

      console.log(`\n[BACKGROUND] 처리 시작: ${data.userId} (${supplierId})`);
      console.log(`[BACKGROUND] 재시도 횟수: ${data.cafe24UserRetryCount || 0}`);

      // 3회 이상 실패한 경우 failed 상태로 변경
      if ((data.cafe24UserRetryCount || 0) >= 3) {
        console.warn(`[BACKGROUND] ${data.userId}: 3회 실패, failed 상태로 변경`);
        await updateDoc(doc(db, "suppliers", supplierId), {
          cafe24UserStatus: "failed",
          cafe24UserLastAttempt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        results.failed++;
        continue;
      }

      try {
        // 사용자 생성 (20초 타임아웃)
        console.log(`[BACKGROUND] ${data.userId}: 사용자 생성 시도`);

        const userCreationPromise = cafe24Client.createSupplierUser(data.cafe24SupplierNo, {
          user_id: data.userId,
          user_name: data.name,
          password: data.cafe24UserPassword, // 저장된 원본 비밀번호
          phone: data.phone,
        });

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Timeout after 20 seconds")), 20000)
        );

        await Promise.race([userCreationPromise, timeoutPromise]);

        console.log(`[BACKGROUND] ${data.userId}: 사용자 생성 완료`);

        // 비밀번호 업데이트 (20초 타임아웃)
        console.log(`[BACKGROUND] ${data.userId}: 비밀번호 업데이트 시도`);

        const passwordUpdatePromise = cafe24Client.updateSupplierUser(data.userId, {
          password: data.cafe24UserPassword,
        });

        const passwordTimeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Timeout after 20 seconds")), 20000)
        );

        await Promise.race([passwordUpdatePromise, passwordTimeoutPromise]);

        console.log(`[BACKGROUND] ${data.userId}: 비밀번호 업데이트 완료`);

        // 성공: completed 상태로 변경
        await updateDoc(doc(db, "suppliers", supplierId), {
          cafe24UserId: data.userId,
          cafe24UserStatus: "completed",
          cafe24UserRetryCount: 0,
          cafe24UserLastAttempt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        console.log(`[BACKGROUND] ${data.userId}: ✅ 완료`);
        results.success++;

      } catch (error: any) {
        console.error(`[BACKGROUND] ${data.userId}: ❌ 에러:`, error.message);

        const retryCount = (data.cafe24UserRetryCount || 0) + 1;

        // 재시도 횟수 증가
        await updateDoc(doc(db, "suppliers", supplierId), {
          cafe24UserRetryCount: retryCount,
          cafe24UserLastAttempt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        console.warn(`[BACKGROUND] ${data.userId}: 재시도 횟수 ${retryCount}/3`);
        results.retryLater++;
      }
    }

    console.log("\n[BACKGROUND] 처리 결과:");
    console.log(`- 총 처리: ${results.total}개`);
    console.log(`- 성공: ${results.success}개`);
    console.log(`- 재시도 예정: ${results.retryLater}개`);
    console.log(`- 실패(3회): ${results.failed}개`);
    console.log("========== [BACKGROUND] 작업 완료 ==========\n");

    return NextResponse.json({
      success: true,
      message: "백그라운드 작업 완료",
      results,
    });

  } catch (error: any) {
    console.error("\n========== [BACKGROUND] 치명적 오류 ==========");
    console.error("[BACKGROUND] 에러:", error.message);
    console.error("[BACKGROUND] 스택:", error.stack);
    console.error("===============================================\n");

    return NextResponse.json(
      {
        success: false,
        error: "백그라운드 작업 실패",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
