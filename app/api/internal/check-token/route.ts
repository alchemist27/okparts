import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

// 내부 토큰 상태 확인용 API
export async function GET(request: NextRequest) {
  try {
    const mallId = process.env.NEXT_PUBLIC_CAFE24_MALL_ID || "okayparts";

    // Firestore에서 토큰 조회
    const tokenDoc = await adminDb
      .collection("cafe24_tokens")
      .doc(mallId)
      .get();

    if (!tokenDoc.exists) {
      return NextResponse.json(
        { error: "토큰이 존재하지 않습니다" },
        { status: 404 }
      );
    }

    const tokenData = tokenDoc.data();
    const expiresAt = tokenData?.expiresAt;
    const now = Date.now();
    const isExpired = expiresAt ? now > expiresAt : true;

    return NextResponse.json({
      mallId,
      hasAccessToken: !!tokenData?.accessToken,
      hasRefreshToken: !!tokenData?.refreshToken,
      accessTokenPreview: tokenData?.accessToken?.substring(0, 30) + "...",
      refreshTokenPreview: tokenData?.refreshToken?.substring(0, 30) + "...",
      expiresAt: expiresAt ? new Date(expiresAt).toLocaleString("ko-KR") : "없음",
      isExpired,
      timeUntilExpiry: expiresAt
        ? Math.floor((expiresAt - now) / 1000 / 60) + "분"
        : "N/A",
    });
  } catch (error: any) {
    console.error("[Token Check] 에러:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
