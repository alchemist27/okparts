import { NextRequest, NextResponse } from "next/server";
import { getOAuthUrl } from "@/lib/cafe24";

// 대표운영자가 앱을 설치할 때 OAuth 플로우 시작
export async function GET(request: NextRequest) {
  const mallId = process.env.NEXT_PUBLIC_CAFE24_MALL_ID;
  const clientId = process.env.NEXT_PUBLIC_CAFE24_CLIENT_ID;
  const redirectUri = process.env.NEXT_PUBLIC_CAFE24_REDIRECT_URI;

  if (!mallId || !clientId || !redirectUri) {
    return NextResponse.json(
      { error: "Missing Cafe24 configuration" },
      { status: 500 }
    );
  }

  // state: CSRF 방지용 랜덤 문자열
  const state = Math.random().toString(36).substring(7);

  // state와 mall_id를 쿠키에 저장
  const oauthUrl = getOAuthUrl(mallId, clientId, redirectUri, state);

  const response = NextResponse.redirect(oauthUrl);
  response.cookies.set("oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10분
  });
  response.cookies.set("mall_id", mallId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10분
  });

  console.log("[Install Debug] Redirecting to OAuth with mall_id:", mallId);

  return response;
}
