import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { doc, getDoc, updateDoc } from "firebase/firestore";

// SMS 발신번호 목록 조회
export async function GET(request: NextRequest) {
  console.log("\n========== [SMS Senders] 발신번호 조회 시작 ==========");

  try {
    const { Cafe24ApiClient } = await import("@/lib/cafe24");
    const mallId = process.env.NEXT_PUBLIC_CAFE24_MALL_ID;

    if (!mallId) {
      throw new Error("Mall ID not configured");
    }

    const installDocRef = doc(db, "installs", mallId);
    const installDoc = await getDoc(installDocRef);

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

    console.log("[SMS Senders] 카페24 API 호출 중...");
    const result = await cafe24Client.getSmsSenders();

    console.log("[SMS Senders] 조회 성공!");
    console.log("[SMS Senders] 결과:", JSON.stringify(result, null, 2));
    console.log("========== [SMS Senders] 발신번호 조회 완료 ==========\n");

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error("\n========== [SMS Senders] 에러 발생 ==========");
    console.error("[SMS Senders] 에러 메시지:", error.message);
    console.error("[SMS Senders] 에러 스택:", error.stack);
    console.error("=============================================\n");

    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
