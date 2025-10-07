import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, addDoc, query, where, getDocs, orderBy } from "firebase/firestore";
import { verifyToken } from "@/lib/auth";

// 내 상품 목록 조회
export async function GET(request: NextRequest) {
  try {
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

    // 내 상품만 조회
    const productsRef = collection(db, "products");
    const q = query(
      productsRef,
      where("supplierId", "==", payload.supplierId),
      orderBy("createdAt", "desc")
    );

    const productsSnapshot = await getDocs(q);
    const products = productsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({ products });
  } catch (error: any) {
    console.error("Products fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500 }
    );
  }
}

// 상품 등록 (draft)
export async function POST(request: NextRequest) {
  try {
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

    const body = await request.json();
    const { name, price, description, categoryIds, stockQty } = body;

    // 유효성 검사
    if (!name || !price) {
      return NextResponse.json(
        { error: "Name and price are required" },
        { status: 400 }
      );
    }

    // Firestore에 상품 저장 (draft 상태)
    const productsRef = collection(db, "products");
    const productDoc = await addDoc(productsRef, {
      supplierId: payload.supplierId,
      name,
      price,
      description: description || "",
      categoryIds: categoryIds || [],
      stockQty: stockQty || 0,
      status: "draft",
      images: {
        cover: "",
        gallery: [],
      },
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json(
      {
        success: true,
        productId: productDoc.id,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Product creation error:", error);
    return NextResponse.json(
      { error: "Failed to create product" },
      { status: 500 }
    );
  }
}
