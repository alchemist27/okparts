import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { Cafe24ApiClient } from "@/lib/cafe24";

export async function GET(request: NextRequest) {
  try {
    // Cafe24 토큰 가져오기
    const mallId = process.env.NEXT_PUBLIC_CAFE24_MALL_ID;

    if (!mallId) {
      return NextResponse.json(
        { error: "Mall ID not configured" },
        { status: 500 }
      );
    }

    const installDoc = await getDoc(doc(db, "installs", mallId));

    if (!installDoc.exists()) {
      return NextResponse.json(
        { error: "App not installed. Please install the app first." },
        { status: 401 }
      );
    }

    const installData = installDoc.data();
    const client = new Cafe24ApiClient(mallId, installData.accessToken);

    // 카테고리 조회
    const categoriesResponse = await client.getCategories();

    // 카테고리 데이터 변환
    const categories = categoriesResponse.categories?.map((cat: any) => ({
      id: cat.category_no.toString(),
      name: cat.category_name,
      parentId: cat.parent_category_no
        ? cat.parent_category_no.toString()
        : undefined,
    })) || [];

    return NextResponse.json({ categories });
  } catch (error: any) {
    console.error("Category fetch error:", error);

    // 토큰 만료 시 재발급 로직 필요
    if (error.message.includes("401") || error.message.includes("token")) {
      return NextResponse.json(
        { error: "Token expired. Please reinstall the app." },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch categories", details: error.message },
      { status: 500 }
    );
  }
}
