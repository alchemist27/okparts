import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForToken } from "@/lib/cafe24";
import { doc, setDoc } from "firebase/firestore";

// 카페24 OAuth 콜백 처리
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  // state 검증
  const savedState = request.cookies.get("oauth_state")?.value;

  if (!state || state !== savedState) {
    return NextResponse.json(
      { error: "Invalid state parameter" },
      { status: 400 }
    );
  }

  if (!code) {
    return NextResponse.json(
      { error: "Missing authorization code" },
      { status: 400 }
    );
  }

  // mall_id를 여러 방법으로 시도
  let mall_id = searchParams.get("mall_id") ||
                request.cookies.get("mall_id")?.value ||
                process.env.NEXT_PUBLIC_CAFE24_MALL_ID;

  console.log("[OAuth Debug] Mall ID from query:", searchParams.get("mall_id"));
  console.log("[OAuth Debug] Mall ID from cookie:", request.cookies.get("mall_id")?.value);
  console.log("[OAuth Debug] Mall ID from env:", process.env.NEXT_PUBLIC_CAFE24_MALL_ID);
  console.log("[OAuth Debug] Final mall_id:", mall_id);

  if (!mall_id) {
    return NextResponse.json(
      { error: "Mall ID not configured" },
      { status: 500 }
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
    console.log("[OAuth Debug] Starting token exchange...");
    console.log("[OAuth Debug] Mall ID:", mall_id);
    console.log("[OAuth Debug] Client ID:", clientId);
    console.log("[OAuth Debug] Redirect URI:", redirectUri);
    console.log("[OAuth Debug] Code length:", code.length);
    console.log("[OAuth Debug] Client Secret exists:", !!clientSecret);

    // Authorization code를 access token으로 교환
    const tokenResponse = await exchangeCodeForToken(
      mall_id,
      code,
      clientId,
      clientSecret,
      redirectUri
    );

    console.log("[OAuth Debug] Token exchange successful!");

    // Firestore에 토큰 저장
    const { getFirestore } = await import("firebase/firestore");
    const { initializeApp, getApps } = await import("firebase/app");

    let firestore;
    if (getApps().length === 0) {
      const app = initializeApp({
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      });
      firestore = getFirestore(app);
    } else {
      firestore = getFirestore(getApps()[0]);
    }

    const installDoc = doc(firestore, "installs", mall_id);
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
