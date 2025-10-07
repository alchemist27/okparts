import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { verifyToken } from "@/lib/auth";
import { Cafe24ApiClient } from "@/lib/cafe24";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: productId } = await params;

    // 토큰 검증
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const payload = verifyToken(token);

    if (!payload) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // 상품 정보 조회
    const productDoc = await getDoc(doc(db, "products", productId));

    if (!productDoc.exists()) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const productData = productDoc.data();

    // 소유권 확인
    if (productData.supplierId !== payload.supplierId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

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
        { error: "App not installed" },
        { status: 401 }
      );
    }

    const installData = installDoc.data();
    const client = new Cafe24ApiClient(mallId, installData.accessToken);

    // 카페24에 상품 등록
    const cafe24ProductData = {
      product_name: productData.name,
      selling_price: productData.price,
      supply_price: productData.price,
      display: "T", // 진열 상태
      selling: "T", // 판매 상태
      product_condition: "U", // 중고
      ...(productData.description && {
        simple_description: productData.description,
      }),
      ...(productData.stockQty && {
        quantity: productData.stockQty,
      }),
      ...(productData.categoryIds.length > 0 && {
        category: [{ category_no: parseInt(productData.categoryIds[0]) }],
      }),
    };

    const cafe24Response = await client.createProduct(cafe24ProductData);

    // 카페24 상품 번호 저장
    const cafe24ProductNo =
      cafe24Response.product?.product_no ||
      cafe24Response.products?.[0]?.product_no;

    if (!cafe24ProductNo) {
      throw new Error("Failed to get product number from Cafe24");
    }

    // Firestore 업데이트
    await updateDoc(doc(db, "products", productId), {
      cafe24ProductNo: cafe24ProductNo.toString(),
      status: "active",
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      cafe24ProductNo,
    });
  } catch (error: any) {
    console.error("Product publish error:", error);

    // 에러 응답 처리
    let errorMessage = "Failed to publish product";
    let statusCode = 500;

    if (error.message.includes("401") || error.message.includes("token")) {
      errorMessage = "Token expired. Please reinstall the app.";
      statusCode = 401;
    } else if (error.message.includes("429")) {
      errorMessage = "Rate limit exceeded. Please try again later.";
      statusCode = 429;
    }

    return NextResponse.json(
      { error: errorMessage, details: error.message },
      { status: statusCode }
    );
  }
}
