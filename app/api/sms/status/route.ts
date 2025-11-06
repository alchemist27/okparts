import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { doc, getDoc } from "firebase/firestore";
import { Cafe24ApiClient } from "@/lib/cafe24";

// SMS 발송 상태 조회
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const queueCode = searchParams.get("queue_code");

    if (!queueCode) {
      return NextResponse.json(
        { error: "queue_code 파라미터가 필요합니다" },
        { status: 400 }
      );
    }

    console.log(`[SMS Status] Queue Code 조회: ${queueCode}`);

    // Cafe24 API 클라이언트 초기화
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

    const cafe24Client = new Cafe24ApiClient(mallId, installData.accessToken, {
      refreshToken: installData.refreshToken,
      clientId: process.env.CAFE24_CLIENT_ID,
      clientSecret: process.env.CAFE24_CLIENT_SECRET,
    });

    // SMS 발송 상태 조회
    const response = await cafe24Client.request(
      "GET",
      `/admin/sms/${queueCode}`
    );

    console.log(`[SMS Status] 조회 성공:`, response);

    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error: any) {
    console.error("[SMS Status] 조회 실패:", error.message);

    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
