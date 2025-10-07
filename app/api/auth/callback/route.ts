import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForToken } from "@/lib/cafe24";
import { db } from "@/lib/firebase-admin";
import { doc, setDoc } from "firebase/firestore";

// 카페24 OAuth 콜백 처리
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const mall_id = searchParams.get("mall_id");

  // state 검증
  const savedState = request.cookies.get("oauth_state")?.value;

  if (!state || state !== savedState) {
    return NextResponse.json(
      { error: "Invalid state parameter" },
      { status: 400 }
    );
  }

  if (!code || !mall_id) {
    return NextResponse.json(
      { error: "Missing code or mall_id" },
      { status: 400 }
    );
  }

  const clientId = process.env.NEXT_PUBLIC_CAFE24_CLIENT_ID;
  const clientSecret = process.env.CAFE24_CLIENT_SECRET;
  const redirectUri = process.env.NEXT_PUBLIC_CAFE24_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.json(
      { error: "Missing Cafe24 configuration" },
      { status: 500 }
    );
  }

  try {
    // Authorization code를 access token으로 교환
    const tokenResponse = await exchangeCodeForToken(
      mall_id,
      code,
      clientId,
      clientSecret,
      redirectUri
    );

    // Firestore에 토큰 저장
    const installDoc = doc(db, "installs", mall_id);
    await setDoc(installDoc, {
      mallId: mall_id,
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      scopes: tokenResponse.scopes,
      installedAt: new Date().toISOString(),
      expiresAt: tokenResponse.expires_at,
      clientId: tokenResponse.client_id,
      userId: tokenResponse.user_id,
    });

    // 설치 완료 페이지로 리다이렉트
    return NextResponse.redirect(
      new URL("/install-success", request.url)
    );
  } catch (error: any) {
    console.error("OAuth callback error:", error);
    return NextResponse.json(
      { error: "Failed to complete OAuth flow", details: error.message },
      { status: 500 }
    );
  }
}
